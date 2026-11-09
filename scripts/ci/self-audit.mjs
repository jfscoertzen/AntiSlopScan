/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { auditRepository } from './audit.mjs';
import { parseConfig } from '../../dist/config.js';

const output = resolve(process.env.ANTISLOPSCAN_CI_OUTPUT ?? 'artifacts/ci');
const directory = join(output, 'self-audit');
const config = parseConfig(JSON.parse(await readFile('config/self-audit.json', 'utf8')));

await mkdir(directory, { recursive: true });
await rm(join(output, 'self-audit.json'), { force: true });
config.ai.enabled = false;
config.ci.minimumCoverage = 100;
const result = await auditRepository(config, directory);
const boundaries = result.findings.filter(/** Enforce actual configured architecture boundaries independently of density scoring. @param {import('../../dist/domain.js').Finding} finding @returns {boolean} */ (finding) => finding.ruleId === 'architecture/boundary');

if (!result.ci.passed || boundaries.length) throw new Error('Self-audit failed quality, coverage or architecture gates; inspect its report.json');
await writeFile(join(output, 'self-audit.json'), JSON.stringify({ passed: true, score: result.scores.overall, coverage: result.scores.coverage }) + '\n');
