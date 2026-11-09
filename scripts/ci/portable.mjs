/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { command } from './process.mjs';

const output = resolve(process.env.ANTISLOPSCAN_CI_OUTPUT ?? 'artifacts/ci');
const release = join(output, 'release');
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const directory = await mkdtemp(join(tmpdir(), 'antislopscan-executable-'));
const source = join(directory, 'source');
const report = join(directory, 'reports');
const original = 'export const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];\n';

try {
	await mkdir(source);
	await writeFile(join(source, 'values.ts'), original);
	await writeFile(join(source, 'index.ts'), 'import { values } from "./values.js";\nexport const total = (multiplier: number) => {\n let result = 0;\n for (const item of values) {\n  const scaled = item * multiplier;\n  const remainder = scaled % 3;\n  result += remainder === 0 ? scaled / 3 : scaled - remainder;\n }\n return result;\n};\n');
	const policy = join(directory, 'policy.json');

	await writeFile(policy, JSON.stringify({ scoring: { minimumOverallScore: 0, minimumCategoryScore: 0 }, ci: { failBelowScore: 0, failOnCritical: false } }));
	await command('sha256sum', ['--check', 'SHA256SUMS'], { cwd: release, log: join(output, 'checksums.log') });
	await command('tar', ['-xzf', join(release, `antislopscan-${version}-linux-x64.tar.gz`), '-C', directory], { log: join(output, 'extract.log') });
	await command(join(directory, 'bin/antislopscan'), ['cli', '--profile', 'portable', '--source', source, '--config', policy, '--output', report], { log: join(output, 'executable-audit.log'), timeoutMs: 120000 });
	const result = JSON.parse(await readFile(join(report, 'report.json'), 'utf8'));

	assert.equal(result.ci.passed, true);
	assert.equal(result.scores.coverage, 100);
	assert.equal(await readFile(join(source, 'values.ts'), 'utf8'), original);
	await writeFile(join(output, 'executable.json'), JSON.stringify({ passed: true, version, coverage: result.scores.coverage }) + '\n');
} finally {
	await rm(directory, { recursive: true, force: true });
}
