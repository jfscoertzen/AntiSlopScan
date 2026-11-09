/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { join } from 'node:path';
import { readSource } from './security/snapshot.js';
import type { AuditContext } from './domain.js';

const MAX_CONTEXT_BYTES = 64 * 1024 * 1024;

/** Read only the private bounded regular context file and run appliance-owned analysis; reject invalid paths/data and propagate failures as a nonzero exit. */
const main = async (): Promise<void> => {
	const [operation, contextPath] = process.argv.slice(2);
	const directory = process.cwd();

	if (contextPath !== join(directory, 'context.json')) throw new Error('Worker context must belong to its private working directory');
	const content = await readSource(directory, 'context.json', MAX_CONTEXT_BYTES);

	if (content === null) throw new Error('Worker context must be UTF-8 JSON');
	const context: AuditContext = JSON.parse(content);

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
