/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { expect, test } from '@jest/globals';
import { executeStages } from '../scripts/ci/run.mjs';
import { command, testEnvironment } from '../scripts/ci/process.mjs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { auditRepository } from '../scripts/ci/audit.mjs';
import { parseConfig } from '../dist/config.js';
import { scannerCatalog } from '../dist/scanners/catalog.js';
import { applicationSteps } from '../scripts/ci/journal.mjs';

/** A failed gate must prevent every later gate from executing, including release prerequisites. @returns {Promise<void>} */
const gateFailures = async () => {
	for (const failure of applicationSteps) {
		const executed = [];
		const stages = applicationSteps.map(
			/** Inject one realistic failing gate and record actual invocation order. @param {string} id @returns {{id: string, run: () => Promise<void>}} */
			(id) => ({ id,
				/** Reject this stage when selected; later stages must not be called. @returns {Promise<void>} */
				run: async () => {
					executed.push(id);
					if (id === failure) throw new Error('Fixture gate failure');
				}
			})
		);
		const results = await executeStages(stages);
		const failedIndex = stages.findIndex(/** Locate the deliberately failed gate. @param {{id: string}} stage @returns {boolean} */ (stage) => stage.id === failure);

		expect(executed).toEqual(stages.slice(0, failedIndex + 1).map(/** Read gate identifiers in expected order. @param {{id: string}} stage @returns {string} */ (stage) => stage.id));
		expect(results[failedIndex].status).toBe('failed');
		for (const result of results.slice(failedIndex + 1)) expect(result.status).toBe('skipped');
	}
};


/** A successful verification runs all stages once, without retrying or reordering them. @returns {Promise<void>} */
const successfulGates = async () => {
	const executed = [];
	const stages = applicationSteps.map(
		/** Record one successful stage. @param {string} id @returns {{id: string, run: () => Promise<void>}} */
		(id) => ({ id,
			/** Resolve only after recording the invocation. @returns {Promise<void>} */
			run: async () => { executed.push(id); }
		})
	);
	const results = await executeStages(stages);

	expect(executed).toEqual(['backend', 'cli', 'distribution', 'ui', 'security', 'self-audit', 'snyk']);
	expect(results.every(/** Require every declared gate to pass. @param {{status: string}} result @returns {boolean} */ (result) => result.status === 'passed')).toBe(true);
};


/** Operator credentials and enabled external AI settings must never leak into fixture subprocesses. @returns {void} */
const isolatedEnvironment = () => {
	const original = { ...process.env };

	try {
		process.env.ANTISLOPSCAN_AI_ENABLED = 'true';
		process.env.CODESENTRY_API_TOKEN = 'fixture-only';
		process.env.OPENAI_API_KEY = 'fixture-only';
		process.env.DOCKER_TOKEN = 'fixture-only';
		process.env.SNYK_TOKEN = 'fixture-only';
		process.env.SNYK_DEBUG = 'fixture-only';
		process.env.ANTISLOPSCAN_CHROMIUM_SANDBOX = 'false';
		const environment = testEnvironment();

		expect(environment.ANTISLOPSCAN_AI_ENABLED).toBeUndefined();
		expect(environment.CODESENTRY_API_TOKEN).toBeUndefined();
		expect(environment.OPENAI_API_KEY).toBeUndefined();
		expect(environment.DOCKER_TOKEN).toBeUndefined();
		expect(environment.SNYK_TOKEN).toBeUndefined();
		expect(environment.SNYK_DEBUG).toBeUndefined();
		expect(environment.ANTISLOPSCAN_CHROMIUM_SANDBOX).toBe('false');
		expect(environment.PATH).toBe(original.PATH);
	} finally {
		for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
		Object.assign(process.env, original);
	}
};


/** Real child failures and deadline overruns must reject and preserve diagnostics. @returns {Promise<void>} */
const subprocessFailures = async () => {
	const directory = await mkdtemp(join(tmpdir(), 'antislopscan-gates-'));
	const log = join(directory, 'failure.log');

	try {
		await expect(command(process.execPath, ['-e', 'process.stderr.write("fixture failure");process.exit(7)'], { log })).rejects.toThrow('Command exited 7');
		expect(await readFile(log, 'utf8')).toContain('fixture failure');
		await expect(command(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { log, timeoutMs: 50 })).rejects.toThrow('Stage timed out');
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
};

test('verification fails closed after any failed gate', gateFailures);
test('verification preserves gate order and runs each stage once', successfulGates);
test('verification excludes operator credentials and external provider settings', isolatedEnvironment);
test('verification captures child failures and enforces execution deadlines', subprocessFailures);


/** CI may collect evidence in its checkout while the audit itself must publish outside the audited source tree. @returns {Promise<void>} */
const collectedReports = async () => {
	const directory = await mkdtemp(join(tmpdir(), 'antislopscan-ci-reports-'));
	const output = join(directory, 'ci-evidence');
	const scanners = {};

	for (const scanner of scannerCatalog) if (!['systems', 'ai'].includes(scanner.id)) scanners[scanner.id] = { enabled: false };
	try {
		await writeFile(join(directory, 'index.ts'), 'export const answer = 42;\n');
		const result = await auditRepository(parseConfig({ scanners, reports: { formats: ['json', 'sarif'] } }), output, directory);
		const published = JSON.parse(await readFile(join(output, 'report.json'), 'utf8'));

		expect(published.id).toBe(result.id);
		expect(published.reports).toEqual(result.reports);
		expect(JSON.parse(await readFile(join(output, 'report.sarif.json'), 'utf8')).version).toBe('2.1.0');
		expect(await readFile(join(directory, 'index.ts'), 'utf8')).toBe('export const answer = 42;\n');
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
};

test('CI collects unchanged audit reports without weakening output path confinement', collectedReports);
