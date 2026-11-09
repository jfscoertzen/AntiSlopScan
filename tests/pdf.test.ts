/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { expect, test } from '@jest/globals';
import { PDFDocument } from 'pdf-lib';
import { mergePdfParts } from '../src/reports/pdf.js';

/** Verify generated sections retain every page in order and carry safe document metadata. */
const mergeContract = async (): Promise<void> => {
	const first = await PDFDocument.create();
	const second = await PDFDocument.create();

	first.addPage([400, 600]);
	first.addPage([410, 610]);
	second.addPage([420, 620]);
	const merged = await PDFDocument.load(await mergePdfParts([await first.save(), await second.save()], 'Actual audit', '1.0.0'));

	expect(merged.getPageCount()).toBe(3);
	expect(merged.getPages().map(/** Distinguish each input page to verify merge order. */ (page) => page.getWidth())).toEqual([400, 410, 420]);
	expect(merged.getTitle()).toBe('antislopscan audit: Actual audit');
	await expect(mergePdfParts([new Uint8Array([0, 1, 2])], 'Invalid', '1.0.0')).rejects.toThrow();
	await expect(mergePdfParts([], 'Empty', '1.0.0')).rejects.toThrow('no pages');
};

test('PDF sections merge without losing or reordering pages', mergeContract);
