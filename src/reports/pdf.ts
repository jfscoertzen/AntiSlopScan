/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { writeFile } from 'node:fs/promises';
import { chromium, type Browser } from 'playwright';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { environmentSetting } from '../environment.js';
import type { AuditResult, Config } from '../domain.js';
import { renderHtml, renderPdfAppendix } from './html.js';

const PDF_FINDINGS_PER_SECTION = 250;
const MAX_PDF_FINDINGS = 50000;
const PDF_SECTION_TIMEOUT_MS = 60000;
const PDF_DOCUMENT_TIMEOUT_MS = 600000;

/** Merge appliance-generated sections in order and add consistent global page numbers without PDF JavaScript. */
export const mergePdfParts = async (parts: Uint8Array[], project: string, version: string): Promise<Uint8Array> => {
	const merged = await PDFDocument.create();

	for (const bytes of parts) {
		const document = await PDFDocument.load(bytes);
		const pages = await merged.copyPages(document, document.getPageIndices());

		for (const page of pages) merged.addPage(page);
	}
	if (!merged.getPageCount()) throw new Error('PDF sections contain no pages');
	const font = await merged.embedFont(StandardFonts.Helvetica);
	const pages = merged.getPages();

	for (const [index, page] of pages.entries()) {
		const text = `${index + 1} / ${pages.length}`;

		page.drawLine({ start: { x: 40, y: 33 }, end: { x: page.getWidth() - 40, y: 33 }, thickness: .5, color: rgb(.81, .85, .9) });
		page.drawText('antislopscan / Software intelligence', { x: 40, y: 20, size: 8, font, color: rgb(.32, .37, .45) });
		page.drawText(text, { x: page.getWidth() - 40 - font.widthOfTextAtSize(text, 8), y: 20, size: 8, font, color: rgb(.32, .37, .45) });
	}
	merged.setTitle(`antislopscan audit: ${project}`);
	merged.setAuthor('Stephan Coertzen');
	merged.setCreator(`antislopscan ${version}`);
	return merged.save();
};


/** Render one bounded, fully expanded section with networking and page JavaScript disabled; always release its page. */
const renderSection = async (browser: Browser, html: string): Promise<Buffer> => {
	const page = await browser.newPage({ javaScriptEnabled: false });
	let timer: ReturnType<typeof setTimeout> | undefined;

	try {
		await page.route('**/*', /** Block every external resource request, including malicious evidence references. */ async (route) => { await route.abort(); });
		await page.setContent(html.replace(/<details(?=[\s>])/g, '<details open'), { waitUntil: 'load', timeout: 30000 });
		await page.emulateMedia({ media: 'print' });
		const deadline = new Promise<never>(/** Bound Chromium printing even if its protocol operation stalls. */ (_resolve, reject) => {
			/** Terminate a section that exceeded its print budget. */
			const expired = (): void => reject(new Error('PDF section printing deadline exceeded'));

			timer = setTimeout(expired, PDF_SECTION_TIMEOUT_MS);
		});

		return await Promise.race([page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true }), deadline]);
	} finally {
		clearTimeout(timer);
		await page.close();
	}
};


/** Render complete evidence in bounded sections, merge every page, and publish only the final PDF within a ten-minute budget. */
export const renderPdf = async (result: AuditResult, config: Config, path: string): Promise<void> => {
	if (result.findings.length > MAX_PDF_FINDINGS) throw new Error('PDF evidence exceeds the supported finding count');
	const browser = await chromium.launch({ headless: true, chromiumSandbox: environmentSetting('CHROMIUM_SANDBOX') !== 'false', timeout: 30000 });
	let timer: ReturnType<typeof setTimeout> | undefined;

	/** Own section buffers for this report only and retain canonical totals in the summary. */
	const generate = async (): Promise<void> => {
		const parts: Uint8Array[] = [];
		const split = result.findings.length > PDF_FINDINGS_PER_SECTION;

		parts.push(await renderSection(browser, await renderHtml(result, config, !split)));
		if (split) {
			for (let offset = 0; offset < result.findings.length; offset += PDF_FINDINGS_PER_SECTION) {
				const findings = result.findings.slice(offset, offset + PDF_FINDINGS_PER_SECTION);

				parts.push(await renderSection(browser, await renderPdfAppendix(result, config, findings, offset)));
			}
		}
		await writeFile(path, await mergePdfParts(parts, result.project.name, result.applianceVersion), { mode: 0o600 });
	};

	try {
		const deadline = new Promise<never>(/** Bound the complete report as well as each section. */ (_resolve, reject) => {
			/** Reject a document that exceeded its total rendering budget. */
			const expired = (): void => reject(new Error('PDF document rendering deadline exceeded'));

			timer = setTimeout(expired, PDF_DOCUMENT_TIMEOUT_MS);
		});

		await Promise.race([generate(), deadline]);
	} finally {
		clearTimeout(timer);
		await browser.close();
	}
};
