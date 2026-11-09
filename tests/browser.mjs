/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { chromium } from 'playwright';
import { visualEvidence } from './helpers/visual-evidence.mjs';
import { availablePort, browserArtifacts, failureEvidence } from './helpers/browser.mjs';
import { createServer } from '../dist/server.js';
import { scannerCatalog } from '../dist/scanners/catalog.js';

const directory = await mkdtemp(join(tmpdir(), 'antislopscan-browser-'));
const sourceRoot = join(directory, 'source');
const token = randomBytes(24).toString('hex');
const port = Number(process.env.ANTISLOPSCAN_E2E_PORT ?? await availablePort());
const failures = [];
const artifacts = await browserArtifacts();
const visual = await visualEvidence(artifacts, 'ui-dashboard');
let tracedContext;

const scanners = {};

for (const definition of scannerCatalog) {
	if (!['systems', 'ai', 'eslint'].includes(definition.id)) scanners[definition.id] = { enabled: false };
}

await mkdir(sourceRoot);
await mkdir(new URL('../artifacts/', import.meta.url), { recursive: true });
await writeFile(join(sourceRoot, 'api.ts'), 'import { helper } from "./helper";\nexport const load = async () => { helper(); try { throw new Error("sample"); } catch (failure) {} return fetch("https://example.invalid"); };\n');
await writeFile(join(sourceRoot, 'helper.ts'), 'export const helper = () => 1;\n');
const additional = [];

for (let index = 0; index < 265; index += 1) additional.push(`export const sample${index} = () => { try { throw new Error("sample"); } catch (failure) {} };`);
await writeFile(join(sourceRoot, 'more.ts'), additional.join('\n'));
const server = await createServer({ sourceRoot, dataDirectory: join(directory, 'data'), origin: `http://localhost:${port}`, token });
const browser = await chromium.launch({ headless: true, chromiumSandbox: process.env.ANTISLOPSCAN_CHROMIUM_SANDBOX !== 'false' });

/** Record browser script exceptions without serializing page content or credentials. @param {Error} failure @returns {void} */
const recordFailure = (failure) => { failures.push(failure.message); };


/** Check actual document geometry at the current responsive viewport. @returns {boolean} */
const overflows = () => document.documentElement.scrollWidth > window.innerWidth;


/** Return the visible focused control's tag for keyboard verification. @returns {string | undefined} */
const focusedTag = () => document.activeElement?.tagName;


/** Return the applied palette without relying on screenshots alone. @returns {string | undefined} */
const appliedTheme = () => document.documentElement.dataset.theme;


/** Inspect the computed palette rather than only the preference attribute. @returns {string} */
const surfaceColor = () => getComputedStyle(document.documentElement).backgroundColor;


/** Read only resolved frontend palette tokens for contrast and saved-accent verification. @returns {Record<string, string>} */
const paletteTokens = () => {
	const style = getComputedStyle(document.documentElement);
	const result = {};

	for (const name of ['paper', 'surface', 'subtle', 'ink', 'muted', 'brand', 'on-brand', 'accent', 'danger', 'minor', 'info', 'success', 'control-line', 'focus']) result[name] = style.getPropertyValue(`--${name}`).trim();
	return result;
};


/** Convert a six-digit palette color to WCAG relative luminance. @param {string} hex @returns {number} */
const luminance = (hex) => {
	assert.match(hex, /^#[a-f0-9]{6}$/i);
	const channels = [];

	for (let offset = 1; offset < 7; offset += 2) {
		const channel = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;

		channels.push(channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
	}
	return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
};


/** Measure contrast without rounding a failing near-threshold result into a pass. @param {string} foreground @param {string} background @returns {number} */
const contrast = (foreground, background) => {
	const first = luminance(foreground);
	const second = luminance(background);

	return (Math.max(first, second) + .05) / (Math.min(first, second) + .05);
};


/** Verify readable text, controls, focus, and primary actions for an actual computed accent/mode combination. @param {Record<string, string>} palette @returns {void} */
const assertContrast = (palette) => {
	for (const surface of ['paper', 'surface', 'subtle']) {
		for (const text of ['ink', 'muted', 'brand', 'accent', 'danger', 'minor', 'info', 'success']) assert.ok(contrast(palette[text], palette[surface]) >= 4.5, `${text} on ${surface}: ${palette[text]} / ${palette[surface]}`);
		assert.ok(contrast(palette['control-line'], palette[surface]) >= 3, `Control contrast on ${surface}`);
		assert.ok(contrast(palette.focus, palette[surface]) >= 3, `Focus contrast on ${surface}`);
	}
	assert.ok(contrast(palette['on-brand'], palette.brand) >= 4.5, 'Primary action text contrast');
};

try {
	await server.listen({ host: '127.0.0.1', port });
	const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
	tracedContext = page.context();
	await tracedContext.tracing.start({ screenshots: true, snapshots: true });
	await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

	page.on('pageerror', recordFailure);
	await page.goto(`http://localhost:${port}`);
	await page.getByText('Appearance settings', { exact: true }).click();
	assert.equal(await page.getByRole('combobox', { name: 'Accent color', exact: true }).inputValue(), 'teal');
	assert.equal(await page.evaluate(appliedTheme), 'dark');
	await page.getByText('Appearance settings', { exact: true }).click();
	assert.match(await page.title(), /^antislopscan /);
	assert.match(await page.locator('.masthead .product').innerText(), /^antislopscan/);
	assert.match(await page.locator('footer').innerText(), /Apache-2.0/);
	assert.doesNotMatch(await page.locator('footer').innerText(), /A&R|areng/i);
	await page.getByRole('alert').waitFor();
	await page.locator('summary[aria-label="Connection"]').click();
	await visual.capture(page, 'connection');
	await page.getByLabel('API bearer token').fill(token);
	await page.getByRole('button', { name: 'Connect', exact: true }).click();
	await page.getByText('Your next audit starts here.').waitFor();
	await visual.capture(page, 'empty');
	await page.getByText('JSON configuration', { exact: true }).click();
	await page.getByLabel('Appliance configuration').fill('{malformed');
	await page.getByRole('button', { name: 'Run repository audit' }).click();
	await page.getByRole('alert').waitFor();
	await visual.capture(page, 'validation');
	await page.getByLabel('Project name').fill('Browser verification');
	await page.getByLabel('Appliance configuration').fill(JSON.stringify({ scanners, reports: { formats: ['html', 'pdf', 'json', 'sarif'] } }));
	await visual.capture(page, 'assessment');
	await page.getByRole('button', { name: 'Run repository audit' }).click();
	await page.getByRole('heading', { name: 'Findings', exact: true }).waitFor({ timeout: 60000 });
	await page.getByRole('heading', { name: 'Catch block discards every failure' }).first().waitFor();
	assert.equal(await page.getByLabel('Severity', { exact: true }).locator('option:checked').innerText(), 'All severities');
	assert.equal(await page.locator('.finding').count(), 50);
	await visual.capture(page, 'findings');
	await page.getByRole('button', { name: 'Next findings', exact: true }).click();
	assert.ok(await page.locator('.finding').count() > 0);
	await visual.capture(page, 'next');
	await page.getByRole('button', { name: 'Previous findings', exact: true }).click();
	await visual.capture(page, 'previous');
	await page.getByLabel('Search evidence').fill('no-such-finding');
	await page.getByText('No findings match these filters.').waitFor();
	await visual.capture(page, 'no-findings');
	await page.getByLabel('Search evidence').fill('');
	await page.getByLabel('Severity', { exact: true }).selectOption('major');
	await page.getByLabel('Category', { exact: true }).selectOption('codeQuality');
	assert.ok(await page.getByRole('heading', { name: 'Catch block discards every failure' }).count() > 0);
	await visual.capture(page, 'severity-category');
	await page.getByLabel('Severity', { exact: true }).selectOption('');
	await page.getByLabel('Category', { exact: true }).selectOption('');
	await page.getByText('Advanced filters', { exact: true }).click();
	await page.getByRole('combobox', { name: 'File', exact: true }).selectOption('api.ts');
	await page.getByRole('combobox', { name: 'Rule', exact: true }).selectOption('errors/empty-catch');
	await page.getByRole('combobox', { name: 'Detection method', exact: true }).selectOption('deterministic');
	await page.getByRole('combobox', { name: 'Scanner', exact: true }).selectOption('systems');
	await page.getByRole('combobox', { name: 'Assessment', exact: true }).selectOption('verified_violation');
	await page.getByRole('combobox', { name: 'Sort evidence', exact: true }).selectOption('confidence');
	await page.getByLabel('Minimum confidence (%)').fill('100');
	assert.equal(await page.locator('.finding').count(), 1);
	await visual.capture(page, 'advanced');
	await page.locator('.finding summary').click();
	await page.getByRole('heading', { name: 'Recommendation', exact: true }).waitFor();
	await page.getByRole('button', { name: 'Copy evidence', exact: true }).click();
	await page.getByText(/Copied evidence for api.ts/).waitFor();
	assert.match(await page.evaluate(/** Read only the clipboard content written by this test's fixture. @returns {Promise<string>} */ () => navigator.clipboard.readText()), /errors\/empty-catch/);
	await visual.capture(page, 'copy', page.locator('.finding').first());
	await page.context().clearPermissions();
	await page.getByRole('button', { name: 'Copy evidence', exact: true }).click();
	await page.getByText('Clipboard access is unavailable. Select and copy the evidence text below.').waitFor();
	await visual.capture(page, 'clipboard-fallback', page.locator('.finding').first());
	await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
	assert.equal(await page.locator('.references a').first().getAttribute('rel'), 'noopener noreferrer');
	const selectionDownload = page.waitForEvent('download');

	await page.getByRole('button', { name: 'Export filtered JSON' }).click();
	const selection = await selectionDownload;
	const selectionPath = join(directory, 'selection.json');

	await selection.saveAs(selectionPath);
	assert.equal(JSON.parse(await readFile(selectionPath, 'utf8')).findings.length, 1);
	await visual.capture(page, 'filtered-export');
	await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
	await page.locator('#dashboard .severity-row').filter({ hasText: 'major' }).click();
	assert.equal(await page.getByLabel('Severity', { exact: true }).inputValue(), 'major');
	await visual.capture(page, 'severity-drill');
	await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
	await page.locator('#dashboard .rank-list').first().getByRole('button').first().click();
	assert.ok(await page.getByRole('combobox', { name: 'Rule', exact: true }).inputValue());
	await visual.capture(page, 'rule-drill');
	await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
	let htmlPath;
	for (const format of ['HTML', 'PDF', 'JSON', 'SARIF']) {
		const downloaded = page.waitForEvent('download');

		await page.getByRole('button', { name: format, exact: true }).click();
		const report = await downloaded;

		assert.equal(await report.failure(), null);
		await visual.capture(page, `export-${format}`);
		if (format === 'HTML') { htmlPath = join(directory, 'report.html'); await report.saveAs(htmlPath); }
	}
	await page.getByText('Scoring methodology', { exact: true }).click();
	await visual.capture(page, 'methodology');
	await page.locator('a[href="#coverage"]').first().click();
	await page.getByRole('heading', { name: 'Scores and scanner coverage' }).waitFor();
	assert.ok(await page.locator('#coverage table tbody tr').count() > 0);
	await visual.capture(page, 'coverage', page.locator('#coverage'));
	await page.getByText('Structural measurements and deltas', { exact: true }).click();
	await visual.capture(page, 'measurements');
	await page.getByText('Resolved dependency relationships (1)', { exact: true }).click();
	await page.getByLabel('Search principles').fill('Holism');
	await page.locator('.principle-row summary').click();
	await page.getByRole('heading', { name: 'Static assessment: informational', exact: true }).waitFor();
	await visual.capture(page, 'principle', page.locator('.principle-row[open]').first());
	await page.getByLabel('Search principles').fill('');
	assert.equal(await page.locator('.graph-node').count(), 3);
	assert.equal(await page.locator('.graph-edges > path').count(), 1);
	await visual.capture(page, 'architecture', page.locator('#architecture'));
	await page.getByLabel('Selected module').selectOption('helper.ts');
	await page.getByText('Advanced filters', { exact: true }).click();
	await page.getByRole('button', { name: 'Inspect file findings', exact: true }).click();
	assert.equal(await page.getByRole('combobox', { name: 'File', exact: true }).isVisible(), true);
	assert.equal(await page.getByRole('combobox', { name: 'File', exact: true }).inputValue(), 'helper.ts');
	await visual.capture(page, 'module');
	await page.getByLabel('Find a module').fill('nonexistent-module');
	await page.getByText('No modules match this path.').waitFor();
	await visual.capture(page, 'no-modules');
	await page.getByLabel('Find a module').fill('api.ts');
	assert.equal(await page.locator('.graph-node').count(), 2);
	await page.getByLabel('Runtime imports only').check();
	assert.equal(await page.locator('.graph-edges > path').count(), 1);
	await visual.capture(page, 'runtime-imports');
	await page.getByLabel('Search principles').fill('Holism');
	assert.equal(await page.locator('.principle-row').count(), 1);
	await page.getByRole('combobox', { name: 'Principle assessment', exact: true }).selectOption('unassessed');
	await page.getByText('No principle assessments match these filters.').waitFor();
	await visual.capture(page, 'no-principles');
	await page.getByRole('combobox', { name: 'Principle assessment', exact: true }).selectOption('');
	await page.getByLabel('Search principles').fill('');
	await page.getByRole('button', { name: 'New assessment', exact: true }).click();
	await page.getByLabel('Project name').waitFor();
	assert.equal(await page.getByLabel('Project name').evaluate(/** Check focus after opening the assessment workflow. @param {HTMLElement} field @returns {boolean} */ (field) => document.activeElement === field), true);
	await visual.capture(page, 'new-assessment');
	await page.getByRole('button', { name: 'Close assessment form', exact: true }).click();
	await page.getByRole('button', { name: /Browser verification/ }).click();
	await page.setViewportSize({ width: 390, height: 1000 });
	await page.getByRole('link', { name: 'Audit history', exact: true }).click();
	await page.getByRole('button', { name: /Browser verification/ }).click();
	await page.waitForFunction(/** Wait for asynchronous history retrieval and rendering to restore repository focus. @returns {boolean} */ () => document.activeElement === document.getElementById('repository-title'));
	await visual.capture(page, 'history-mobile');
	await page.setViewportSize({ width: 1440, height: 1100 });
	await page.getByText('Appearance settings', { exact: true }).click();
	await page.getByLabel('Background motion').uncheck();
	assert.ok(await page.locator('.network-art').evaluate(/** Verify explicit motion pause reaches the rendered hero. @param {HTMLElement} element @returns {boolean} */ (element) => element.classList.contains('is-paused')));
	await visual.capture(page, 'motion-pause');
	await page.getByLabel('Background motion').check();
	await page.evaluate(/** Simulate a document visibility event to exercise the hero's pause lifecycle. @returns {void} */ () => {
		Object.defineProperty(document, 'hidden', { configurable: true, value: true });
		document.dispatchEvent(new Event('visibilitychange'));
	});
	assert.equal(await page.locator('.flow-line').first().evaluate(/** Read the rendered animation pause state. @param {SVGElement} element @returns {string} */ (element) => getComputedStyle(element).animationPlayState), 'paused');
	await visual.capture(page, 'hidden-pause');
	await page.evaluate(/** Restore native visibility and resume optional animation. @returns {void} */ () => {
		delete document.hidden;
		document.dispatchEvent(new Event('visibilitychange'));
	});
	assert.equal(await page.locator('.flow-line').first().evaluate(/** Verify visible-page flow resumes. @param {SVGElement} element @returns {string} */ (element) => getComputedStyle(element).animationPlayState), 'running');
	await visual.capture(page, 'motion-resume');
	await page.emulateMedia({ reducedMotion: 'reduce' });
	assert.equal(await page.locator('.flow-line').first().evaluate(/** Inspect the actual reduced-motion animation style. @param {SVGElement} element @returns {string} */ (element) => getComputedStyle(element).animationName), 'none');
	await visual.capture(page, 'reduced-motion');
	await page.emulateMedia({ reducedMotion: 'no-preference' });
	await page.getByRole('combobox', { name: 'Appearance', exact: true }).focus();
	await page.keyboard.press('Escape');
	assert.equal(await page.locator('.appearance-settings').getAttribute('open'), null);
	await visual.capture(page, 'escape');
	await page.getByText('Appearance settings', { exact: true }).click();
	for (const palette of ['light', 'dark']) {
		await page.getByRole('combobox', { name: 'Appearance', exact: true }).selectOption(palette);
		assert.equal(await page.evaluate(appliedTheme), palette);
		for (const selectedAccent of ['neutral', 'blue', 'violet', 'teal', 'orange', 'rose', 'green']) {
			await page.getByRole('combobox', { name: 'Accent color', exact: true }).selectOption(selectedAccent);
			const tokens = await page.evaluate(paletteTokens);

			assertContrast(tokens);
			assert.equal(tokens.paper, palette === 'light' ? '#f3f5f8' : '#0b111b');
			if (selectedAccent === 'neutral') assert.equal(tokens.brand, palette === 'light' ? '#52525b' : '#b8b8c2');
			for (const width of [1440, 900, 768, 540, 390, 320]) {
				await page.setViewportSize({ width, height: 1000 });
				assert.equal(await page.evaluate(overflows), false, `${palette}/${selectedAccent} overflow at ${width}px`);
				await visual.capture(page, `accent-${palette}-${selectedAccent}-${width}`);
			}
		}
		await page.getByRole('combobox', { name: 'Accent color', exact: true }).selectOption('neutral');
		for (const width of [1440, 900, 768, 540, 390, 320]) {
			await page.setViewportSize({ width, height: 1000 });
			assert.equal(await page.evaluate(overflows), false, `${palette} overflow at ${width}px`);
			await visual.capture(page, `layout-${palette}-${width}`);
		}
		await page.setViewportSize({ width: 1440, height: 1100 });
		await page.screenshot({ path: join(artifacts, `ui-${palette}.png`), fullPage: true });
	}
	await page.getByRole('combobox', { name: 'Accent color', exact: true }).focus();
	await page.keyboard.press('ArrowDown');
	assert.equal(await page.getByRole('combobox', { name: 'Accent color', exact: true }).inputValue(), 'blue');
	await page.reload();
	await page.getByText('Appearance settings', { exact: true }).click();
	assert.equal(await page.evaluate(appliedTheme), 'dark');
	assert.equal(await page.getByRole('combobox', { name: 'Accent color', exact: true }).inputValue(), 'blue');
	await visual.capture(page, 'persist');
	await page.getByRole('combobox', { name: 'Appearance', exact: true }).selectOption('system');
	assert.equal(await page.evaluate(appliedTheme), undefined);
	await page.emulateMedia({ colorScheme: 'light' });
	const lightSurface = await page.evaluate(surfaceColor);
	await visual.capture(page, 'system-light');

	await page.emulateMedia({ colorScheme: 'dark' });
	assert.notEqual(await page.evaluate(surfaceColor), lightSurface);
	assert.equal((await page.evaluate(paletteTokens)).brand, '#8cb8ff');
	await visual.capture(page, 'system-dark');
	await page.evaluate(/** Simulate an invalid persisted preference without introducing untrusted CSS. @returns {void} */ () => { localStorage.setItem('antislopscan-accent', 'url(https://invalid.example)'); });
	await page.reload();
	await page.getByText('Appearance settings', { exact: true }).click();
	assert.equal(await page.getByRole('combobox', { name: 'Accent color', exact: true }).inputValue(), 'neutral');
	await visual.capture(page, 'invalid-accent');
	await page.keyboard.press('Control+Home');
	await page.locator('summary[aria-label="Connection"]').click();
	await page.getByLabel('API bearer token').focus();
	await page.keyboard.press('Tab');
	assert.equal(await page.evaluate(focusedTag), 'BUTTON');
	await visual.capture(page, 'keyboard');
	const report = await browser.newPage();
	const reportRequests = [];

	report.on('pageerror', recordFailure);
	report.on('request', /** Track standalone assets without recording source or credentials. @param {import('playwright').Request} request @returns {void} */ (request) => {
		if (/^https?:/.test(request.url())) reportRequests.push(request.url());
	});
	await report.goto(pathToFileURL(htmlPath).href);
	assert.equal(await report.locator('.report-cover').count(), 1);
	assert.equal(await report.locator('.principle-guide figure').count(), 4);
	assert.equal(await report.locator('.cover-topology').evaluate(/** Verify the embedded artwork decoded successfully. @param {HTMLImageElement} image @returns {boolean} */ (image) => image.complete && image.naturalWidth > 0), true);
	assert.equal(await report.getByRole('combobox', { name: 'Accent color', exact: true }).locator('option').count(), 7);
	await visual.capture(report, 'report-cover');
	await report.getByRole('combobox', { name: 'Accent color', exact: true }).selectOption('violet');
	await report.reload();
	assert.equal(await report.getByRole('combobox', { name: 'Accent color', exact: true }).inputValue(), 'violet');
	await report.getByRole('combobox', { name: 'Appearance', exact: true }).selectOption('dark');
	assert.equal(await report.evaluate(appliedTheme), 'dark');
	await visual.capture(report, 'report-persist');
	assert.equal(await report.locator('[data-finding]:visible').count(), 50);
	await report.getByRole('button', { name: 'Next findings', exact: true }).click();
	await visual.capture(report, 'report-next');
	await report.getByRole('button', { name: 'Reset filters', exact: true }).click();
	await report.getByText('Advanced filters', { exact: true }).click();
	await report.getByRole('combobox', { name: 'Scanner', exact: true }).selectOption('systems');
	await report.getByRole('combobox', { name: 'Method', exact: true }).selectOption('deterministic');
	await report.getByRole('combobox', { name: 'Assessment', exact: true }).selectOption('verified_violation');
	await report.getByRole('combobox', { name: 'Sort findings', exact: true }).selectOption('file');
	assert.ok(await report.locator('[data-finding]:visible').count() > 0);
	await visual.capture(report, 'report-filters');
	await report.getByRole('button', { name: 'Reset filters', exact: true }).click();
	await report.locator('[data-drill="file"][data-value="api.ts"]').click();
	assert.ok(await report.locator('[data-finding]:visible').count() < 50);
	await report.locator('[data-finding]:visible summary').first().click();
	await report.locator('.references a:visible').first().waitFor();
	await visual.capture(report, 'report-drill', report.locator('[data-finding]:visible').first());
	await report.getByLabel('Search findings').fill('no-such-evidence');
	assert.equal(await report.locator('[data-finding]:visible').count(), 0);
	await visual.capture(report, 'report-empty');
	await report.getByRole('button', { name: 'Reset filters', exact: true }).click();
	for (const palette of ['light', 'dark']) {
		await report.getByRole('combobox', { name: 'Appearance', exact: true }).selectOption(palette);
		for (const accent of ['neutral', 'blue', 'violet', 'teal', 'orange', 'rose', 'green']) {
			await report.getByRole('combobox', { name: 'Accent color', exact: true }).selectOption(accent);
			assertContrast(await report.evaluate(paletteTokens));
			await visual.capture(report, `report-accent-${palette}-${accent}`);
		}
		for (const width of [1440, 900, 768, 540, 390, 320]) {
			await report.setViewportSize({ width, height: 1000 });
			assert.equal(await report.evaluate(overflows), false);
			await visual.capture(report, `report-layout-${palette}-${width}`);
		}
	}
	await report.evaluate(/** Exercise safe handling of a malformed saved report accent. @returns {void} */ () => { localStorage.setItem('antislopscan-accent', 'url(https://invalid.example)'); });
	await report.reload();
	assert.equal(await report.getByRole('combobox', { name: 'Accent color', exact: true }).inputValue(), 'neutral');
	await visual.capture(report, 'report-invalid');
	await report.getByRole('combobox', { name: 'Appearance', exact: true }).selectOption('system');
	await report.emulateMedia({ media: 'print', colorScheme: 'dark' });
	assert.equal(await report.evaluate(surfaceColor), 'rgb(255, 255, 255)');
	await visual.capture(report, 'report-print');
	assert.deepEqual(reportRequests, []);
	await report.close();
	assert.deepEqual(failures, []);
	await visual.complete();
	process.stdout.write('Browser verification passed: real audit, filters, evidence copying, all exports, dependency graph and principle drill-down, assessment workflow and mobile history, motion controls, seven saved accents with text/control/focus contrast, keyboard selection, malformed-storage fallback, light/dark/system themes, standalone HTML, and 320/390/540/768/900/1440px overflow checks.\n');
} catch (error) {
	await failureEvidence(tracedContext, artifacts);
	throw error;
} finally {
	await browser.close();
	await server.close();
	await rm(directory, { recursive: true, force: true });
}
