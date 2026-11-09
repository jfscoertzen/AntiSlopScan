/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { PDFDocument } from 'pdf-lib';
import { startJournal, recorded, finishJournal } from '../scripts/ci/journal.mjs';
import { command } from '../scripts/ci/process.mjs';
import { generateCiReport } from '../scripts/ci/report.mjs';

const output = resolve(process.env.ANTISLOPSCAN_TEST_ARTIFACTS ?? 'artifacts/ci/failure-report-fixture');
const temporary = await mkdtemp(join(tmpdir(), 'antislopscan-ci-failure-'));

try {
	await mkdir(output, { recursive: true });
	await writeFile(join(temporary, 'broken.js'), 'const invalid = ;\n');
	await startJournal(output, 'controlled-failure-fixture', ['build', 'backend', 'ui']);
	await assert.rejects(recorded(output, 'build',
		/** Execute a real syntax check that must fail, without evaluating fixture code. @returns {Promise<void>} */
		async () => command(process.execPath, ['--check', join(temporary, 'broken.js')], { log: join(output, 'build.log') })
	));
	const journal = await finishJournal(output);

	assert.equal(journal.passed, false);
	assert.deepEqual(journal.steps.map(/** Inspect observed failure and skips. @param {{status: string}} step @returns {string} */ (step) => step.status), ['failed', 'skipped', 'skipped']);
	await generateCiReport(output);
	const html = await readFile(join(output, 'ci-report.html'), 'utf8');
	const pdf = await PDFDocument.load(await readFile(join(output, 'ci-report.pdf')));
	const status = JSON.parse(await readFile(join(output, 'report-status.json'), 'utf8'));

	assert.match(html, /controlled-failure-fixture/);
	assert.match(html, /failed/);
	assert.match(html, /skipped/);
	assert.ok(pdf.getPageCount() > 0);
	assert.equal(status.pdf, 'completed');
	assert.equal(status.evidenceValid, true);
	process.stdout.write('Failed-run HTML/PDF verification passed.\n');
} finally { await rm(temporary, { recursive: true, force: true }); }
