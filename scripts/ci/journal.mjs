/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export const applicationSteps = ['backend', 'cli', 'distribution', 'ui', 'security', 'self-audit', 'snyk'];
export const stepNames = { build: 'Production build and toolchain', 'test-types': 'Test TypeScript checks', documentation: 'Callable documentation', 'test-documentation': 'Test inventory documentation', package: 'Prepare offline npm package', backend: 'Backend functional and coverage tests', cli: 'CLI functional tests', distribution: 'Offline installation and packaged GUI', ui: 'Playwright frontend verification', security: 'SAST, secrets and dependency advisories', 'self-audit': 'AntiSlopScan self-audit', snyk: 'Snyk dependencies and source code', 'container-cleanup': 'Test container cleanup', archives: 'Assemble checksummed release archives', executable: 'Portable executable audit' };

const stepDetails = {
	snyk: 'Pinned Snyk CLI: production/development npm dependencies and source-code SAST, all severities retained, high/critical findings or unavailable scans block release.',
	build: 'Production compilation and Vue bundle; Docker also provisions the pinned toolchain, checks types/docs/inventory and prepares the offline package.',
	'test-types': 'Strict TypeScript validation of test code and its application imports.',
	documentation: 'Every original function/callback has compiler-recognized contract documentation.',
	'test-documentation': 'TESTING.md matches every registered source test and required visual checkpoint.',
	package: 'Verify locked production dependencies and bundled assets; create the actual offline npm tarball.',
	backend: 'Real API/worker/scanner integration, core regressions, security boundaries, performance budgets and critical-module coverage.',
	cli: 'Executable modes, selected report paths, GUI startup, configuration errors and distinct CI exit codes.',
	distribution: 'Fresh offline global/local installs from the actual tarball, real bundled scanners and packaged GUI.',
	ui: 'Real browser workflows, exports, evidence drill-down, accessibility/appearance checks and all required screenshot checkpoints.',
	security: 'ESLint/Semgrep, full-history and working-tree Gitleaks, and live dependency advisories including dev dependencies.',
	'self-audit': 'Run AntiSlopScan on this codebase; enforce quality, applicable scanner coverage and architecture boundaries.',
	'container-cleanup': 'Remove the owned test container after success or failure.',
	archives: 'Extract the verified npm package and Node binary into executable distribution archives; create SHA-256 checksums.',
	executable: 'Check archive digests and run a real fixture audit using the extracted executable.'
};

/** Write one atomic canonical pipeline journal without exposing operator configuration. @param {string} output @param {object} journal @returns {Promise<void>} */
export const saveJournal = async (output, journal) => {
	const temporary = join(output, `.pipeline-${process.pid}.tmp`);

	await writeFile(temporary, JSON.stringify(journal, null, 2) + '\n', { mode: 0o600 });
	await rename(temporary, join(output, 'pipeline.json'));
};

/** Start a fresh run and declare every expected gate before it executes. @param {string} output @param {string} mode @param {string[]} ids @returns {Promise<object>} */
export const startJournal = async (output, mode, ids) => {
	const journal = { schemaVersion: 1, runId: randomUUID(), mode, context: { repository: process.env.GITHUB_REPOSITORY ?? 'Local working tree', commit: process.env.GITHUB_SHA ?? 'Not recorded; local changes may be present', reference: process.env.GITHUB_REF_NAME ?? 'local', workflowRun: process.env.GITHUB_RUN_ID ?? 'local' }, startedAt: new Date().toISOString(), completedAt: null, passed: false, publication: process.env.GITHUB_REF_TYPE === 'tag' ? 'Pending separate release job; this verification has not published.' : 'Not requested. Local/branch verification does not publish.', steps: ids.map(/** Declare an unexecuted gate explicitly. @param {string} id @returns {object} */ (id) => ({ id, name: stepNames[id] ?? id, description: stepDetails[id] ?? '', status: 'pending', durationMs: 0 })) };

	await mkdir(output, { recursive: true });
	for (const file of ['ci-report.html', 'ci-report.pdf', 'report-status.json']) await rm(join(output, file), { force: true });
	await saveJournal(output, journal);
	return journal;
};

/** Read the current run journal. @param {string} output @returns {Promise<object>} */
export const readJournal = async (output) => JSON.parse(await readFile(join(output, 'pipeline.json'), 'utf8'));

/** Update one stage after its actual transition; preserve all other evidence. @param {string} output @param {object} step @returns {Promise<void>} */
export const recordStep = async (output, step) => {
	const journal = await readJournal(output);
	const index = journal.steps.findIndex(/** Locate this declared stage. @param {{id: string}} entry @returns {boolean} */ (entry) => entry.id === step.id);

	if (index < 0) throw new Error(`Undeclared CI step: ${step.id}`);
	Object.assign(journal.steps[index], step);
	await saveJournal(output, journal);
};

/** Execute a recorded command and preserve failure status before propagating its exception. @param {string} output @param {string} id @param {() => Promise<void>} run @returns {Promise<void>} */
export const recorded = async (output, id, run) => {
	const started = performance.now();

	await recordStep(output, { id, status: 'running', startedAt: new Date().toISOString() });
	try {
		await run();
		await recordStep(output, { id, status: 'passed', durationMs: Math.round(performance.now() - started) });
	} catch (error) {
		await recordStep(output, { id, status: 'failed', error: error.message ?? String(error), durationMs: Math.round(performance.now() - started) });
		throw error;
	}
};

/** Mark unexecuted gates skipped, then derive the actual verification outcome. @param {string} output @returns {Promise<object>} */
export const finishJournal = async (output) => {
	const journal = await readJournal(output);

	for (const step of journal.steps) if (['pending', 'running'].includes(step.status)) {
		step.status = 'skipped';
		step.error = 'Not completed because an earlier gate failed.';
	}
	journal.passed = journal.steps.length > 0 && journal.steps.every(/** Require all declared verification gates to pass. @param {{status: string}} step @returns {boolean} */ (step) => step.status === 'passed');
	journal.completedAt = new Date().toISOString();
	await saveJournal(output, journal);
	return journal;
};
