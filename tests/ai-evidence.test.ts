/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { expect, test } from '@jest/globals';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectAiEvidence } from '../src/ai/evidence.js';
import { parseConfig } from '../src/config.js';
import type { AuditContext } from '../src/domain.js';

/** Enforce the source/document byte budget and secret redaction at multibyte UTF-8 boundaries. */
const evidenceContract = async (): Promise<void> => {
	const directory = await mkdtemp(join(tmpdir(), 'antislopscan-ai-evidence-'));
	const content = `/**\n * @author Fixture author\n * @license Apache-2.0\n */\n\nexport const password = 'fixture-secret-value';\nexport const symbols = '${'😀'.repeat(500)}';\n`;

	try {
		await writeFile(join(directory, 'a.ts'), content);
		await writeFile(join(directory, 'b.ts'), content);
		const config = parseConfig({ ai: { maxSourceBytes: 1024, maxFiles: 2 } });
		const context: AuditContext = {
			config,
			snapshot: directory,
			workDirectory: directory,
			inventory: {
				files: ['a.ts', 'b.ts'].map(
					/** Describe actual source files without executing them. */ (path) => ({
						path,
						language: 'typescript',
						bytes: Buffer.byteLength(content),
						lines: content.split('\n').length,
						hash: ''
					})
				),
				languages: ['typescript'],
				totalBytes: Buffer.byteLength(content) * 2,
				totalLines: content.split('\n').length * 2,
				visitedEntries: 2,
				excludedFiles: 0,
				skippedSymlinks: 0,
				binaryFiles: 0,
				dependencies: [],
				documents: [{ path: 'ARCHITECTURE.md', content: '界'.repeat(1000) }]
			}
		};
		const input = await collectAiEvidence(context);
		const source = input.samples
			.map(/** Measure exactly the text that can be transmitted. */ (sample) => sample.content)
			.join('');
		const documents = input.documents
			.map(
				/** Include supplied documents in the same transmission budget. */ (document) =>
					document.content
			)
			.join('');

		expect(Buffer.byteLength(source + documents)).toBeLessThanOrEqual(1024);
		expect(source).not.toContain('fixture-secret-value');
		expect(source + documents).not.toContain('\uFFFD');
		expect(source).not.toContain('@license');
		expect(input.samples[0].startLine).toBe(6);
		expect(input.samples).toHaveLength(2);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
};

test('AI source sampling preserves redaction and exact UTF-8 byte limits', evidenceContract);
