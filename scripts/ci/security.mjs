/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { auditRepository } from './audit.mjs';
import { parseConfig } from '../../dist/config.js';
import { scannerCatalog } from '../../dist/scanners/catalog.js';
import { command, testEnvironment } from './process.mjs';

const output = resolve(process.env.ANTISLOPSCAN_CI_OUTPUT ?? 'artifacts/ci');
const reportDirectory = join(output, 'sast');
const scanners = {};

await mkdir(reportDirectory, { recursive: true });
await rm(join(output, 'security.json'), { force: true });
for (const scanner of scannerCatalog) {
	if (!['systems', 'ai'].includes(scanner.id)) scanners[scanner.id] = { enabled: ['eslint', 'semgrep'].includes(scanner.id) };
}
const config = parseConfig({
	scanners, ai: { enabled: false },
	audit: { exclude: ['**/node_modules/**', '**/dist/**', '**/artifacts/**', '**/tools/**', '**/tests/**', '**/.npm-cache/**'], failOnScannerError: true },
	reports: { formats: ['json', 'sarif'] },
	scoring: { minimumOverallScore: 0, minimumCategoryScore: 0 },
	ci: { failBelowScore: 0, failOnCritical: true, minimumCoverage: 100 }
});
const result = await auditRepository(config, reportDirectory);
const securityViolations = result.findings.filter(
	/** Block high-severity security evidence independently of score-density thresholds. @param {import('../../dist/domain.js').Finding} finding @returns {boolean} */
	(finding) => finding.category === 'security' && ['critical', 'major'].includes(finding.severity)
);

if (!result.ci.passed || securityViolations.length) throw new Error('SAST failed; inspect artifacts/ci/sast/report.json');
let hasHistory = false;
try { await access('.git'); hasHistory = true; }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const environment = { ...testEnvironment(), GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'safe.directory', GIT_CONFIG_VALUE_0: process.cwd() };
const args = [hasHistory ? 'git' : 'dir', '.', '--config', 'config/gitleaks.toml', '--no-banner', '--redact', '--report-format', 'sarif', '--report-path', join(reportDirectory, 'secrets.sarif')];

if (hasHistory) args.push('--log-opts=--all');
await command(resolve('tools/bin/gitleaks'), args, { log: join(output, 'secrets.log'), env: environment });
if (!Array.isArray(JSON.parse(await readFile(join(reportDirectory, 'secrets.sarif'), 'utf8')).runs)) throw new Error('Secret scan did not produce SARIF');
await command(resolve('tools/bin/gitleaks'), [
	'dir', '.', '--config', 'config/gitleaks-ci.toml', '--no-banner', '--redact',
	'--report-format', 'sarif', '--report-path', join(reportDirectory, 'working-tree.sarif')
], { log: join(output, 'working-tree-secrets.log'), env: environment });
if (!Array.isArray(JSON.parse(await readFile(join(reportDirectory, 'working-tree.sarif'), 'utf8')).runs)) throw new Error('Working-tree secret scan did not produce SARIF');
await command('npm', ['audit', '--include=dev', '--audit-level=high', '--json'], { log: join(output, 'dependencies.json'), timeoutMs: 120000 });
const dependencies = JSON.parse(await readFile(join(output, 'dependencies.json'), 'utf8'));

if (!dependencies.metadata?.vulnerabilities || dependencies.error) throw new Error('Dependency advisory service did not return a valid audit');
await writeFile(join(output, 'security.json'), JSON.stringify({ passed: true, advisoryCounts: dependencies.metadata.vulnerabilities }) + '\n');
