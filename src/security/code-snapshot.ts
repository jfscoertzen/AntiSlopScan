/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { withoutComments } from '../analysis/comments.js';
import type { AuditContext } from '../domain.js';

/** Create one bounded code-only scanner view; retain original source hashes/locations and never edit the repository. */
export const createCodeSnapshot = async (
	context: AuditContext,
	signal?: AbortSignal
): Promise<void> => {
	const destination = join(context.workDirectory, 'code');
	let codeLines = 0;

	await mkdir(destination, { mode: 0o700 });
	for (const file of context.inventory.files) {
		signal?.throwIfAborted();
		const original = await readFile(join(context.snapshot, file.path), 'utf8');
		const code = withoutComments(file.path, original);
		const target = join(destination, file.path);

		for (const line of code.split('\n')) {
			if (line.trim()) codeLines += 1;
		}
		await mkdir(dirname(target), { recursive: true, mode: 0o700 });
		await writeFile(target, code, { mode: 0o400, flag: 'wx' });
	}
	await chmod(destination, 0o500);
	context.codeSnapshot = destination;
	context.codeLines = codeLines;
};
