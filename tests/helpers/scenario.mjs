/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { mkdir, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { command, testEnvironment } from '../../scripts/ci/process.mjs';

/** Run a real isolated scenario with bounded execution and require its completion assertion. @param {string} script @param {string} name @param {string} completion @param {number} [timeoutMs=210000] @returns {Promise<void>} */
export const runScenario = async (script, name, completion, timeoutMs = 210000) => {
	if (!Number.isInteger(timeoutMs) || timeoutMs < 1) throw new Error('Scenario timeout must be a positive integer');
	const output = resolve(process.env.ANTISLOPSCAN_CI_OUTPUT ?? 'artifacts/ci', name);
	const log = join(output, 'scenario.log');

	await mkdir(output, { recursive: true });
	try {
		await command(process.execPath, [script], {
			log, timeoutMs,
			env: { ...testEnvironment(), ANTISLOPSCAN_TEST_ARTIFACTS: output, ANTISLOPSCAN_CI_RUN_ID: process.env.ANTISLOPSCAN_CI_RUN_ID ?? 'standalone' }
		});
		if (!(await readFile(log, 'utf8')).includes(completion)) throw new Error('Scenario did not confirm completion');
	} catch (error) {
		const diagnostics = await readFile(log, 'utf8');

		throw new Error(`${name} failed; diagnostics: ${output}\n${diagnostics.slice(-3000)}`, { cause: error });
	}
};
