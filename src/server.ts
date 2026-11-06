/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import Fastify, { type FastifyInstance } from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { configSchema } from './config-schema.js';
import { parseConfig, mergeConfig, type AuditProfile } from './config.js';
import type { Config } from './domain.js';
import { canonicalInside, resolveInside } from './security/paths.js';
import { applicationRoot } from './security/process.js';
import { History } from './history.js';
import { AuditQueue } from './jobs.js';
import { log } from './logging.js';

export interface ServerOptions { sourceRoot: string; dataDirectory: string; profile?: AuditProfile; token?: string; origin: string; allowAi?: boolean; aiBaseUrl?: string; aiApiKeyEnv?: string; aiProvider?: Config['ai']['provider']; defaultConfig?: Config; retention?: number }
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const securityHeaders = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'x-frame-options': 'DENY', 'cache-control': 'no-store' };

/** Compare API tokens without logging or persisting them. */
const sameToken = (candidate: string, expected: string): boolean => {
	const candidateBytes = Buffer.from(candidate);
	const expectedBytes = Buffer.from(expected);

	return candidateBytes.length === expectedBytes.length && timingSafeEqual(candidateBytes, expectedBytes);
};


/** Create the Fastify appliance with confined source access, a bounded queue, and lifecycle-owned storage. */
export const createServer = async (options: ServerOptions): Promise<FastifyInstance> => {
	if (options.retention !== undefined && (!Number.isInteger(options.retention) || options.retention < 1 || options.retention > 10000)) throw new Error('Audit retention must be an integer from 1 to 10000');
	if (options.allowAi && !options.aiBaseUrl) throw new Error('API AI access requires an operator-pinned provider URL');
	const sourceRoot = await realpath(options.sourceRoot);
	const origin = new URL(options.origin);
	const dataDirectory = options.dataDirectory;

	await mkdir(dataDirectory, { recursive: true, mode: 0o700 });
	const history = new History(join(dataDirectory, 'history.sqlite'));
	const reportRoot = join(dataDirectory, 'reports');
	const queue = new AuditQueue(history, reportRoot, options.retention ?? 100);
	const server = Fastify({ bodyLimit: 1048576, requestTimeout: 30000, connectionTimeout: 10000, logger: false, trustProxy: false });

	server.addHook('onRequest', /** Enforce origin/host policy, headers, and optional bearer authentication before routing. */ async (request, reply) => {
		reply.headers(securityHeaders);
		const requestHost = request.headers.host?.split(':')[0];
		const hosts = new Set(['localhost', '127.0.0.1', origin.hostname]);

		if (!requestHost || !hosts.has(requestHost)) return reply.code(403).send({ error: 'Unrecognized host' });
		if (request.headers.origin && request.headers.origin !== origin.origin) return reply.code(403).send({ error: 'Cross-origin requests are not permitted' });
		if (request.url.startsWith('/api/') && options.token && !sameToken(request.headers.authorization?.replace(/^Bearer /, '') ?? '', options.token)) return reply.code(401).send({ error: 'A valid API bearer token is required' });
	});

	server.setErrorHandler(/** Return a safe error once without leaking submitted data or implementation stacks. */ (error, request, reply) => {
		if (reply.sent || reply.raw.headersSent || reply.raw.writableEnded) return;
		const errorCode = (error as { statusCode?: number }).statusCode;
		const status = typeof errorCode === 'number' && errorCode >= 400 && errorCode < 500 ? errorCode : 500;

		log(status >= 500 ? 'error' : 'warn', 'http_request_failed', { method: request.method, status });
		reply.code(status).send({ error: status === 500 ? 'The appliance could not complete the request' : 'Invalid request' });
	});

	server.get('/health', /** Expose process liveness without revealing repository or storage information. */ async () => ({ status: 'ok' }));
	server.get('/api/config/default', /** Return trusted deployment defaults and explicit AI authority without exposing credentials. */ async () => ({ config: options.defaultConfig ?? parseConfig({}, options.profile), schema: configSchema, aiPolicy: { allowed: options.allowAi ?? false, baseUrl: options.aiBaseUrl, provider: options.aiProvider, apiKeyEnv: options.aiApiKeyEnv ?? 'AUDIT_AI_API_KEY' } }));

	server.get('/api/audits', { schema: { querystring: { type: 'object', additionalProperties: false, properties: { limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 }, offset: { type: 'integer', minimum: 0, maximum: 1000000, default: 0 } } } } }, /** Return bounded summaries without selecting large audit payloads. */ async (request) => {
		const query = request.query as { limit: number; offset: number };

		return { audits: history.list(query.limit, query.offset) };
	});

	server.post('/api/audits', { schema: { body: { type: 'object', additionalProperties: false, required: ['source'], properties: { source: { type: 'string', minLength: 1, maxLength: 4096 }, config: { type: 'object' }, baselineId: { type: 'string', pattern: uuidPattern.source } } } } }, /** Accept a validated job while retaining operator authority over paths and resources. */ async (request, reply) => {
		const body = request.body as { source: string; config?: Record<string, unknown>; baselineId?: string };
		let source: string;
		let config;

		try {
			source = await canonicalInside(sourceRoot, resolveInside(sourceRoot, body.source));
			config = parseConfig(mergeConfig((options.defaultConfig ?? {}) as unknown as Record<string, unknown>, body.config ?? {}), options.profile);
			if (config.ci.baseline) return reply.code(400).send({ error: 'Use baselineId for API comparisons' });
			if (config.ai.enabled && !options.allowAi) return reply.code(400).send({ error: 'AI transmission is disabled by the appliance operator' });
			if (config.ai.enabled && (config.ai.baseUrl.replace(/\/$/, '') !== options.aiBaseUrl?.replace(/\/$/, '') || config.ai.apiKeyEnv !== (options.aiApiKeyEnv ?? 'AUDIT_AI_API_KEY'))) return reply.code(400).send({ error: 'AI provider URL or credential environment variable is not permitted by the appliance operator' });
			if (config.ai.enabled && options.aiProvider && config.ai.provider !== options.aiProvider) return reply.code(400).send({ error: 'AI protocol is not permitted by the appliance operator' });
			const limits = (options.defaultConfig ?? parseConfig({})).audit;

			for (const field of ['maxFiles', 'maxFileBytes', 'maxRepositoryBytes', 'maxEntries', 'parallelScanners', 'scannerMemoryMb', 'maxOutputBytes', 'timeoutSeconds'] as const) {
				if (config.audit[field] > limits[field]) return reply.code(400).send({ error: `Requested ${field} exceeds appliance API limits` });
			}
		} catch {
			return reply.code(400).send({ error: 'Invalid audit configuration or source path outside the mounted workspace' });
		}
		const baseline = body.baselineId ? history.result(body.baselineId) : undefined;

		if (body.baselineId && !baseline) return reply.code(400).send({ error: 'Baseline must name a completed audit' });
		config.project.source = source;
		try {
			const id = queue.submit(source, config, baseline);

			return reply.code(202).header('location', `/api/audits/${id}`).send({ id, status: 'queued' });
		} catch {
			return reply.code(429).header('retry-after', '5').send({ error: 'Audit queue is full or shutting down' });
		}
	});

	server.get('/api/audits/:id', /** Return one audit state and result after validating its identifier. */ async (request, reply) => {
		const { id } = request.params as { id: string };

		if (!uuidPattern.test(id)) return reply.code(400).send({ error: 'Invalid audit identifier' });
		const job = history.get(id);

		if (!job) return reply.code(404).send({ error: 'Audit not found' });
		return { ...job, result: job.status === 'completed' ? history.result(id) : undefined };
	});

	server.get('/api/audits/:id/reports/:format', /** Download a known artifact as an attachment without executing it in this origin. */ async (request, reply) => {
		const { id, format } = request.params as { id: string; format: string };

		if (!uuidPattern.test(id) || !['html', 'pdf', 'json', 'sarif'].includes(format)) return reply.code(400).send({ error: 'Invalid artifact request' });
		const result = history.result(id);
		let filename: string | undefined;

		for (const report of result?.reports ?? []) { if (report.format === format && report.status === 'completed') filename = report.file; }
		if (!filename) return reply.code(404).send({ error: 'Artifact is unavailable' });
		const expected = `report.${format === 'sarif' ? 'sarif.json' : format}`;

		if (filename !== expected) throw new Error('Stored artifact filename differs from its contract');
		const bytes = await readFile(join(reportRoot, id, filename));

		return reply.header('content-disposition', `attachment; filename="${filename}"`).type(format === 'pdf' ? 'application/pdf' : format === 'html' ? 'text/html; charset=utf-8' : 'application/json').send(bytes);
	});

	server.get('/', /** Serve built Vue assets with a local-only content security policy. */ async (_request, reply) => {
		reply.header('content-security-policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
		return reply.type('text/html; charset=utf-8').send(await readFile(join(applicationRoot, 'dist/ui/index.html')));
	});

	server.get('/assets/:name', /** Serve only single-segment Vite asset names; reject traversal or missing files. */ async (request, reply) => {
		const { name } = request.params as { name: string };

		if (!/^[a-zA-Z0-9_.-]+\.(?:js|css|png|gif)$/.test(name)) return reply.code(404).send({ error: 'Asset not found' });
		try {
			return reply.type(name.endsWith('.gif') ? 'image/gif' : name.endsWith('.png') ? 'image/png' : name.endsWith('.css') ? 'text/css' : 'text/javascript').send(await readFile(join(applicationRoot, 'dist/ui/assets', name)));
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
			return reply.code(404).send({ error: 'Asset not found' });
		}
	});

	server.addHook('onClose', /** Stop accepted jobs before releasing the shared SQLite connection. */ async () => { await queue.close(); history.close(); });
	return server;
};
