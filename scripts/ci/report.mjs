/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { readFile, writeFile, rm, chmod } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { collectReport } from './report-data.mjs';
import { saveJournal } from './journal.mjs';
import { renderCiHtml } from './report-html.mjs';

/** Generate standalone branded HTML and a printable PDF, including failed runs; report errors never hide the original CI outcome. @param {string} output @returns {Promise<void>} */
export const generateCiReport = async (output) => {
	const model = await collectReport(output);
	const assets = {
		css: (await readFile(new URL('../../assets/theme.css', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('../../assets/ci-report.css', import.meta.url), 'utf8')),
		mark: (await readFile(new URL('../../assets/branding/antislopscan-mark.png', import.meta.url))).toString('base64'),
		network: (await readFile(new URL('../../assets/branding/intelligence/topology-background.png', import.meta.url))).toString('base64')
	};
	const html = renderCiHtml(model, assets);
	const htmlPath = join(output, 'ci-report.html');
	const pdfPath = join(output, 'ci-report.pdf');
	const publication = { runId: model.journal.runId, html: 'completed', pdf: 'pending', evidenceValid: model.issues.length === 0, generatedAt: new Date().toISOString() };
	let browser;
	let timer;

	await rm(pdfPath, { force: true });
	await writeFile(htmlPath, html, { mode: 0o600 });
	try {
		const { chromium } = await import('playwright');

		browser = await chromium.launch({ headless: true, chromiumSandbox: process.env.ANTISLOPSCAN_CHROMIUM_SANDBOX !== 'false' && process.env.CODESENTRY_CHROMIUM_SANDBOX !== 'false', timeout: 30000 });
		const page = await browser.newPage({ javaScriptEnabled: false });

		await page.route('**/*', /** Prevent every network request while rendering local evidence. @param {import('playwright').Route} route @returns {Promise<void>} */ async (route) => route.abort());
		await page.setContent(html.replaceAll('<details', '<details open'), { waitUntil: 'load', timeout: 60000 });
		await page.emulateMedia({ media: 'print' });
		const imagesDecoded = await page.locator('img').evaluateAll(/** Verify embedded evidence decoded instead of printing broken-image placeholders. @param {HTMLImageElement[]} images @returns {boolean} */ (images) => images.every(/** Check one actual image. @param {HTMLImageElement} image @returns {boolean} */ (image) => image.complete && image.naturalWidth > 0));

		if (!imagesDecoded) throw new Error('Embedded CI evidence image failed to decode');
		const deadline = new Promise(/** Bound Chromium PDF printing even if its protocol operation stalls. @param {(value: unknown) => void} _resolve @param {(error: Error) => void} reject @returns {void} */ (_resolve, reject) => {
			timer = setTimeout(/** Terminate the report's print budget. @returns {void} */ () => reject(new Error('CI PDF printing deadline exceeded')), 180000);
		});

		await Promise.race([page.pdf({ path: pdfPath, format: 'A4', printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: '<div style="width:100%;padding:0 48px;font:9px Arial;color:#515f72;display:flex;justify-content:space-between"><span>antislopscan / CI verification</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>' }), deadline]);
		await chmod(pdfPath, 0o600);
		publication.pdf = 'completed';
	} catch (error) {
		publication.pdf = 'failed';
		publication.error = error.message;
		model.issues.push(`PDF generation failed: ${error.message}`);
		model.passed = false;
		await writeFile(htmlPath, renderCiHtml(model, assets), { mode: 0o600 });
	} finally {
		clearTimeout(timer);
		if (browser) await browser.close();
		if (publication.pdf !== 'completed') await rm(pdfPath, { force: true });
		await writeFile(join(output, 'report-status.json'), JSON.stringify(publication, null, 2) + '\n', { mode: 0o600 });
		model.journal.reports = publication;
		model.journal.passed = model.journal.passed && publication.evidenceValid && publication.pdf === 'completed';
		await saveJournal(output, model.journal);
	}
	if (publication.pdf !== 'completed' || model.issues.length) throw new Error('CI report/evidence validation failed; inspect ci-report.html and report-status.json');
	process.stdout.write(`CI HTML/PDF evidence published: ${output}\n`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await generateCiReport(resolve(process.env.ANTISLOPSCAN_CI_OUTPUT ?? 'artifacts/ci'));
