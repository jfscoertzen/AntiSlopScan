/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = join(root, 'tools/vendor/anti-slop/src');
const output = join(root, 'dist/vendor/anti-slop');

/** Transpile trusted vendored rules without executing them; rewrite TS imports and reject syntax diagnostics. @param {string} directory @returns {Promise<void>} */
const compile = async (directory) => {
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name);

		if (entry.isDirectory()) {
			await compile(path);
			continue;
		}
		if (!entry.isFile() || !entry.name.endsWith('.ts') || entry.name.endsWith('.test.ts') || entry.name.endsWith('.d.ts')) continue;
		const result = ts.transpileModule(await readFile(path, 'utf8'), {
			fileName: path,
			reportDiagnostics: true,
			compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext, rewriteRelativeImportExtensions: true },
		});

		for (const diagnostic of result.diagnostics ?? []) {
			if (diagnostic.category === ts.DiagnosticCategory.Error) throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
		}
		const destination = join(output, relative(source, path).replace(/\.ts$/, '.js'));

		await mkdir(dirname(destination), { recursive: true });
		await writeFile(destination, result.outputText);
	}
};

await rm(output, { recursive: true, force: true });
await compile(source);
await copyFile(join(root, 'tools/vendor/anti-slop/LICENSE'), join(output, 'LICENSE'));
await copyFile(join(root, 'tools/vendor/PROVENANCE.json'), join(output, 'PROVENANCE.json'));
await writeFile(join(output, 'NOTICE'), 'JavaScript transpiled from the unmodified MIT-licensed dmmulroy/anti-slop sources. Original source and license are included under tools/vendor/anti-slop; pinned provenance is in PROVENANCE.json.\n');
