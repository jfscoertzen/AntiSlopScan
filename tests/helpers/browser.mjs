/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { createServer } from 'node:net';
import { once } from 'node:events';
import { mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';

/** Select a loopback ephemeral port instead of assuming a shared fixed test port is free. @returns {Promise<number>} */
export const availablePort = async () => {
	const reservation = createServer();

	reservation.listen(0, '127.0.0.1');
	await once(reservation, 'listening');
	const address = reservation.address();

	if (!address || typeof address === 'string') throw new Error('No test port was allocated');
	reservation.close();
	await once(reservation, 'close');
	return address.port;
};

/** Resolve fixture-only evidence storage without using the user's audit/report directories. @returns {Promise<string>} */
export const browserArtifacts = async () => {
	const directory = resolve(process.env.ANTISLOPSCAN_TEST_ARTIFACTS ?? 'artifacts/ci/ui');

	await mkdir(directory, { recursive: true });
	return directory;
};

/** Preserve the failing fixture's screenshot and trace without hiding its original exception. @param {import('playwright').BrowserContext | undefined} context @param {string} directory @returns {Promise<void>} */
export const failureEvidence = async (context, directory) => {
	if (!context) return;
	for (const [index, page] of context.pages().entries()) {
		await page.screenshot({ path: join(directory, `failure-${index}.png`), mask: [page.locator('input[type="password"]:visible')], maskColor: '#4b5563' }).catch(
			/** Report unavailable evidence without hiding the primary assertion. @param {Error} error @returns {void} */
			(error) => { process.stderr.write(`Screenshot unavailable: ${error.name}\n`); }
		);
	}
	await context.tracing.stop({ path: join(directory, 'trace.zip') }).catch(
		/** Retain the assertion failure if Chromium cannot finish a trace. @param {Error} error @returns {void} */
		(error) => { process.stderr.write(`Trace unavailable: ${error.name}\n`); }
	);
};
