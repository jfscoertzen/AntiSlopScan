/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { expect, test } from '@jest/globals';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runAudit } from '../src/orchestrator.js';
import { parseConfig } from '../src/config.js';
import { scannerCatalog } from '../src/scanners/catalog.js';
import { assertAuditResult } from '../src/result-schema.js';
import { evaluateCi } from '../src/scoring.js';

/** Build a deterministic core-only test policy; external adapters have a separate real-tool integration test. */
export const corePolicy = () => {
	const scanners: Record<string, { enabled: boolean }> = {};

	for (const definition of scannerCatalog) { if (!['systems', 'ai'].includes(definition.id)) scanners[definition.id] = { enabled: false }; }
	return parseConfig({ scanners, reports: { formats: ['html', 'json', 'sarif'] }, ci: { minimumCoverage: 100 } });
};


/** Exercise analysis, boundary evidence, report safety, immutable inputs, baseline deltas, and CI decisions. */
const auditContract = async (): Promise<void> => {
	const directory = await mkdtemp(join(tmpdir(), 'antislopscan-audit-'));
	const source = join(directory, 'repository');
	const output = join(directory, 'reports');
	const sentinel = join(directory, 'executed');
	const config = corePolicy();

	config.project.name = '<script>alert("injected")</script>';
	config.architecture.boundaries = [{ from: 'a.ts', disallow: ['b.ts'], reason: 'Test architecture contract' }];
	try {
		await mkdir(source);
		const original = 'import { b } from "./b.js";\nexport const a = async () => { try { b(); } catch (error) {} };\n';

		await writeFile(join(source, 'a.ts'), original);
		await writeFile(join(source, 'b.ts'), 'import { a } from "./a.js";\nexport const b = () => a;\n');
		await writeFile(join(source, 'eslint.config.mjs'), `import { writeFileSync } from 'node:fs'; writeFileSync(${JSON.stringify(sentinel)}, 'executed'); export default [];`);
		const first = await runAudit(config, { source, output });

		expect(first.graph.cycles).toHaveLength(1);
		expect(first.findings.some(isBoundary)).toBe(true);
		expect(first.findings.some(isEmptyCatch)).toBe(true);
		expect(first.erosion.basis).toBe('current_structural_risk');
		expect(first.ci.passed).toBe(true);
		expect(await readFile(join(source, 'a.ts'), 'utf8')).toBe(original);
		await expect(stat(sentinel)).rejects.toThrow();
		const html = await readFile(join(output, 'report.html'), 'utf8');

		expect(html).toContain('&lt;script&gt;alert');
		expect(html).not.toContain('<script>alert("injected")</script>');
		expect(html).toContain('data:image/png;base64,');
		expect(html).toContain('Where to look first');
		expect(html).toContain('id="theme"');
		expect(html).toContain('data-finding');
		expect(html).toContain('https://eslint.org/docs/latest/rules/no-empty');
		expect(html).toContain("connect-src 'none'");
		assertAuditResult(JSON.parse(await readFile(join(output, 'report.json'), 'utf8')));
		expect(JSON.parse(await readFile(join(output, 'report.sarif.json'), 'utf8')).version).toBe('2.1.0');
		const lockPath = join(output, '.antislopscan-report.lock');

		await writeFile(lockPath, 'another writer', { flag: 'wx' });
		try {
			await expect(runAudit(config, { source, output })).rejects.toThrow('Report publication');
			expect(JSON.parse(await readFile(join(output, 'report.json'), 'utf8')).id).toBe(first.id);
		} finally {
			await rm(lockPath);
		}
		await writeFile(join(source, 'a.ts'), 'export const a = 1;\n');
		const second = await runAudit(config, { source, output: join(directory, 'second'), baseline: first });

		expect(second.erosion.basis).toBe('historical_comparison');
		expect(second.erosion.deltas.cycles).toBe(-1);
		expect(second.erosion.deltas.boundaryViolations).toBe(-1);
		expect(second.ci.newHighSeverity).toBe(0);
		const unavailablePolicy = structuredClone(config);

		unavailablePolicy.scanners.knip.enabled = true;
		const unavailable = await runAudit(unavailablePolicy, { source, output: join(directory, 'unavailable') });

		expect(unavailable.ci.exitCode).toBe(2);
		expect(unavailable.scores.coverage).toBe(50);
		const ratchetPolicy = structuredClone(config);

		ratchetPolicy.ci.failOnNewHighSeverityFindings = true;
		await writeFile(join(source, 'a.ts'), 'export const execute = (input: string) => eval(input);\n');
		const regression = await runAudit(ratchetPolicy, { source, output: join(directory, 'regression'), baseline: second });

		expect(regression.ci.passed).toBe(false);
		expect(regression.ci.newHighSeverity).toBeGreaterThan(0);
		const repeatedEvidence = structuredClone(regression);

		repeatedEvidence.findings.push({ ...regression.findings[0], id: 'additional-occurrence', line: 2 });
		expect(evaluateCi(repeatedEvidence, ratchetPolicy, regression).newHighSeverity).toBe(1);
		const changedPolicy = structuredClone(config);

		changedPolicy.architecture.maxFanOut += 1;
		await expect(runAudit(changedPolicy, { source, output: join(directory, 'mismatch'), baseline: first })).rejects.toThrow('Baseline');
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
};


/** Identify an explicit boundary violation for the regression assertion. */
const isBoundary = (finding: { ruleId: string }): boolean => finding.ruleId === 'architecture/boundary';


/** Identify an AST-confirmed empty catch. */
const isEmptyCatch = (finding: { ruleId: string }): boolean => finding.ruleId === 'errors/empty-catch';

test('audits preserve source and report supported structure and historical change', auditContract);
