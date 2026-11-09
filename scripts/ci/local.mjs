/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { resolve, join } from 'node:path';
import { command, testEnvironment } from './process.mjs';
import { startJournal, recorded, finishJournal, applicationSteps } from './journal.mjs';
import { generateCiReport } from './report.mjs';

const output = resolve(process.env.ANTISLOPSCAN_CI_OUTPUT ?? 'artifacts/ci');
const preflight = [['build', 'build'], ['test-types', 'check:tests'], ['documentation', 'check:docs'], ['test-documentation', 'check:testing'], ['package', 'package:built']];
const journal = await startJournal(output, 'native', [...preflight.map(/** Extract preflight identifiers. @param {string[]} step @returns {string} */ (step) => step[0]), ...applicationSteps]);
const environment = { ...testEnvironment(), ANTISLOPSCAN_CI_OUTPUT: output, ANTISLOPSCAN_CI_RUN_ID: journal.runId, ANTISLOPSCAN_CI_MANAGED: 'true' };

try {
	for (const [id, script] of preflight) await recorded(output, id,
		/** Run this actual npm preflight command with its own bounded log. @returns {Promise<void>} */
		async () => command('npm', ['run', script], { log: join(output, `${id}.log`), env: environment, timeoutMs: 420000 })
	);
	await command(process.execPath, ['scripts/ci/run.mjs'], { log: join(output, 'verification.log'), env: { ...environment, SNYK_TOKEN: process.env.SNYK_TOKEN, SNYK_ORG: process.env.SNYK_ORG }, timeoutMs: 3600000 });
} catch (error) {
	process.stderr.write(`${error.message}\n`);
	process.exitCode = 1;
} finally {
	await finishJournal(output);
	try { await generateCiReport(output); }
	catch (error) { process.stderr.write(`CI report failed: ${error.message}\n`); process.exitCode = 1; }
}
