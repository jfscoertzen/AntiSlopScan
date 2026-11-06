/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { readFile } from 'node:fs/promises';
import type { AuditContext } from './domain.js';

/** Run an appliance-owned analysis in an isolated process; propagate failures as a nonzero exit. */
const main = async (): Promise<void> => {
	const [operation, contextPath] = process.argv.slice(2);
	const context: AuditContext = JSON.parse(await readFile(contextPath, 'utf8'));

	if (operation === 'systems') {
		const { analyzeRepository } = await import('./analysis/engine.js');

		process.stdout.write(JSON.stringify(await analyzeRepository(context)));
		return;
	}

	if (operation === 'eslint') {
		const { executeEslint } = await import('./scanners/eslint.js');

		process.stdout.write(JSON.stringify(await executeEslint(context)));
		return;
	}

	throw new Error('Unsupported worker operation');
};


/** Emit a safe boundary error without serializing source, configuration, or scanner diagnostics. */
const failed = (): void => { process.stderr.write('antislopscan analysis worker failed\n'); process.exitCode = 2; };

await main().catch(failed);
