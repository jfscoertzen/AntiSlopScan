/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { expect, test } from '@jest/globals';
import { mkdtemp, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startJournal, recorded, finishJournal } from '../scripts/ci/journal.mjs';
import { artifact, mapTests, diagnosticText } from '../scripts/ci/report-data.mjs';
import { renderCiHtml } from '../scripts/ci/report-html.mjs';
import { testInventory } from '../scripts/ci/test-inventory.mjs';

/** Failed preflight must retain the real error and show all unexecuted downstream stages as skipped. @returns {Promise<void>} */
const failedJournal = async () => {
	const directory = await mkdtemp(join(tmpdir(), 'antislopscan-journal-'));

	try {
		await startJournal(directory, 'fixture', ['build', 'backend', 'ui']);
		await expect(recorded(directory, 'build', /** Simulate a compiler failure without invoking a repository script. @returns {Promise<never>} */ async () => { throw new Error('Fixture compiler failure'); })).rejects.toThrow('Fixture compiler failure');
		const result = await finishJournal(directory);

		expect(result.passed).toBe(false);
		expect(result.steps.map(/** Read actual recorded outcomes. @param {{status: string}} step @returns {string} */ (step) => step.status)).toEqual(['failed', 'skipped', 'skipped']);
		expect(result.steps[0].error).toBe('Fixture compiler failure');
	} finally { await rm(directory, { recursive: true, force: true }); }
};


/** Artifact collection must reject traversal, absolute paths, symlink escape and stale/oversized evidence. @returns {Promise<void>} */
const artifactConfinement = async () => {
	const directory = await mkdtemp(join(tmpdir(), 'antislopscan-report-paths-'));

	try {
		await writeFile(join(directory, 'safe.json'), '{}');
		await symlink('/etc/passwd', join(directory, 'escape.json'));
		expect((await artifact(directory, 'safe.json')).toString()).toBe('{}');
		await expect(artifact(directory, '../secret')).rejects.toThrow('traversal');
		await expect(artifact(directory, '/etc/passwd')).rejects.toThrow('Absolute');
		await expect(artifact(directory, 'escape.json')).rejects.toThrow('symlink');
		await expect(artifact(directory, 'safe.json', 1)).rejects.toThrow('limit');
		await expect(artifact(directory, 'safe.json', 100, Date.now() + 60000)).rejects.toThrow('Stale');
	} finally { await rm(directory, { recursive: true, force: true }); }
};


/** Missing Jest outcomes stay not-run and unknown executed tests remain visibly unmapped; diagnostic credentials are masked. @returns {void} */
const resultHonesty = () => {
	const inventory = [{ id: 'one', project: 'backend', title: 'Known case', checks: [] }, { id: 'two', project: 'backend', title: 'Missing case', checks: [] }];
	const result = { testResults: [{ assertionResults: [{ fullName: 'Known case', status: 'failed', duration: 12, failureMessages: ['Bearer fixture-credential'] }, { fullName: 'Unmapped case', status: 'passed', duration: 1 }] }] };
	const mapped = mapTests(result, inventory, 'backend');

	expect(mapped[0].status).toBe('failed');
	expect(mapped[1].status).toBe('not_run');
	expect(mapped[2].unmapped).toBe(true);
	expect(mapped[0].failures[0]).toContain('[redacted]');
	expect(diagnosticText('token=fixture-credential')).not.toContain('fixture-credential');
};


/** Branded HTML must retain failed/skipped state, source assertions and captions while escaping hostile evidence. @returns {void} */
const escapedHtml = () => {
	const model = { journal: { mode: 'fixture', runId: 'fixture', startedAt: '2026-11-09', passed: false, publication: 'Not requested', steps: [{ id: 'build', name: '<script>hostile()</script>', status: 'failed', durationMs: 10, error: '<img src=x onerror=hostile()>' }, { id: 'ui', name: 'UI', status: 'skipped', durationMs: 0 }] }, version: 'fixture', passed: false, cases: [{ id: 'fixture', project: 'backend', title: '<script>test()</script>', file: 'tests/fixture.ts', purpose: 'Fixture only', status: 'failed', durationMs: 1, checks: ['expect(value).toBe(1)'], failures: ['<script>failure()</script>'] }], visuals: [], logs: [], issues: [], coverage: { total: { lines: { pct: '<script>coverage()</script>' }, statements: { pct: 0 }, functions: { pct: 0 }, branches: { pct: 0 } } } };
	const html = renderCiHtml(model, { css: '', mark: '', network: '' });

	expect(html).toContain('antislopscan');
	expect(html).toContain('expect(value).toBe(1)');
	expect(html).toContain('skipped');
	expect(html).toContain('&lt;script&gt;hostile()&lt;/script&gt;');
	expect(html).not.toContain('<script>hostile()');
	expect(html).not.toContain('<script>coverage()');
	expect(html).toContain('&lt;script&gt;coverage()&lt;/script&gt;');
	expect(html).toContain("default-src 'none'");
};


/** Every registered suite must expose its actual assertion source, including delegated frontend scenarios. @returns {Promise<void>} */
const inventoryCompleteness = async () => {
	const inventory = await testInventory();
	const titles = new Set();

	for (const item of inventory) {
		expect(item.purpose.length).toBeGreaterThan(10);
		expect(item.checks.length).toBeGreaterThan(0);
		expect(titles.has(item.title)).toBe(false);
		titles.add(item.title);
	}
	const frontend = inventory.filter(/** Select delegated browser cases. @param {{project: string}} item @returns {boolean} */ (item) => item.project === 'ui');

	expect(frontend).toHaveLength(2);
	expect(frontend[0].evidenceSource).toBe('tests/browser.mjs');
	expect(frontend[1].evidenceSource).toBe('tests/browser-ai.mjs');
};

test('CI journal preserves failure and downstream skips', failedJournal);
test('CI report evidence stays confined, fresh and bounded', artifactConfinement);
test('CI report never invents missing test outcomes or exposes diagnostic credentials', resultHonesty);
test('CI HTML retains real outcomes and escapes hostile evidence', escapedHtml);
test('test inventory covers every registered test and delegated browser assertion', inventoryCompleteness);

/** A real failing syntax check must still produce readable HTML/PDF with failed/skipped stages and no fabricated test passes. @returns {Promise<void>} */
const failureDocuments = async () => {
	const { runScenario } = await import('./helpers/scenario.mjs');

	await runScenario('tests/ci-report-failure.mjs', 'failure-report-fixture', 'Failed-run HTML/PDF verification passed.');
};

test('failed CI runs still produce branded HTML and PDF evidence', failureDocuments, 240000);


/** A browser scenario cannot report completion when a declared feature has no screenshot. @returns {Promise<void>} */
const missingVisualEvidence = async () => {
	const directory = await mkdtemp(join(tmpdir(), 'antislopscan-visual-required-'));
	const { visualEvidence } = await import('./helpers/visual-evidence.mjs');

	try {
		const evidence = await visualEvidence(directory, 'ui-model');

		await expect(evidence.complete()).rejects.toThrow('Missing visual evidence');
		await expect(evidence.capture(undefined, 'undeclared')).rejects.toThrow('Undeclared');
		const manifest = JSON.parse(await readFile(join(directory, 'evidence.json'), 'utf8'));

		expect(manifest.complete).toBe(false);
		expect(manifest.captures).toEqual([]);
		expect(manifest.expected).toContain('citation');
	} finally { await rm(directory, { recursive: true, force: true }); }
};

test('frontend completion requires screenshot evidence for every declared feature', missingVisualEvidence);
