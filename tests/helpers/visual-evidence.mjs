/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { visualCases } from '../visual-cases.mjs';

/** Own visual checkpoints for one fixture scenario; require all declared features before reporting completion. @param {string} directory @param {string} scenario @returns {Promise<object>} */
export const visualEvidence = async (directory, scenario) => {
	const expected = visualCases(scenario);
	const manifest = { schemaVersion: 1, scenario, runId: process.env.ANTISLOPSCAN_CI_RUN_ID ?? 'standalone', complete: false, expected: Object.keys(expected), captures: [] };

	await rm(join(directory, 'evidence.json'), { force: true });
	/** Persist partial evidence after each capture so failures retain honest progress. @returns {Promise<void>} */
	const save = async () => writeFile(join(directory, 'evidence.json'), JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });
	await save();
	return {
		/** Capture a verified UI state or focused component; mask credential controls and preserve full-resolution PNGs. @param {import('playwright').Page} page @param {string} id @param {import('playwright').Locator} [target] @returns {Promise<void>} */
		capture: async (page, id, target) => {
			if (!expected[id]) throw new Error(`Undeclared visual checkpoint: ${id}`);
			if (manifest.captures.some(/** Reject accidental duplicate or overwritten screenshots. @param {{id: string}} entry @returns {boolean} */ (entry) => entry.id === id)) throw new Error(`Duplicate visual checkpoint: ${id}`);
			const file = `${id}.png`;
			const options = { path: join(directory, file), animations: 'disabled', mask: [page.locator('input[type="password"]:visible')], maskColor: '#4b5563' };

			if (target) await target.scrollIntoViewIfNeeded();
			const box = target ? await target.boundingBox() : null;

			const bytes = target && box && box.height < 1400 ? await target.screenshot(options) : await page.screenshot(options);
			manifest.captures.push({ id, ...expected[id], file, sha256: createHash('sha256').update(bytes).digest('hex'), pixelWidth: bytes.readUInt32BE(16), pixelHeight: bytes.readUInt32BE(20), viewport: page.viewportSize(), theme: await page.locator('html').getAttribute('data-theme'), capturedAt: new Date().toISOString() });
			await save();
		},
		/** Fail the browser scenario if any tested feature lacks its required screenshot. @returns {Promise<void>} */
		complete: async () => {
			const captured = new Set(manifest.captures.map(/** Read captured checkpoint identifiers. @param {{id: string}} entry @returns {string} */ (entry) => entry.id));
			const missing = manifest.expected.filter(/** Identify missing screenshots. @param {string} id @returns {boolean} */ (id) => !captured.has(id));

			if (missing.length) throw new Error(`Missing visual evidence: ${missing.join(', ')}`);
			manifest.complete = true;
			await save();
		}
	};
};
