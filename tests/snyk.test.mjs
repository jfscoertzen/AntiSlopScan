/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { expect, test } from '@jest/globals';
import { summarizeSnyk } from '../scripts/ci/snyk-results.mjs';
import { runSnyk, snykEnvironment } from '../scripts/ci/snyk.mjs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startJournal, recordStep, finishJournal } from '../scripts/ci/journal.mjs';
import { collectReport } from '../scripts/ci/report-data.mjs';
import { renderCiHtml } from '../scripts/ci/report-html.mjs';

/** A completed dependency scan must retain each path, deduplicate advisories per affected package/version and block high severity even without a fix. @returns {void} */
const dependencyFindings = () => {
	const issue = { id: 'SNYK-JS-FIXTURE-1', name: 'fixture', version: '1.0.0', title: 'Fixture advisory', severity: 'high', fixedIn: [], from: ['application', 'fixture'] };
	const summary = summarizeSnyk('dependencies', { ok: false, dependencyCount: 3, vulnerabilities: [issue, { ...issue, from: ['application', 'other', 'fixture'] }] }, 1);

	expect(summary.status).toBe('completed');
	expect(summary.passed).toBe(false);
	expect(summary.counts).toEqual({ critical: 0, high: 1, medium: 0, low: 0 });
	expect(summary.issues[0].paths).toHaveLength(2);
	expect(summary.issues[0].fixedIn).toEqual([]);
	expect(summary.dependencyCount).toBe(3);
};


/** Code SARIF maps genuine severities and location/flow evidence; a low/medium finding is visible without becoming a high-severity gate failure. @returns {void} */
const codeFindings = () => {
	const location = { physicalLocation: { artifactLocation: { uri: 'src/fixture.ts' }, region: { startLine: 12 } } };
	const body = { version: '2.1.0', runs: [{ tool: { driver: { name: 'SnykCode', rules: [{ id: 'fixture/path', shortDescription: { text: 'Fixture path issue' } }] } }, results: [{ ruleId: 'fixture/path', level: 'warning', message: { text: 'Controlled fixture, not a real product finding.' }, locations: [location], codeFlows: [{ threadFlows: [{ locations: [{ location }] }] }] }] }] };
	const summary = summarizeSnyk('code', body, 1);

	expect(summary.passed).toBe(true);
	expect(summary.counts.medium).toBe(1);
	expect(summary.counts.critical).toBe(0);
	expect(summary.issues[0].location).toBe('src/fixture.ts:12');
	expect(summary.issues[0].trace).toEqual(['src/fixture.ts:12']);
	expect(summarizeSnyk('code', { ...body, runs: [{ ...body.runs[0], results: [] }] }, 0).issues).toEqual([]);
};


/** Authentication/errors, unsupported exits, malformed SARIF, unknown severities and mismatched completion evidence must never pass. @returns {void} */
const failedEvidence = () => {
	expect(/** Simulate a CLI authentication failure. @returns {object} */ () => summarizeSnyk('dependencies', { error: 'fixture authentication failure' }, 2)).toThrow();
	expect(/** Simulate an unsupported project. @returns {object} */ () => summarizeSnyk('code', {}, 3)).toThrow();
	expect(/** Reject malformed Code payloads. @returns {object} */ () => summarizeSnyk('code', { runs: [] }, 0)).toThrow();
	expect(/** Reject a claimed finding exit without findings. @returns {object} */ () => summarizeSnyk('dependencies', { ok: true, vulnerabilities: [] }, 1)).toThrow('disagree');
	expect(/** Reject unknown severity rather than silently lowering it. @returns {object} */ () => summarizeSnyk('dependencies', { ok: false, vulnerabilities: [{ id: 'fixture', name: 'fixture', version: '1', title: 'Fixture', severity: 'unknown', from: [] }] }, 1)).toThrow('severity');
};


/** Only the Snyk scan receives its configured token; other credentials and operator AI settings are excluded. @returns {void} */
const credentialIsolation = () => {
	const environment = snykEnvironment({ SNYK_TOKEN: 'fixture-only', SNYK_ORG: 'fixture-org' });

	expect(environment.SNYK_TOKEN).toBe('fixture-only');
	expect(environment.SNYK_CFG_ORG).toBe('fixture-org');
	expect(environment.DOCKER_TOKEN).toBeUndefined();
	expect(environment.ANTISLOPSCAN_AI_ENABLED).toBeUndefined();
	expect(environment.SNYK_DEBUG).toBeUndefined();
};


/** Missing credentials produce persisted unavailable outcomes for both scans and a failing gate without executing the scanner. @returns {Promise<void>} */
const missingCredentials = async () => {
	const directory = await mkdtemp(join(tmpdir(), 'antislopscan-snyk-credentials-'));

	try {
		const result = await runSnyk(directory, { credentials: {}, runId: 'fixture-run' });
		const stored = JSON.parse(await readFile(join(directory, 'snyk.json'), 'utf8'));

		expect(result.passed).toBe(false);
		expect(stored.runId).toBe('fixture-run');
		expect(stored.scans.dependencies.status).toBe('unavailable');
		expect(stored.scans.code.status).toBe('unavailable');
		expect(stored.scans.code.error).toContain('SNYK_TOKEN');
	} finally { await rm(directory, { recursive: true, force: true }); }
};

test('Snyk dependencies retain all paths and block unpatched high severity', dependencyFindings);
test('Snyk Code retains severity, locations and data flow without inventing a score', codeFindings);
test('Snyk errors and malformed or contradictory evidence fail closed', failedEvidence);
test('Snyk credentials are isolated from other test and provider settings', credentialIsolation);
test('missing Snyk credentials persist unavailable scans and fail the gate', missingCredentials);


/** ESLint's Ajv 6 must use the maintained URI resolver and preserve draft-07 reference validation without hanging on Unicode separators. @returns {Promise<void>} */
const legacySchemaResolver = async () => {
	const { runScenario } = await import('./helpers/scenario.mjs');

	await runScenario('tests/uri-resolver.mjs', 'uri-resolver', 'URI resolver compatibility and bounded Unicode regression passed.', 5000);
};

test('ESLint schema resolver preserves validation and terminates on hostile Unicode paths', legacySchemaResolver);


/** Report generation independently verifies current-run raw scans and rejects forged summaries or reused credentials-era evidence. @returns {Promise<void>} */
const reportEvidenceIntegrity = async () => {
	const directory = await mkdtemp(join(tmpdir(), 'antislopscan-snyk-evidence-'));
	const journal = await startJournal(directory, 'fixture', ['snyk']);
	const dependencies = { ok: true, dependencyCount: 1, vulnerabilities: [] };
	const code = { version: '2.1.0', runs: [{ tool: { driver: { name: 'SnykCode' } }, results: [] }] };
	const report = { passed: true, runId: journal.runId, expectedVersion: 'fixture', version: 'fixture', scans: { dependencies: summarizeSnyk('dependencies', dependencies, 0), code: summarizeSnyk('code', code, 0) } };

	try {
		await mkdir(join(directory, 'snyk'));
		await writeFile(join(directory, 'snyk/dependencies.json'), JSON.stringify(dependencies));
		await writeFile(join(directory, 'snyk/code.json'), JSON.stringify(code));
		await writeFile(join(directory, 'snyk.json'), JSON.stringify(report));
		await recordStep(directory, { id: 'snyk', status: 'passed', durationMs: 10 });
		await finishJournal(directory);
		expect((await collectReport(directory)).issues).toEqual([]);
		report.scans.code.counts.high = 99;
		await writeFile(join(directory, 'snyk.json'), JSON.stringify(report));
		const inconsistent = await collectReport(directory);

		expect(inconsistent.passed).toBe(false);
		expect(inconsistent.issues.join(' ')).toContain('differs from raw');
		report.runId = 'old-run';
		await writeFile(join(directory, 'snyk.json'), JSON.stringify(report));
		expect((await collectReport(directory)).issues.join(' ')).toContain('does not belong to this run');
	} finally { await rm(directory, { recursive: true, force: true }); }
};


/** Branded CI HTML must expose Snyk failures, preserve remediation paths, escape hostile findings and never show unknown measurements as zero. @returns {void} */
const reportPresentation = () => {
	const scan = summarizeSnyk('dependencies', { ok: false, vulnerabilities: [{ id: 'SNYK-JS-FIXTURE-1', name: 'fixture', version: '1', title: '<script>fixture()</script>', severity: 'high', from: ['application', 'fixture'], fixedIn: [] }] }, 1);
	const model = { journal: { steps: [], mode: 'fixture', runId: 'fixture' }, version: 'fixture', passed: false, cases: [], visuals: [], logs: [], issues: [], snyk: { expectedVersion: 'fixture', version: 'fixture', severityThreshold: 'high', passed: false, scans: { dependencies: scan, code: { status: 'unavailable', passed: false, error: 'Fixture service unavailable' } } } };
	const html = renderCiHtml(model, { css: '', mark: '', network: '' });

	expect(html).toContain('Snyk dependency and source security');
	expect(html).toContain('No upstream fixed version reported');
	expect(html).toContain('application → fixture');
	expect(html).toContain('not assessed');
	expect(html).toContain('Fixture service unavailable');
	expect(html).toContain('&lt;script&gt;fixture()&lt;/script&gt;');
	expect(html).not.toContain('<script>fixture()');
	expect(html).toContain('no numeric repository score is invented');
};

test('CI reports validate Snyk raw evidence and reject stale or forged summaries', reportEvidenceIntegrity);
test('CI reports include escaped Snyk findings and explicit unavailable measurements', reportPresentation);
