/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { CommandFailure, command, testEnvironment } from './process.mjs';
import { summarizeSnyk } from './snyk-results.mjs';

/** Give only the explicit Snyk subprocess its token and optional organization; never inherit other credentials or Snyk debug settings. @param {NodeJS.ProcessEnv} [credentials] @returns {NodeJS.ProcessEnv} */
export const snykEnvironment = (credentials = process.env) => {
	const environment = { ...testEnvironment() };

	if (credentials.SNYK_TOKEN) environment.SNYK_TOKEN = credentials.SNYK_TOKEN;
	if (credentials.SNYK_ORG) {
		if (!/^[a-zA-Z0-9-]+$/.test(credentials.SNYK_ORG)) throw new Error('SNYK_ORG must be an organization UUID or slug');
		environment.SNYK_CFG_ORG = credentials.SNYK_ORG;
	}
	return environment;
};


/** Run both independent cloud scans with the pinned binary; retain completed findings separately from gate failure and never execute audited project scripts. @param {string} output @param {{credentials?: NodeJS.ProcessEnv, runId?: string}} [options] @returns {Promise<object>} */
export const runSnyk = async (output, options = {}) => {
	const policy = JSON.parse(await readFile(new URL('../../config/snyk-ci.json', import.meta.url), 'utf8'));
	const directory = join(output, 'snyk');
	const binary = resolve('tools/bin/snyk');
	const credentials = options.credentials ?? process.env;
	const report = { passed: false, runId: options.runId ?? 'standalone', expectedVersion: policy.version, version: null, severityThreshold: policy.severityThreshold, scans: {} };
	const scratch = await mkdtemp(join(tmpdir(), 'antislopscan-snyk-'));

	await mkdir(directory, { recursive: true });
	await rm(join(output, 'snyk.json'), { force: true });
	try {
		if (policy.severityThreshold !== 'high' || !Number.isInteger(policy.timeoutSeconds) || policy.timeoutSeconds < 1 || policy.timeoutSeconds > 900) throw new Error('Invalid Snyk CI policy');
		if (!credentials.SNYK_TOKEN?.trim()) throw new Error('SNYK_TOKEN is required for Snyk dependency and Code scans');
		const environment = { ...snykEnvironment(credentials), XDG_CACHE_HOME: scratch, XDG_CONFIG_HOME: scratch, TMPDIR: scratch };
		const versionLog = join(directory, 'version.log');

		await command(binary, ['--version'], { log: versionLog, env: environment, timeoutMs: 30000 });
		report.version = (await readFile(versionLog, 'utf8')).trim();
		if (report.version !== policy.version) throw new Error('Installed Snyk version does not match config/snyk-ci.json; run sh scripts/install-ci-tools.sh');

		for (const kind of ['dependencies', 'code']) {
			const started = performance.now();
			const rawPath = join(directory, `${kind}.json`);
			const log = join(directory, `${kind}.log`);
			const args = kind === 'dependencies' ? ['test', '--file=package.json', '--dev', '--ignore-policy', '--json'] : ['code', 'test', '--json'];
			let exitCode = 0;

			await rm(rawPath, { force: true });
			try {
				try {
					await command(binary, args, { log: rawPath, env: environment, timeoutMs: policy.timeoutSeconds * 1000 });
				} catch (error) {
					if (!(error instanceof CommandFailure) || error.timedOut || error.exitCode !== 1) throw error;
					exitCode = 1;
				}
				const bytes = await readFile(rawPath, 'utf8');

				report.scans[kind] = { ...summarizeSnyk(kind, JSON.parse(bytes), exitCode), durationMs: Math.round(performance.now() - started), artifact: `snyk/${kind}.json` };
				await writeFile(log, `${kind}: ${report.scans[kind].issues.length} reported advisories/issues; high-severity gate ${report.scans[kind].passed ? 'passed' : 'failed'}\n`, { mode: 0o600 });
			} catch (error) {
				report.scans[kind] = { status: error.timedOut ? 'timed_out' : 'failed', passed: false, error: error instanceof SyntaxError ? 'Snyk did not return valid JSON evidence; inspect its raw artifact' : error.message, durationMs: Math.round(performance.now() - started), artifact: `snyk/${kind}.json` };
			}
		}
	} catch (error) {
		for (const kind of ['dependencies', 'code']) report.scans[kind] = { status: 'unavailable', passed: false, error: error.message, durationMs: 0 };
	} finally {
		report.passed = Object.keys(report.scans).length === 2 && Object.values(report.scans).every(/** Require both scans to complete below the configured blocking severity. @param {object} scan @returns {boolean} */ (scan) => scan.status === 'completed' && scan.passed);
		report.completedAt = new Date().toISOString();
		await writeFile(join(output, 'snyk.json'), JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
		await rm(scratch, { recursive: true, force: true });
	}
	return report;
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	const result = await runSnyk(resolve(process.env.ANTISLOPSCAN_CI_OUTPUT ?? 'artifacts/ci'), { runId: process.env.ANTISLOPSCAN_CI_RUN_ID });

	process.stdout.write(`Snyk dependency/Code gate ${result.passed ? 'passed' : 'failed'}; inspect snyk.json and snyk/ in the CI evidence folder.\n`);
	if (!result.passed) process.exitCode = 1;
}
