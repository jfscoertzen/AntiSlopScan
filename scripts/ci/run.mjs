/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { command, testEnvironment } from './process.mjs';
import { startJournal, readJournal, recordStep, finishJournal, applicationSteps } from './journal.mjs';
import { generateCiReport } from './report.mjs';

/** Run gates sequentially, marking later gates skipped after the first failure. @param {{id: string, run: () => Promise<void>}[]} stages @param {(step: object) => Promise<void>} [observe] @returns {Promise<{id: string, status: string, durationMs: number, error?: string}[]>} */
export const executeStages = async (stages, observe) => {
	const results = [];
	let failed = false;

	for (const stage of stages) {
		if (failed) {
			const skipped = { id: stage.id, status: 'skipped', durationMs: 0 };

			results.push(skipped);
			if (observe) await observe(skipped);
			continue;
		}
		const started = performance.now();

		if (observe) await observe({ id: stage.id, status: 'running', startedAt: new Date().toISOString() });
		process.stdout.write(`Starting ${stage.id}\n`);
		try {
			await stage.run();
			results.push({ id: stage.id, status: 'passed', durationMs: Math.round(performance.now() - started) });
		} catch (error) {
			failed = true;
			results.push({ id: stage.id, status: 'failed', durationMs: Math.round(performance.now() - started), error: error.message });
		}
		if (observe) await observe(results.at(-1));
		process.stdout.write(`${stage.id}: ${results.at(-1).status}\n`);
	}
	return results;
};

/** Execute the shared local/GitHub verification plan; never publish or deploy from this runner. @returns {Promise<void>} */
const main = async () => {
	const output = resolve(process.env.ANTISLOPSCAN_CI_OUTPUT ?? 'artifacts/ci');
	const managed = process.env.ANTISLOPSCAN_CI_MANAGED === 'true';
	const journal = managed ? await readJournal(output) : await startJournal(output, 'verification-only', applicationSteps);
	const environment = { ...testEnvironment(), ANTISLOPSCAN_CI_OUTPUT: output, ANTISLOPSCAN_CI_RUN_ID: journal.runId };
	const stages = [];

	await mkdir(output, { recursive: true });
	for (const project of ['backend', 'cli', 'distribution', 'ui']) {
		stages.push({ id: project,
			/** Run one Jest project and reject incomplete or skipped verification. @returns {Promise<void>} */
			run: async () => {
				const args = ['run', `test:${project}`, '--', '--json', '--outputFile', join(output, `${project}.json`)];

				await rm(join(output, `${project}.json`), { force: true });
				if (project === 'backend') args.push('--coverage', '--coverageDirectory', join(output, 'coverage'));
				await command('npm', args, { log: join(output, `${project}.log`), env: environment, timeoutMs: 420000 });
				const result = JSON.parse(await readFile(join(output, `${project}.json`), 'utf8'));

				if (!result.success || result.numPendingTests || result.numTodoTests || !result.numTotalTests) throw new Error(`${project}: failed, skipped, unfinished or empty Jest suite`);
			}
		});
	}
	for (const phase of ['security', 'self-audit', 'snyk']) stages.push({
		id: phase,
		/** Run scanner gates with separate diagnostics and a finite execution budget. @returns {Promise<void>} */
		run: async () => {
			const confirmation = join(output, `${phase}.json`);

			await rm(confirmation, { force: true });
			await command(process.execPath, [`scripts/ci/${phase}.mjs`], {
				log: join(output, `${phase}.log`), env: phase === 'snyk' ? { ...environment, SNYK_TOKEN: process.env.SNYK_TOKEN, SNYK_ORG: process.env.SNYK_ORG } : environment, timeoutMs: phase === 'snyk' ? 1300000 : 900000
			});
			if (JSON.parse(await readFile(confirmation, 'utf8')).passed !== true) throw new Error(`${phase} did not confirm successful completion`);
		}
	});
	const results = await executeStages(stages,
		/** Persist every actual gate transition. @param {object} step @returns {Promise<void>} */
		async (step) => recordStep(output, step)
	);
	const passed = results.every(/** Require every declared gate to pass, including the last self-audit. @param {{status: string}} result @returns {boolean} */ (result) => result.status === 'passed');

	await writeFile(join(output, 'summary.json'), JSON.stringify({ passed, completedAt: new Date().toISOString(), stages: results }, null, 2) + '\n');
	process.stdout.write(`Verification ${passed ? 'passed' : 'failed'}; evidence: ${output}\n`);
	if (!passed) process.exitCode = 1;
	if (!managed) {
		await finishJournal(output);
		try { await generateCiReport(output); }
		catch (error) { process.stderr.write(`CI report failed: ${error.message}\n`); process.exitCode = 1; }
	}
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	await main();
}
