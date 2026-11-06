/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { expect, test } from 'vitest';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { runAudit } from '../src/orchestrator.js';
import { parseConfig } from '../src/config.js';

const installed = existsSync('tools/bin/antislop') && existsSync('tools/python/bin/semgrep') && (existsSync('node_modules/oxlint') || existsSync('tools/node_modules/oxlint'));

/** Exercise the actual pinned toolchain and verify reported execution, normalization, and credential minimization. */
const adapterContract = async (): Promise<void> => {
	const directory = await mkdtemp(join(tmpdir(), 'antislopscan-adapters-'));
	const source = join(directory, 'repository');
	const output = join(directory, 'reports');
	const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
	let syntheticAwsId = 'AKIA';

	for (const byte of randomBytes(16)) syntheticAwsId += alphabet[byte % alphabet.length];

	try {
		await mkdir(source);
		await writeFile(join(source, 'code.ts'), `// TODO: implement migration\nexport const value = async () => { try { throw new Error('sample'); } catch (error) {} return null; };\nexport const awsAccessKey = '${syntheticAwsId}';\n`);
		await writeFile(join(source, 'sample.py'), 'def calculate(value):\n    return eval(value)\n');
		const commentary = `/*\n${'Repeated placeholder documentation and workaround prose only.\n'.repeat(40)}*/\n`;

		await writeFile(join(source, 'notes-a.ts'), commentary);
		await writeFile(join(source, 'notes-b.ts'), commentary);
		const result = await runAudit(parseConfig({ reports: { formats: ['json'] } }), { source, output });
		const expected = ['systems', 'eslint', 'slopscore', 'oxlint', 'oxlintAntiSlop', 'rustAntiSlop', 'jscpd', 'dependencyCruiser', 'semgrep', 'gitleaks', 'ruff', 'radon'];

		for (const id of expected) {
			let status = '';

			for (const scanner of result.scanners) { if (scanner.id === id) status = scanner.status; }
			expect(status, `${id} must execute rather than silently disappear`).toBe('completed');
		}
		expect(result.scores.coverage).toBe(92);
		expect(result.ci.passed).toBe(false);
		expect(result.ci.exitCode).toBe(1);
		expect(result.findings.some(hasGitleaks)).toBe(true);
		expect(result.findings.some(/** Comment-only markers and clone text are outside code assessment. */ (finding) => ['057', '069', 'slop/unfinished-comment', 'design/duplication'].includes(finding.ruleId))).toBe(false);
		expect(await readFile(join(output, 'report.json'), 'utf8')).not.toContain(syntheticAwsId);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
};


/** Identify actual secret scanner attribution after deduplication. */
const hasGitleaks = (finding: { sources: string[] }): boolean => finding.sources.includes('gitleaks');

test.skipIf(!installed)('all bundled scanners execute and normalize actual JS/TS/Python evidence', adapterContract);
