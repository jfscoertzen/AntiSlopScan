/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { appendFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const output = resolve(process.env.ANTISLOPSCAN_CI_OUTPUT ?? 'artifacts/ci');
if (process.env.GITHUB_STEP_SUMMARY) {
	const journal = JSON.parse(await readFile(join(output, 'pipeline.json'), 'utf8'));
	const url = process.env.CI_REPORT_ARTIFACT_URL;
	const report = journal.reports;
	const passed = journal.passed && report?.runId === journal.runId && report.pdf === 'completed' && report.evidenceValid;
	let text = `## AntiSlopScan CI verification\n\nOutcome: **${passed ? 'passed' : 'failed'}**. The report includes individual assertions, scanner results and screenshot evidence.\n\n`;

	if (url && /^https:\/\/github\.com\//.test(url)) text += `[Download branded HTML/PDF reports](${url})\n\n`;
	text += '| Gate | Outcome | Seconds |\n| --- | --- | --- |\n';
	for (const step of journal.steps) text += `| ${step.name.replaceAll('|', '\\|')} | ${step.status} | ${(step.durationMs / 1000).toFixed(2)} |\n`;
	text += '\nDownload verification-evidence for raw JSON, manifests, full-resolution PNGs and logs. Publication is a separate release job; verification does not claim that it executed.\n';
	await appendFile(process.env.GITHUB_STEP_SUMMARY, text);
}
