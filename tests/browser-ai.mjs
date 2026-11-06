/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Fastify from 'fastify';
import { chromium } from 'playwright';
import { createServer } from '../dist/server.js';
import { parseConfig } from '../dist/config.js';
import { scannerCatalog } from '../dist/scanners/catalog.js';

const directory = await mkdtemp(join(tmpdir(), 'antislopscan-ai-browser-'));
const sourceRoot = join(directory, 'source');
const provider = Fastify({ logger: false });
const port = Number(process.env.ANTISLOPSCAN_AI_E2E_PORT ?? 31988);
const origin = `http://localhost:${port}`;
const failures = [];
let calls = 0;

/** Emulate an actual structured provider response selecting appliance-assigned evidence IDs. */
const modelResponse = async (request) => {
	const body = request.body;
	const input = JSON.parse(body.messages.at(-1).content);

	calls += 1;
	return {
		choices: [
			{
				finish_reason: 'stop',
				message: {
					content: JSON.stringify({
						assessments: input.principles.map(
							/** Provide a controlled grade only for the fixture's explicitly reviewed principle. */ (
								principle
							) => ({
								principleId: principle.id,
								assessment: principle.id === 'DRY' ? 'supported' : 'not_assessable',
								score: principle.id === 'DRY' ? 90 : null,
								confidence: principle.id === 'DRY' ? 0.8 : 0,
								reasoning:
									'One authoritative value is visible in this bounded source sample; runtime behavior is not established.',
								recommendation:
									'Verify consumers and supply integration contracts before extending the conclusion.',
								evidenceIds: principle.id === 'DRY' ? [input.sourceEvidence[0].id] : []
							})
						)
					})
				}
			}
		]
	};
};

provider.post('/v1/chat/completions', modelResponse);
await mkdir(sourceRoot);
await writeFile(join(sourceRoot, 'a.ts'), 'export const authoritativeValue = 42;\n');
await provider.listen({ host: '127.0.0.1', port: 0 });
const address = provider.server.address();

if (!address || typeof address === 'string') throw new Error('Provider has no TCP address');
const baseUrl = `http://127.0.0.1:${address.port}/v1`;
const scanners = {};

for (const definition of scannerCatalog)
	if (!['ai', 'systems'].includes(definition.id)) scanners[definition.id] = { enabled: false };
const defaults = parseConfig({
	project: { name: 'LLM browser verification' },
	scanners,
	ai: {
		enabled: true,
		provider: 'openai-compatible',
		baseUrl,
		model: 'fixture-model',
		mode: 'architecture',
		allowSourceTransmission: true
	},
	reports: { formats: ['html', 'pdf', 'json', 'sarif'] }
});
const server = await createServer({
	sourceRoot,
	dataDirectory: join(directory, 'data'),
	origin,
	allowAi: true,
	aiBaseUrl: baseUrl,
	aiProvider: 'openai-compatible',
	aiApiKeyEnv: 'AUDIT_AI_API_KEY',
	defaultConfig: defaults
});
const browser = await chromium.launch({
	headless: true,
	chromiumSandbox: process.env.ANTISLOPSCAN_CHROMIUM_SANDBOX !== 'false'
});

/** Record browser exceptions without serializing credentials or submitted source. */
const recordFailure = (failure) => {
	failures.push(failure.message);
};

try {
	await server.listen({ host: '127.0.0.1', port });
	const rejected = await server.inject({
		method: 'POST',
		url: '/api/audits',
		payload: { source: '.', config: { ai: { baseUrl: 'https://unapproved.invalid/v1' } } }
	});

	assert.equal(rejected.statusCode, 400);
	assert.equal(calls, 0);
	const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

	page.on('pageerror', recordFailure);
	await page.goto(origin);
	await page.locator('.ai-settings > summary').click();
	assert.equal(
		await page.getByRole('checkbox', { name: 'Enable LLM architecture assessment', exact: true }).isChecked(),
		true
	);
	assert.equal(await page.getByRole('combobox', { name: 'LLM provider', exact: true }).isDisabled(), true);
	assert.equal(await page.getByLabel('LLM base URL', { exact: true }).getAttribute('readonly'), '');
	await page.getByLabel('LLM model', { exact: true }).fill('fixture-model-v2');
	await page.keyboard.press('Tab');
	await page.getByLabel('Maximum source sample bytes').fill('2048');
	await page.keyboard.press('Tab');
	await page.getByRole('button', { name: 'Run repository audit', exact: true }).click();
	await page.getByRole('heading', { name: 'Where to look first', exact: true }).waitFor({ timeout: 60000 });
	await page
		.getByRole('img', { name: 'LLM architecture sample score: 90 out of 100, higher is better' })
		.waitFor();
	assert.equal(calls, 4);
	assert.equal(await page.locator('.principle-row').count(), 14);
	const dry = page.locator('.principle-row').filter({ hasText: 'Do not repeat yourself' });

	await dry.locator('summary').click();
	await page.waitForFunction(
		/** Wait for the expanded explanation to select the animated asset. */ () =>
			document.querySelector('.principle-explainer img')?.getAttribute('data-animated') === 'true'
	);
	assert.match(await dry.locator('.principle-explainer img').getAttribute('src'), /\.gif$/);
	await page.getByRole('button', { name: 'Pause illustrations', exact: true }).click();
	await page.waitForFunction(
		/** Verify explicit pause swaps the GIF for its static poster. */ () =>
			document.querySelector('.principle-explainer img')?.getAttribute('data-animated') === 'false'
	);
	assert.match(await dry.locator('.principle-explainer img').getAttribute('src'), /poster.*\.png$/);
	await page.getByRole('button', { name: 'Play illustrations', exact: true }).click();
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.waitForFunction(
		/** Verify operating-system reduced motion overrides animation preference. */ () =>
			document.querySelector('.principle-explainer img')?.getAttribute('data-animated') === 'false'
	);
	await page.emulateMedia({ reducedMotion: 'no-preference' });
	await page.getByRole('button', { name: 'Next principles', exact: true }).click();
	assert.equal(await page.locator('.principle-row').count(), 14);
	await page.getByRole('button', { name: 'Previous principles', exact: true }).click();
	await page.getByLabel('Search principles').fill('DRY');
	assert.equal(await page.locator('.principle-row').count(), 1);
	await page.getByRole('combobox', { name: 'Principle assessment', exact: true }).selectOption('unassessed');
	await page.getByText('No principle assessments match these filters.').waitFor();
	await page.getByRole('combobox', { name: 'Principle assessment', exact: true }).selectOption('');
	await page.getByLabel('Search principles').fill('');
	await page.locator('summary[aria-label="Appearance settings"]').click();
	for (const mode of ['light', 'dark']) {
		await page.getByRole('combobox', { name: 'Appearance', exact: true }).selectOption(mode);
		for (const width of [1440, 900, 768, 540, 390, 320]) {
			await page.setViewportSize({ width, height: 1000 });
			assert.equal(
				await page.evaluate(
					/** Check the complete document rather than clipping an overflowing panel. */ () =>
						document.documentElement.scrollWidth > innerWidth
				),
				false,
				`${mode} AI overview at ${width}px`
			);
		}
		await page.setViewportSize({ width: 1440, height: 1100 });
	}
	await page.getByRole('combobox', { name: 'Appearance', exact: true }).focus();
	await page.keyboard.press('Escape');
	await page.getByLabel('Search principles').fill('DRY');
	await page.locator('.principle-row summary').click();
	await page.locator('.principle-citation .text-button').click();
	assert.equal(await page.getByRole('combobox', { name: 'File', exact: true }).inputValue(), 'a.ts');
	const waiting = page.waitForEvent('download');

	await page.getByRole('button', { name: 'JSON', exact: true }).click();
	const download = await waiting;
	const resultPath = join(directory, 'result.json');

	await download.saveAs(resultPath);
	const result = JSON.parse(await readFile(resultPath, 'utf8'));

	assert.equal(result.aiArchitecture.score, 90);
	assert.equal(result.aiArchitecture.model, 'fixture-model-v2');
	assert.equal(result.aiArchitecture.sampledFiles, 1);
	assert.equal(result.scores.overall, 100);
	const html = await fetch(`${origin}/api/audits/${result.id}/reports/html`);

	assert.match(await html.text(), /LLM sample score/);
	assert.deepEqual(failures, []);
	process.stdout.write(
		'LLM browser verification passed: operator pins, GUI model/budget configuration, real structured provider exchange, independent score, sampled coverage, GIF/pause/reduced-motion, principle filters/pagination/citations, six widths in both modes, JSON/HTML evidence, and no browser exceptions.\n'
	);
} finally {
	await browser.close();
	await server.close();
	await provider.close();
	await rm(directory, { recursive: true, force: true });
}
