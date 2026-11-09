/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runAudit } from '../../dist/orchestrator.js';

/** Audit outside the source tree, then collect unchanged reports in CI evidence storage; remove temporary output on either outcome. @param {import('../../dist/domain.js').Config} config @param {string} output @param {string} [source] @returns {Promise<import('../../dist/domain.js').AuditResult>} */
export const auditRepository = async (config, output, source = process.cwd()) => {
	const temporary = await mkdtemp(join(tmpdir(), 'antislopscan-ci-audit-'));

	try {
		const result = await runAudit(config, { source, output: temporary });

		await mkdir(output, { recursive: true });
		await cp(temporary, output, { recursive: true });
		return result;
	} finally {
		await rm(temporary, { recursive: true, force: true });
	}
};
