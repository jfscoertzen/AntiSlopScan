/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import ts from 'typescript';
import { analysisSource } from '../dist/analysis/source.js';

const files = ['vite.config.ts', 'vitest.config.ts'];
const failures = [];

/** Discover original source files only, excluding generated and third-party dependency trees. @param {string} directory @returns {Promise<void>} */
const discover = async (directory) => {
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name);

		if (entry.isDirectory()) { await discover(path); continue; }
		if (['.js', '.mjs', '.ts', '.vue'].includes(extname(path))) files.push(path);
	}
};

for (const directory of ['src', 'ui', 'assets', 'scripts', 'tests']) await discover(directory);
for (const file of files) {
	const content = analysisSource(file, await readFile(file, 'utf8'));
	const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);

	/** Check every authored callable, including callbacks, for compiler-recognized JSDoc. @param {import('typescript').Node} node @returns {void} */
	const inspect = (node) => {
		if ((ts.isFunctionLike(node) || ts.isConstructorDeclaration(node)) && !ts.isFunctionTypeNode(node) && !ts.isCallSignatureDeclaration(node) && !ts.isConstructSignatureDeclaration(node)) {
			if (!ts.getJSDocCommentsAndTags(node).length) {
				const location = source.getLineAndCharacterOfPosition(node.getStart(source));

				failures.push(`${file}:${location.line + 1}: missing callable JSDoc`);
			}
		}
		ts.forEachChild(node, inspect);
	};

	inspect(source);
}

if (failures.length) { process.stderr.write(`${failures.join('\n')}\n`); process.exitCode = 1; }
else process.stdout.write(`Callable documentation verified in ${files.length} original source files.\n`);
