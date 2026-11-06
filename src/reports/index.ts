/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { mkdtemp, open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { renderHtml } from './html.js';
import { renderPdf } from './pdf.js';
import { renderSarif } from './sarif.js';
import { evaluateCi } from '../scoring.js';
import { assertAuditResult } from '../result-schema.js';
import type { AuditResult, Config } from '../domain.js';

export class ReportFailure extends Error {
	/** Preserve artifact-generation context while distinguishing operational failure from invalid input. */
	constructor(cause: unknown) { super('Report publication failed; verify output permissions, free space, and the report lock', { cause }); }
}



/** Generate artifacts from the same canonical result; stage writes and record unavailable PDF rendering honestly. */
export const generateReports = async (result: AuditResult, config: Config, output: string, baseline?: AuditResult): Promise<void> => {
	let staging: string | undefined;
	const lockPath = join(output, '.antislopscan-report.lock');
	const lock = await open(lockPath, 'wx', 0o600).catch(reportLockFailure);

	try {
		staging = await mkdtemp(join(output, '.antislopscan-'));
		result.reports = [];
		for (const format of config.reports.formats) result.reports.push({ format, status: 'completed', file: `report.${format === 'sarif' ? 'sarif.json' : format}` });
		result.ci = evaluateCi(result, config, baseline);
		if (config.reports.formats.includes('pdf')) {
			try {
				await renderPdf(result, config, join(staging, 'report.pdf'));
			} catch {
				const pdf = result.reports.find(isPdf);

				if (pdf) { pdf.status = 'failed'; delete pdf.file; pdf.message = 'Bounded PDF generation failed. Verify Chromium, memory, output space, and supported report size; no partial PDF was published.'; }
			}
		}

		result.ci = evaluateCi(result, config, baseline);
		assertAuditResult(result);
		if (config.reports.formats.includes('html')) await writeFile(join(staging, 'report.html'), await renderHtml(result, config), { mode: 0o600 });
		if (config.reports.formats.includes('sarif')) await writeFile(join(staging, 'report.sarif.json'), `${JSON.stringify(renderSarif(result), null, 2)}\n`, { mode: 0o600 });
		if (config.reports.formats.includes('json')) {
			const serialized = JSON.stringify(result, null, 2);

			assertAuditResult(JSON.parse(serialized));
			await writeFile(join(staging, 'report.json'), `${serialized}\n`, { mode: 0o600 });
		}
		for (const report of result.reports) {
			if (report.status === 'completed' && report.file) await rename(join(staging, report.file), join(output, report.file));
			else if (report.status === 'failed') await rm(join(output, `report.${report.format === 'sarif' ? 'sarif.json' : report.format}`), { force: true });
		}
		if (config.reports.formats.includes('json')) assertAuditResult(JSON.parse(await readFile(join(output, 'report.json'), 'utf8')));
	} catch (error) {
		throw new ReportFailure(error);
	} finally {
		try {
			if (staging) await rm(staging, { recursive: true, force: true });
		} finally {
			try { await lock.close(); }
			finally { await rm(lockPath, { force: true }); }
		}
	}
};


/** Convert lock acquisition failures into the artifact failure pathway without deleting another writer's lock. */
const reportLockFailure = (error: unknown): never => { throw new ReportFailure(error); };


/** Locate the PDF artifact status. */
const isPdf = (report: AuditResult['reports'][number]): boolean => report.format === 'pdf';
