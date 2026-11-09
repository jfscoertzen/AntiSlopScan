/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { mkdir, readFile, realpath, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { command, testEnvironment } from './process.mjs';
import { startJournal, recorded, finishJournal, applicationSteps } from './journal.mjs';
import { generateCiReport } from './report.mjs';

const root = await realpath(process.cwd());
const output = resolve(process.env.ANTISLOPSCAN_CI_OUTPUT ?? 'artifacts/ci');
const image = 'antislopscan:ci';
const environment = testEnvironment();
const container = `antislopscan-ci-${process.pid}`;
const journal = await startJournal(output, 'docker', ['build', ...applicationSteps, 'container-cleanup', 'archives', 'executable']);
let built = false;

try {
	process.stdout.write(`Building the test appliance; log: ${join(output, 'build.log')}\n`);
	await recorded(output, 'build',
		/** Build the exact image that later gates and release assembly consume. @returns {Promise<void>} */
		async () => command('docker', ['build', '--platform', 'linux/amd64', '-t', image, '.'], { log: join(output, 'build.log'), env: environment, timeoutMs: 1800000 })
	);
	built = true;
	await mkdir(output, { recursive: true });
	await rm(join(output, 'summary.json'), { force: true });
	await rm(join(output, 'executable.json'), { force: true });
	const args = [
		'run', '--name', container, '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
		'--pids-limit', '512', '--memory', '6g', '--cpus', '4',
		'--tmpfs', '/tmp:size=2147483648,mode=1777,exec',
		'--user', `${process.getuid()}:${process.getgid()}`,
		'--mount', `type=bind,source=${output},target=/evidence`,
		'--mount', `type=bind,source=${root}/.git,target=/app/.git,readonly`,
		'--env', 'ANTISLOPSCAN_CI_OUTPUT=/evidence', '--env', 'ANTISLOPSCAN_CI_MANAGED=true',
		'--env', `ANTISLOPSCAN_CI_RUN_ID=${journal.runId}`, '--env', 'ANTISLOPSCAN_CHROMIUM_SANDBOX=false',
		'--env', 'SNYK_TOKEN', '--env', 'SNYK_ORG',
		'--env', 'npm_config_cache=/tmp/npm-cache', '--entrypoint', 'node', image, 'scripts/ci/run.mjs'
	];

	process.stdout.write(`Running ordered verification; log: ${join(output, 'verification.log')}\n`);
	try {
		await command('docker', args, { log: join(output, 'verification.log'), env: { ...environment, SNYK_TOKEN: process.env.SNYK_TOKEN, SNYK_ORG: process.env.SNYK_ORG }, timeoutMs: 3600000 });
	} finally {
		await recorded(output, 'container-cleanup',
			/** Remove the owned container even if its client timed out. @returns {Promise<void>} */
			async () => {
				try { await command('docker', ['rm', '--force', container], { log: join(output, 'container-cleanup.log'), env: environment, timeoutMs: 30000 }); }
				catch (error) {
					if (!/no such container/i.test(await readFile(join(output, 'container-cleanup.log'), 'utf8'))) throw error;
				}
			}
		);
	}
	if (JSON.parse(await readFile(join(output, 'summary.json'), 'utf8')).passed !== true) throw new Error('Verification did not confirm all gates');
	await recorded(output, 'archives',
		/** Assemble archives only after all functional/security gates passed. @returns {Promise<void>} */
		async () => command('sh', ['scripts/create-release.sh', image, join(output, 'release')], { log: join(output, 'archives.log'), env: environment, timeoutMs: 180000 })
	);
	await recorded(output, 'executable',
		/** Validate checksums and the real extracted executable. @returns {Promise<void>} */
		async () => {
			await command(process.execPath, ['scripts/ci/portable.mjs'], { log: join(output, 'executable.log'), env: { ...environment, ANTISLOPSCAN_CI_OUTPUT: output }, timeoutMs: 180000 });
			if (JSON.parse(await readFile(join(output, 'executable.json'), 'utf8')).passed !== true) throw new Error('Executable verification did not confirm completion');
		}
	);
} catch (error) {
	process.stderr.write(`${error.message}\n`);
	process.exitCode = 1;
} finally {
	const result = await finishJournal(output);

	try {
		if (built) await command('docker', [
			'run', '--rm', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
			'--memory', '4g', '--pids-limit', '256', '--tmpfs', '/tmp:size=1073741824,mode=1777',
			'--user', `${process.getuid()}:${process.getgid()}`, '--mount', `type=bind,source=${output},target=/evidence`,
			'--env', 'ANTISLOPSCAN_CI_OUTPUT=/evidence', '--env', 'ANTISLOPSCAN_CHROMIUM_SANDBOX=false',
			'--entrypoint', 'node', image, 'scripts/ci/report.mjs'
		], { log: join(output, 'reporting.log'), env: environment, timeoutMs: 300000 });
		else await generateCiReport(output);
	} catch (error) {
		process.stderr.write(`CI report failed: ${error.message}\n`);
		process.exitCode = 1;
	}
	if (!result.passed) process.exitCode = 1;
	process.stdout.write(`Verification ${process.exitCode ? 'failed' : 'passed'}; HTML/PDF and evidence: ${output}\n`);
}
