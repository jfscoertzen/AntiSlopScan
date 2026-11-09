/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { expect, test } from '@jest/globals';
import Fastify from 'fastify';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseConfig } from '../src/config.js';
import { executeAi } from '../src/ai.js';
import { requestAi } from '../src/ai/transport.js';
import { runAudit } from '../src/orchestrator.js';
import { scannerCatalog } from '../src/scanners/catalog.js';
import type { AuditContext } from '../src/domain.js';

/** Verify native protocols, bounded structured grading, and visible partial failure through actual HTTP. */
const providerContract = async (): Promise<void> => {
	const directory = await mkdtemp(join(tmpdir(), 'antislopscan-provider-'));
	const provider = Fastify({ logger: false });
	const headers: Record<string, unknown>[] = [];
	const bodies: Record<string, unknown>[] = [];
	let invalidReferences = false;
	const originalKey = process.env.ANTISLOPSCAN_TEST_AI_KEY;

	process.env.ANTISLOPSCAN_TEST_AI_KEY = 'fixture-credential';
	/** Produce a controlled model answer using only IDs actually sent by the appliance. */
	const answer = (body: Record<string, unknown>): string => {
		const messages = body.messages as { role: string; content: string }[];
		const user = JSON.parse(messages.at(-1)!.content);

		if (!user.principles) return JSON.stringify({ ok: true });
		return JSON.stringify({
			assessments: user.principles.map(
				/** Supply controlled positive/risk interpretations and leave other principles unassessed. */ (principle: {
					id: string;
				}) => ({
					principleId: principle.id,
					assessment: principle.id === 'DRY' ? 'supported' : principle.id === 'SRP' ? 'potential_risk' : 'not_assessable',
					score: principle.id === 'DRY' ? 90 : principle.id === 'SRP' ? 65 : null,
					confidence: ['DRY', 'SRP'].includes(principle.id) ? 0.8 : 0,
					reasoning:
						'The supplied sample contains one authoritative value; whole-system behavior needs additional evidence.',
					recommendation: 'Review callers and provide requirements before extending this conclusion.',
					evidenceIds:
						['DRY', 'SRP'].includes(principle.id) ? [invalidReferences ? 'UNKNOWN' : user.sourceEvidence[0].id] : []
				})
			)
		});
	};
	provider.post(
		'/v1/chat/completions',
		/** Emulate the documented OpenAI-compatible envelope. */ async (request) => {
			const body = request.body as Record<string, unknown>;

			headers.push(request.headers);
			bodies.push(body);
			return { choices: [{ finish_reason: 'stop', message: { content: answer(body) } }] };
		}
	);
	provider.post(
		'/api/chat',
		/** Emulate Ollama's native JSON response. */ async (request) => {
			const body = request.body as Record<string, unknown>;

			headers.push(request.headers);
			bodies.push(body);
			return { done: true, done_reason: 'stop', message: { content: answer(body) } };
		}
	);
	provider.post(
		'/v1/messages',
		/** Emulate Claude text blocks without tool execution. */ async (request) => {
			const body = request.body as Record<string, unknown>;

			headers.push(request.headers);
			bodies.push(body);
			return { stop_reason: 'end_turn', content: [{ type: 'text', text: answer(body) }] };
		}
	);
	try {
		await provider.listen({ host: '127.0.0.1', port: 0 });
		const address = provider.server.address();

		if (!address || typeof address === 'string') throw new Error('Provider has no TCP address');
		const origin = `http://127.0.0.1:${address.port}`;

		for (const protocol of ['openai-compatible', 'openai', 'claude', 'openrouter', 'ollama'] as const) {
			const settings = parseConfig({
				ai: {
					enabled: true,
					provider: protocol,
					baseUrl: protocol === 'ollama' ? origin : `${origin}/v1`,
					model: 'fixture-model',
					apiKeyEnv: 'ANTISLOPSCAN_TEST_AI_KEY',
					allowSourceTransmission: true
				}
			}).ai;

			expect(await requestAi(settings, 'untrusted data', {}, AbortSignal.timeout(10000))).toEqual({
				ok: true
			});
			if (protocol === 'claude') {
				expect(headers.at(-1)!['x-api-key']).toBe('fixture-credential');
				expect(headers.at(-1)!['anthropic-version']).toBe('2026-10-21');
			} else expect(headers.at(-1)!.authorization).toBe('Bearer fixture-credential');
			if (protocol === 'openai') expect(bodies.at(-1)!.max_completion_tokens).toBe(8192);
			if (protocol === 'ollama') expect(bodies.at(-1)!.stream).toBe(false);
		}
		const content = 'export const authoritativeValue = 42;\n';

		await writeFile(join(directory, 'module.ts'), content);
		const config = parseConfig({
			ai: {
				enabled: true,
				provider: 'ollama',
				baseUrl: origin,
				model: 'fixture-model',
				mode: 'architecture',
				allowSourceTransmission: true
			}
		});
		const context: AuditContext = {
			snapshot: directory,
			workDirectory: directory,
			config,
			inventory: {
				files: [{ path: 'module.ts', language: 'typescript', bytes: content.length, lines: 2, hash: '' }],
				languages: ['typescript'],
				totalBytes: content.length,
				totalLines: 2,
				visitedEntries: 1,
				excludedFiles: 0,
				skippedSymlinks: 0,
				binaryFiles: 0,
				documents: [],
				dependencies: []
			}
		};
		const result = await executeAi(context, AbortSignal.timeout(10000));

		expect(result.status).toBe('completed');
		expect(result.aiArchitecture?.score).toBe(78);
		expect(result.aiArchitecture?.requestedPrinciples).toBe(56);
		expect(result.aiArchitecture?.assessedPrinciples).toBe(2);
		expect(result.aiArchitecture?.principles[0].evidence[0].quote).toContain('authoritativeValue');
		const scanners: Record<string, { enabled: boolean }> = {};

		for (const definition of scannerCatalog) if (!['ai', 'systems'].includes(definition.id)) scanners[definition.id] = { enabled: false };
		const auditConfig = parseConfig({ scanners, ai: config.ai, reports: { formats: ['json', 'html'] } });
		const staticResult = await runAudit(parseConfig({ ...auditConfig, ai: { ...auditConfig.ai, enabled: false } }), { source: directory, output: `${directory}-reports` });
		const withAi = await runAudit(auditConfig, { source: directory, output: `${directory}-reports` });

		expect(withAi.scores).toEqual(staticResult.scores);
		expect(withAi.principles).toEqual(staticResult.principles);
		expect(withAi.erosion).toEqual(staticResult.erosion);
		expect(withAi.aiArchitecture?.score).toBe(78);
		expect(withAi.findings.some(/** Retain model risk only as separately attributed informational evidence. */ (finding) => finding.method === 'ai_assisted' && finding.assessment === 'informational')).toBe(true);
		invalidReferences = true;
		const partial = await executeAi(context, AbortSignal.timeout(10000));

		expect(partial.status).toBe('failed');
		expect(partial.aiArchitecture?.score).toBeNull();
		expect(partial.aiArchitecture?.status).toBe('partial');
		expect(partial.aiArchitecture?.errors.length).toBeGreaterThan(0);
		config.ai.allowSourceTransmission = false;
		await expect(executeAi(context, AbortSignal.timeout(10000))).rejects.toThrow(
			'not been explicitly enabled'
		);
	} finally {
		if (originalKey === undefined) delete process.env.ANTISLOPSCAN_TEST_AI_KEY;
		else process.env.ANTISLOPSCAN_TEST_AI_KEY = originalKey;
		await provider.close();
		await rm(directory, { recursive: true, force: true });
		await rm(`${directory}-reports`, { recursive: true, force: true });
	}
};

test(
	'LLM providers honor native wire contracts and retain honest evidence-backed architecture grades',
	providerContract
);
