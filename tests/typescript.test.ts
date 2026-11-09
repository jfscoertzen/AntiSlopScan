/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { expect, test } from '@jest/globals';
import { executeEslint } from '../src/scanners/eslint.js';
import { parseConfig } from '../src/config.js';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { analysisSource } from '../src/analysis/source.js';
import { analyzeAst } from '../src/analysis/ast.js';

/** Verify generic TS syntax is parsed as TypeScript and Vue script locations retain original line numbers. */
const typeScriptContract = async (): Promise<void> => {
	const directory = await mkdtemp(join(tmpdir(), 'antislopscan-typescript-'));

	try {
		await writeFile(join(directory, 'generic.ts'), 'export const values = new Map<string, { count: number }>();\nexport const identity = <T>(value: T): T => value;\n');
		const result = await executeEslint({ snapshot: directory, workDirectory: directory, config: parseConfig({}), inventory: { files: [{ path: 'generic.ts', language: 'typescript', bytes: 100, lines: 2, hash: '' }], languages: ['typescript'], totalBytes: 100, totalLines: 2, visitedEntries: 1, excludedFiles: 0, skippedSymlinks: 0, binaryFiles: 0, documents: [], dependencies: [] } });

		expect(result.findings).toHaveLength(0);
		const extracted = analysisSource('component.vue', '<template>example</template>\n<script setup lang="ts">\nconst answer: number = 42;\n</script>');

		expect(extracted.split('\n')[2]).toContain('const answer');
		expect(extracted).not.toContain('<template>');
		const typeImports = analyzeAst('a.ts', 'import { type Shape } from "./shape";\nexport { type Result } from "./result";\n', parseConfig({}));

		expect(typeImports.imports).toHaveLength(2);
		for (const dependency of typeImports.imports) expect(dependency.typeOnly).toBe(true);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
};

test('TypeScript generics and Vue scripts retain correct parser context and source locations', typeScriptContract);
