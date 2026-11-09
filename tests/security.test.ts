/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { expect, test } from '@jest/globals';
import { chmod, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseConfig } from '../src/config.js';
import { createSnapshot } from '../src/security/snapshot.js';
import { runProcess } from '../src/security/process.js';
import { fromSarif } from '../src/scanners/normalize.js';
import { deduplicate, makeFinding } from '../src/findings.js';
import { applyFindingPolicy } from '../src/orchestrator.js';
import type { AuditContext, ScannerResult } from '../src/domain.js';

/** Verify snapshots skip symlinks, private metadata, caches, and executable configuration while preserving bounded source. */
const snapshotContract = async (): Promise<void> => {
	const directory = await mkdtemp(join(tmpdir(), 'antislopscan-security-'));
	const source = join(directory, 'repository');
	const snapshot = join(directory, 'snapshot');

	try {
		await mkdir(source);
		await writeFile(join(source, 'code.ts'), 'export const answer = 42;\n');
		await writeFile(join(source, 'tsconfig.json'), '{"extends":"/etc/passwd"}');
		await symlink('/etc/passwd', join(source, 'escaped.ts'));
		await symlink('/etc', join(source, 'escaped-directory'));
		for (const metadataDirectory of ['.codex', '.agents', '.aws', '.npm-cache']) {
			await mkdir(join(source, metadataDirectory));
			await writeFile(join(source, metadataDirectory, 'private.ts'), 'export const privateMetadata = true;\n');
		}
		const inventory = await createSnapshot(source, snapshot, parseConfig({}));

		expect(inventory.files.length).toBe(1);
		expect(inventory.skippedSymlinks).toBe(2);
		expect(await readFile(join(snapshot, 'code.ts'), 'utf8')).toContain('answer');
		await expect(readFile(join(snapshot, 'tsconfig.json'))).rejects.toThrow();
		await expect(createSnapshot(source, join(directory, 'private-document'), parseConfig({ architecture: { documents: ['.aws/private.ts'] } }))).rejects.toThrow('private metadata');
		await symlink(join(source, '.aws'), join(source, 'aliased-private-directory'));
		await expect(createSnapshot(source, join(directory, 'aliased-document'), parseConfig({ architecture: { documents: ['aliased-private-directory/private.ts'] } }))).rejects.toThrow('private metadata');
	} finally {
		await chmod(snapshot, 0o700).catch(ignoreMissing);
		await chmod(join(directory, 'private-document'), 0o700).catch(ignoreMissing);
		await chmod(join(directory, 'aliased-document'), 0o700).catch(ignoreMissing);
		await rm(directory, { recursive: true, force: true });
	}
};


/** Verify oversize files and traversal limits fail visibly instead of silently reducing coverage. */
const snapshotLimits = async (): Promise<void> => {
	const directory = await mkdtemp(join(tmpdir(), 'antislopscan-limits-'));
	const source = join(directory, 'repository');

	try {
		await mkdir(source);
		await writeFile(join(source, 'code.ts'), 'x'.repeat(2048));
		await expect(createSnapshot(source, join(directory, 'snapshot'), parseConfig({ audit: { maxFileBytes: 1024 } }))).rejects.toThrow('maxFileBytes');
		await expect(createSnapshot(source, join(directory, 'snapshot-entries'), parseConfig({ audit: { maxEntries: 1 } }))).resolves.toBeDefined();
		await writeFile(join(source, 'more.ts'), 'export const next = 1;');
		await expect(createSnapshot(source, join(directory, 'snapshot-overflow'), parseConfig({ audit: { maxEntries: 1 } }))).rejects.toThrow('maxEntries');
	} finally {
		await chmod(join(directory, 'snapshot-entries'), 0o700).catch(ignoreMissing);
		await rm(directory, { recursive: true, force: true });
	}
};


/** Verify scanner deadlines and output bounds produce explicit failures and reap the child process. */
const processLimits = async (): Promise<void> => {
	const directory = await mkdtemp(join(tmpdir(), 'antislopscan-process-'));

	try {
		await expect(runProcess('worker', ['systems', join(directory, 'missing.json')], directory, { timeoutMs: 1, maxOutputBytes: 1024, memoryMb: 128 })).rejects.toMatchObject({ status: 'timed_out' });
		await expect(runProcess('slopscore', ['--help'], directory, { timeoutMs: 10000, maxOutputBytes: 32, memoryMb: 128 })).rejects.toMatchObject({ status: 'failed' });
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
};


/** Verify malformed SARIF cannot be treated as an empty successful analysis. */
const outputContract = (): void => {
	expect(/** Attempt normalization of structurally invalid scanner output. */ () => fromSarif({ version: '2.1.0', runs: [{ results: 'broken' }] }, 'oxlint', {} as never)).toThrow();
};


/** Verify stronger deterministic evidence survives a higher-severity heuristic overlap. */
const deduplicationContract = (): void => {
	const verified = makeFinding({ ruleId: 'errors/empty-catch', category: 'codeQuality', severity: 'major', file: 'a.ts', line: 3, message: 'Empty catch', evidence: 'AST catch has zero statements', recommendation: 'Propagate the failure.' });
	const heuristic = makeFinding({ ruleId: '053', scanner: 'slopscore', category: 'slop', severity: 'critical', file: 'a.ts', line: 3, message: 'Possible empty catch', evidence: 'Regex match', recommendation: 'Review it.', method: 'heuristic', assessment: 'potential_risk' });
	const results = deduplicate([verified, heuristic]);

	expect(results).toHaveLength(1);
	expect(results[0].assessment).toBe('verified_violation');
	expect(results[0].category).toBe('codeQuality');
	expect(results[0].severity).toBe('critical');
	expect(results[0].sources).toContain('slopscore');
};

test('source snapshot rejects symlink escape and config discovery', snapshotContract);
test('source inventory limits fail visibly', snapshotLimits);
test('subprocess timeout and output caps are enforced', processLimits);
test('malformed scanner output is rejected', outputContract);
test('deduplication preserves strongest assessment and provenance', deduplicationContract);


/** Scanner evidence may read only inventoried regular snapshot files; traversal, unlisted files and symlinks must fail before snippets are exposed. */
const findingEvidenceBoundary = async (): Promise<void> => {
	const directory = await mkdtemp(join(tmpdir(), 'antislopscan-finding-paths-'));
	const snapshot = join(directory, 'snapshot');
	const context: AuditContext = { snapshot, workDirectory: directory, config: parseConfig({ reports: { includeSourceSnippets: true } }), inventory: { files: [{ path: 'code.ts', language: 'typescript', bytes: 25, lines: 1, hash: '' }], languages: ['typescript'], totalBytes: 25, totalLines: 1, visitedEntries: 1, excludedFiles: 0, skippedSymlinks: 0, binaryFiles: 0, documents: [], dependencies: [] } };
	/** Produce isolated findings because policy processing consumes each scanner's finding array. */
	const scanner = (file: string): ScannerResult => ({ id: 'systems', name: 'Systems', version: 'fixture', status: 'completed', durationMs: 0, analyzedFiles: 1, findings: [makeFinding({ file, ruleId: 'fixture/path', category: 'codeQuality', severity: 'minor', message: 'Fixture evidence', evidence: 'Fixture only', recommendation: 'Review the fixture.' })] });

	try {
		await mkdir(snapshot);
		await writeFile(join(snapshot, 'code.ts'), 'export const answer = 42;');
		await writeFile(join(directory, 'outside.ts'), 'private fixture content');
		await writeFile(join(snapshot, 'unlisted.ts'), 'unlisted fixture content');
		expect((await applyFindingPolicy([scanner('code.ts')], context))[0].snippet).toContain('answer = 42');
		await expect(applyFindingPolicy([scanner('../outside.ts')], context)).rejects.toThrow();
		await expect(applyFindingPolicy([scanner('unlisted.ts')], context)).rejects.toThrow('inventory');
		await rm(join(snapshot, 'code.ts'));
		await symlink(join(directory, 'outside.ts'), join(snapshot, 'code.ts'));
		await expect(applyFindingPolicy([scanner('code.ts')], context)).rejects.toThrow();
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
};


/** The internal worker must reject arbitrary context paths and symlinked context data, while accepting its own bounded context file. */
const workerContextBoundary = async (): Promise<void> => {
	const directory = await mkdtemp(join(tmpdir(), 'antislopscan-worker-paths-'));
	const work = join(directory, 'work');
	const options = { timeoutMs: 10000, maxOutputBytes: 65536, memoryMb: 256 };
	const context = { snapshot: work, workDirectory: work, config: parseConfig({}), inventory: { files: [], languages: [], documents: [], dependencies: [] } };

	try {
		await mkdir(work);
		await writeFile(join(directory, 'outside.json'), JSON.stringify(context));
		const escaped = await runProcess('worker', ['systems', join(directory, 'outside.json')], work, options);

		expect(escaped.exitCode).toBe(2);
		expect(escaped.stdout).toBe('');
		await symlink(join(directory, 'outside.json'), join(work, 'context.json'));
		const linked = await runProcess('worker', ['systems', join(work, 'context.json')], work, options);

		expect(linked.exitCode).toBe(2);
		expect(linked.stdout).toBe('');
		await rm(join(work, 'context.json'));
		await writeFile(join(work, 'context.json'), JSON.stringify(context));
		const valid = await runProcess('worker', ['systems', join(work, 'context.json')], work, options);

		expect(valid.exitCode).toBe(0);
		expect(JSON.parse(valid.stdout).analyzedFiles).toBe(0);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
};

test('finding snippets reject traversal, unlisted files and symlink escape', findingEvidenceBoundary);
test('worker context is restricted to its own regular context file', workerContextBoundary);


/** Ignore only an absent cleanup target; preserve unexpected permission or I/O failures. */
const ignoreMissing = (error: NodeJS.ErrnoException): void => { if (error.code !== 'ENOENT') throw error; };
