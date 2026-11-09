/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { expect, test } from '@jest/globals';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import { randomBytes } from 'node:crypto';
import { createServer } from '../src/server.js';
import { scannerCatalog } from '../src/scanners/catalog.js';

/** Exercise authentication, CSRF/path confinement, repeated queued execution, stored results, and attachment retrieval. */
const apiContract = async (): Promise<void> => {
	const directory = await mkdtemp(join(tmpdir(), 'antislopscan-api-'));
	const sourceRoot = join(directory, 'source');
	const token = randomBytes(24).toString('hex');
	const scanners: Record<string, { enabled: boolean }> = {};

	for (const scanner of scannerCatalog) { if (!['systems', 'ai'].includes(scanner.id)) scanners[scanner.id] = { enabled: false }; }
	await mkdir(sourceRoot);
	await writeFile(join(sourceRoot, 'a.ts'), 'export const answer = 42;\n');
	const server = await createServer({ sourceRoot, dataDirectory: join(directory, 'data'), token, origin: 'http://localhost:3000', allowAi: true, aiBaseUrl: 'http://127.0.0.1:11434/v1' });
	const headers = { authorization: `Bearer ${token}`, host: 'localhost:3000' };

	try {
		expect((await server.inject({ method: 'GET', url: '/api/audits' })).statusCode).toBe(401);
		expect((await server.inject({ method: 'GET', url: '/api/audits', headers: { ...headers, origin: 'https://malicious.example' } })).statusCode).toBe(403);
		expect((await server.inject({ method: 'POST', url: '/api/audits', headers, payload: { source: '../' } })).statusCode).toBe(400);
		expect((await server.inject({ method: 'POST', url: '/api/audits', headers, payload: { source: '.', config: { ci: { baseline: '/etc/passwd' } } } })).statusCode).toBe(400);
		expect((await server.inject({ method: 'POST', url: '/api/audits', headers, payload: { source: '.', config: { ai: { enabled: true, model: 'test-model', allowSourceTransmission: true, baseUrl: 'https://untrusted.invalid/v1', apiKeyEnv: 'ANTISLOPSCAN_API_TOKEN' } } } })).statusCode).toBe(400);
		for (let auditNumber = 0; auditNumber < 2; auditNumber += 1) {
			const response = await server.inject({ method: 'POST', url: '/api/audits', headers, payload: { source: '.', config: { scanners, reports: { formats: ['html', 'json'] } } } });

			expect(response.statusCode).toBe(202);
			const accepted = response.json();
			let completed;

			for (let attempt = 0; attempt < 100; attempt += 1) {
				const status = await server.inject({ method: 'GET', url: `/api/audits/${accepted.id}`, headers });

				completed = status.json();
				if (['completed', 'failed'].includes(completed.status)) break;
				await delay(100);
			}
			expect(completed.status).toBe('completed');
			expect(completed.result.ci.passed).toBe(true);
			const artifact = await server.inject({ method: 'GET', url: `/api/audits/${accepted.id}/reports/html`, headers });

			expect(artifact.statusCode).toBe(200);
			expect(artifact.headers['content-disposition']).toContain('attachment');
			expect(artifact.body).toContain('antislopscan');
		}
		expect((await server.inject({ method: 'GET', url: '/api/audits?limit=1000', headers })).statusCode).toBe(400);
	} finally {
		await server.close();
		await rm(directory, { recursive: true, force: true });
	}
};

test('API confines jobs, authenticates requests, and returns persisted artifacts', apiContract);


/** Reject malformed requests and unavailable resources without creating audit jobs; bound a small authenticated request burst. */
const apiEdgeCases = async (): Promise<void> => {
	const directory = await mkdtemp(join(tmpdir(), 'antislopscan-api-edges-'));
	const sourceRoot = join(directory, 'source');
	const token = randomBytes(24).toString('hex');
	const headers = { authorization: `Bearer ${token}`, host: 'localhost:3000' };

	await mkdir(sourceRoot);
	const server = await createServer({ sourceRoot, dataDirectory: join(directory, 'data'), token, origin: 'http://localhost:3000' });

	try {
		expect((await server.inject({ method: 'POST', url: '/api/audits', headers: { ...headers, 'content-type': 'application/json' }, payload: '{invalid' })).statusCode).toBe(400);
		expect((await server.inject({ method: 'POST', url: '/api/audits', headers, payload: {} })).statusCode).toBe(400);
		expect((await server.inject({ method: 'GET', url: '/api/audits/00000000-0000-4000-8000-000000000000', headers })).statusCode).toBe(404);
		expect((await server.inject({ method: 'GET', url: '/api/audits/missing/reports/html' })).statusCode).toBe(401);
		for (const query of ['limit=0', 'limit=-1', 'offset=-1', 'limit=abc']) {
			expect((await server.inject({ method: 'GET', url: `/api/audits?${query}`, headers })).statusCode).toBe(400);
		}
		const started = performance.now();

		for (let request = 0; request < 100; request += 1) {
			const response = await server.inject({ method: 'GET', url: '/api/audits', headers });

			expect(response.statusCode).toBe(200);
			expect(response.json().audits).toEqual([]);
		}
		expect(performance.now() - started).toBeLessThan(10000);
	} finally {
		await server.close();
		await rm(directory, { recursive: true, force: true });
	}
};

test('API rejects malformed inputs, protects missing exports and handles an isolated request burst', apiEdgeCases);
