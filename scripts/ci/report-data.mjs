/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { lstat, readFile, realpath, open } from 'node:fs/promises';
import { resolve, relative, isAbsolute, join } from 'node:path';
import { createHash } from 'node:crypto';
import { visualCases } from '../../tests/visual-cases.mjs';
import { readJournal } from './journal.mjs';
import { summarizeSnyk } from './snyk-results.mjs';

/** Read bounded regular artifacts inside the evidence root; reject traversal and symlink escape. @param {string} output @param {string} file @param {number} [limit] @param {number} [minimumMtime] @returns {Promise<Buffer | undefined>} */
export const artifact = async (output, file, limit = 16777216, minimumMtime = 0) => {
	if (isAbsolute(file)) throw new Error('Absolute artifact path rejected');
	const root = await realpath(output);
	const path = resolve(root, file);
	const inside = relative(root, path);

	if (inside === '..' || inside.startsWith('../')) throw new Error('Artifact traversal rejected');
	try {
		const stat = await lstat(path);
		const canonical = await realpath(path);
		const target = relative(root, canonical);

		if (!stat.isFile() || stat.isSymbolicLink() || target === '..' || target.startsWith('../')) throw new Error('Artifact symlink/non-file rejected');
		if (stat.mtimeMs + 1000 < minimumMtime) throw new Error(`Stale artifact rejected: ${file}`);
		if (stat.size > limit) throw new Error(`Artifact exceeds report limit: ${file}`);
		return await readFile(path);
	} catch (error) {
		if (error.code === 'ENOENT') return undefined;
		throw error;
	}
};

/** Remove terminal controls and credential-shaped values before embedding diagnostics. @param {unknown} value @returns {string} */
export const diagnosticText = (value) => String(value ?? '').replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '').replace(/\bBearer\s+[^\s"'<>]+/gi, 'Bearer [redacted]').replace(/((?:api[_-]?key|password|secret|token)\s*[=:]\s*)["']?[^\s"'<>]+/gi, '$1[redacted]');

/** Map Jest's actual case outcomes to source contracts without inventing results for missing cases. @param {object} result @param {object[]} inventory @param {string} project @returns {object[]} */
export const mapTests = (result, inventory, project) => {
	const outcomes = new Map();

	for (const suite of result?.testResults ?? []) for (const test of suite.assertionResults ?? []) outcomes.set(test.fullName, test);
	const cases = [];

	for (const definition of inventory) {
		if (definition.project !== project) continue;
		const actual = outcomes.get(definition.title);

		cases.push({ ...definition, status: actual?.status ?? 'not_run', durationMs: actual?.duration ?? null, failures: (actual?.failureMessages ?? []).map(diagnosticText) });
		outcomes.delete(definition.title);
	}
	for (const [title, actual] of outcomes) cases.push({ id: `unmapped-${cases.length}`, project, title, purpose: 'No source contract was mapped; investigate inventory drift.', checks: [], status: actual.status, durationMs: actual.duration, failures: (actual.failureMessages ?? []).map(diagnosticText), unmapped: true });
	return cases;
};

/** Parse an optional JSON artifact; malformed data remains a visible reporting issue. @param {string} output @param {string} file @param {string[]} issues @param {number} [minimumMtime] @returns {Promise<object | undefined>} */
const json = async (output, file, issues, minimumMtime = 0) => {
	try {
		const bytes = await artifact(output, file, 16777216, minimumMtime);

		return bytes ? JSON.parse(bytes.toString('utf8')) : undefined;
	} catch (error) {
		issues.push(`${file}: ${error.message}`);
		return undefined;
	}
};

/** Read a log tail after checking that its canonical path remains in the evidence directory. @param {string} output @param {string} file @param {number} minimumMtime @returns {Promise<string>} */
const logTail = async (output, file, minimumMtime) => {
	const path = join(output, file);

	try {
		const root = await realpath(output);
		const canonical = await realpath(path);

		if (relative(root, canonical).startsWith('..')) throw new Error('Log path escapes evidence storage');
		const handle = await open(canonical, 'r');

		try {
			const stat = await handle.stat();
			if (!stat.isFile() || stat.mtimeMs + 1000 < minimumMtime) return '';
			const size = Math.min(16000, stat.size);
			const buffer = Buffer.alloc(size);

			await handle.read(buffer, 0, size, stat.size - size);
			return diagnosticText(buffer.toString('utf8'));
		} finally { await handle.close(); }
	} catch (error) {
		if (error.code === 'ENOENT') return '';
		throw error;
	}
};

/** Build a report solely from this run's journal, Jest output and verified screenshot manifests. @param {string} output @returns {Promise<object>} */
export const collectReport = async (output) => {
	const journal = await readJournal(output);
	const issues = [];
	const minimumMtime = Date.parse(journal.startedAt);

	/** Read only JSON evidence created during this run. @param {string} file @returns {Promise<object | undefined>} */
	const currentJson = async (file) => json(output, file, issues, minimumMtime);
	let inventory = [];

	try {
		const { testInventory } = await import('./test-inventory.mjs');

		inventory = await testInventory();
	} catch (error) { issues.push(`Test inventory unavailable: ${error.message}`); }
	const cases = [];
	const logs = [];
	const stepMap = new Map();

	for (const step of journal.steps) {
		stepMap.set(step.id, step);
		if (!/^[a-z-]+$/.test(step.id)) { issues.push('Invalid step identifier'); continue; }
		const text = ['passed', 'failed', 'running'].includes(step.status) ? await logTail(output, `${step.id}.log`, minimumMtime) : '';

		if (text) logs.push({ name: step.name, text });
	}
	for (const project of ['backend', 'cli', 'distribution', 'ui']) {
		const step = stepMap.get(project);
		const result = ['passed', 'failed'].includes(step?.status) ? await currentJson(`${project}.json`) : undefined;

		if (step?.status === 'passed' && !result?.success) issues.push(`${project}: passing stage has no successful Jest result`);
		const mapped = mapTests(result, inventory, project);

		if (step?.status === 'passed') for (const item of mapped) if (item.status !== 'passed') issues.push(`${project}: source case lacks passing evidence: ${item.title}`);
		cases.push(...mapped);
	}
	for (const item of cases) if (item.unmapped) issues.push(`Unmapped executed test: ${item.title}`);
	const visuals = [];
	let totalBytes = 0;

	if (['passed', 'failed'].includes(stepMap.get('ui')?.status)) for (const scenario of ['ui-dashboard', 'ui-model']) {
		const manifest = await currentJson(`${scenario}/evidence.json`);

		if (!manifest || manifest.runId !== journal.runId) {
			if (stepMap.get('ui').status === 'passed') issues.push(`${scenario}: current-run screenshots are missing`);
			continue;
		}
		if (!manifest.complete && stepMap.get('ui').status === 'passed') issues.push(`${scenario}: screenshot coverage is incomplete`);
		const captured = new Set();
		const required = visualCases(scenario);

		for (const capture of manifest.captures ?? []) {
			try {
				if (!required[capture.id]) throw new Error('Undeclared screenshot checkpoint');
				if (!/^[a-zA-Z0-9-]+\.png$/.test(capture.file)) throw new Error('Invalid screenshot filename');
				const bytes = await artifact(output, `${scenario}/${capture.file}`, 5242880, minimumMtime);

				if (!bytes || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('Screenshot missing or not PNG');
				if (capture.sha256 !== createHash('sha256').update(bytes).digest('hex')) throw new Error('Screenshot checksum mismatch');
				totalBytes += bytes.length;
				if (totalBytes > 104857600) throw new Error('Screenshot gallery exceeds 100 MiB');
				captured.add(capture.id);
				visuals.push({ ...capture, ...required[capture.id], pixelWidth: bytes.readUInt32BE(16), pixelHeight: bytes.readUInt32BE(20), scenario, image: bytes.toString('base64') });
			} catch (error) { issues.push(`${scenario}/${capture.id}: ${error.message}`); }
		}
		for (const id of Object.keys(required)) if (!captured.has(id) && stepMap.get('ui').status === 'passed') issues.push(`${scenario}: missing screenshot ${id}`);
	}
	const coverage = stepMap.get('backend')?.status === 'passed' ? await currentJson('coverage/coverage-summary.json') : undefined;
	const sast = ['passed', 'failed'].includes(stepMap.get('security')?.status) ? await currentJson('sast/report.json') : undefined;
	const security = ['passed', 'failed'].includes(stepMap.get('security')?.status) ? await currentJson('security.json') : undefined;
	const dependencies = ['passed', 'failed'].includes(stepMap.get('security')?.status) ? await currentJson('dependencies.json') : undefined;
	const audit = ['passed', 'failed'].includes(stepMap.get('self-audit')?.status) ? await currentJson('self-audit/report.json') : undefined;
	const executable = stepMap.get('executable')?.status === 'passed' ? await currentJson('executable.json') : undefined;
	let snyk = ['passed', 'failed'].includes(stepMap.get('snyk')?.status) ? await currentJson('snyk.json') : undefined;

	if (snyk && snyk.runId !== journal.runId) { issues.push('Snyk evidence does not belong to this run'); snyk = undefined; }
	if (stepMap.get('snyk')?.status === 'passed' && snyk?.passed !== true) issues.push('Passing Snyk gate has no successful current scan evidence');
	if (stepMap.get('snyk')?.status === 'passed' && (!snyk?.version || snyk.version !== snyk.expectedVersion || ['dependencies', 'code'].some(/** Require both independent scan completions. @param {string} kind @returns {boolean} */ (kind) => snyk.scans?.[kind]?.status !== 'completed' || snyk.scans[kind].passed !== true))) issues.push('Passing Snyk gate lacks both completed pinned scans');
	for (const [kind, scan] of Object.entries(snyk?.scans ?? {})) {
		if (scan.status !== 'completed') continue;
		try {
			if (!['dependencies', 'code'].includes(kind)) throw new Error('Unknown Snyk scan');
			const raw = await currentJson(`snyk/${kind}.json`);
			const actual = summarizeSnyk(kind, raw, scan.exitCode);

			if (JSON.stringify(actual.counts) !== JSON.stringify(scan.counts) || JSON.stringify(actual.issues) !== JSON.stringify(scan.issues) || actual.passed !== scan.passed) throw new Error('Snyk summary differs from raw scan evidence');
		} catch (error) { issues.push(`Snyk ${kind}: ${error.message}`); }
	}
	const { version } = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'));

	return { journal, version, cases, visuals, coverage, sast, security, dependencies, audit, executable, snyk, logs, issues, passed: journal.passed && issues.length === 0 };
};
