/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { constants } from 'node:fs';
import { chmod, lstat, mkdir, open, opendir, realpath, writeFile } from 'node:fs/promises';
import { dirname, extname, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { minimatch } from 'minimatch';
import { canonicalInside, isInside, resolveInside } from './paths.js';
import type { Config, Inventory, Language, SourceFile } from '../domain.js';

const extensions: Record<string, Language> = { '.js': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript', '.jsx': 'javascript', '.ts': 'typescript', '.mts': 'typescript', '.cts': 'typescript', '.tsx': 'typescript', '.vue': 'typescript', '.py': 'python', '.rs': 'rust', '.go': 'go', '.java': 'java', '.c': 'cpp', '.cc': 'cpp', '.cpp': 'cpp', '.h': 'cpp', '.hpp': 'cpp', '.cs': 'csharp', '.rb': 'ruby', '.php': 'php' };
const forbiddenDirectories = new Set(['.git', '.hg', '.svn', '.codex', '.agents', '.aws', '.npm-cache', 'node_modules', '.venv', 'venv', '.tox', 'target']);

/** Check exclusion patterns against POSIX repository-relative paths. */
export const matchesAny = (path: string, patterns: string[]): boolean => {
	for (const pattern of patterns) {
		if (minimatch(path, pattern, { dot: true, nonegate: true, nocomment: true })) return true;
	}

	return false;
};


/** Read a regular UTF-8 file through a no-follow descriptor; reject private paths and enforce containment and bounded reads. */
export const readSource = async (root: string, path: string, limit: number): Promise<string | null> => {
	const candidate = resolveInside(root, path);
	const handle = await open(candidate, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);

	try {
		const metadata = await handle.stat();
		const actual = process.platform === 'linux' ? await realpath(`/proc/self/fd/${handle.fd}`) : await realpath(candidate);

		if (!metadata.isFile() || !isInside(root, actual)) throw new Error('Source entry is not a confined regular file');
		for (const segment of relative(root, actual).split(/[\\/]/)) {
			if (forbiddenDirectories.has(segment)) throw new Error('Input path references private metadata, credentials, caches, or dependencies');
		}
		if (metadata.size > limit) throw new Error(`File exceeds maxFileBytes: ${path}`);

		const buffer = Buffer.alloc(Math.min(metadata.size + 1, limit + 1));
		const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);

		if (bytesRead > limit || bytesRead !== metadata.size) throw new Error(`Source changed or could not be read completely within its size limit: ${path}`);
		const bytes = buffer.subarray(0, bytesRead);

		if (bytes.includes(0)) return null;
		try {
			return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
		} catch {
			return null;
		}
	} finally {
		await handle.close();
	}
};


/** Copy bounded source data into a private snapshot; never copy symlinks, executable configs, or dependencies. */
export const createSnapshot = async (source: string, destination: string, config: Config, signal?: AbortSignal): Promise<Inventory> => {
	const root = await realpath(source);
	const inventory: Inventory = { files: [], languages: [], totalBytes: 0, totalLines: 0, visitedEntries: 0, excludedFiles: 0, skippedSymlinks: 0, binaryFiles: 0, documents: [], dependencies: [] };
	const pending = [''];

	if (!(await lstat(root)).isDirectory()) throw new Error('Source must be a directory');
	if (isInside(root, destination)) throw new Error('Snapshot directory must be outside the source');
	await mkdir(destination, { recursive: true, mode: 0o700 });

	while (pending.length > 0) {
		signal?.throwIfAborted();
		const directory = pending.pop()!;
		const directoryPath = await canonicalInside(root, resolveInside(root, directory));
		const entries = await opendir(directoryPath);

		for await (const entry of entries) {
			signal?.throwIfAborted();
			const path = directory ? `${directory}/${entry.name}` : entry.name;

			inventory.visitedEntries += 1;
			if (inventory.visitedEntries > config.audit.maxEntries) throw new Error('Repository traversal exceeds maxEntries');
			if (entry.isSymbolicLink()) { inventory.skippedSymlinks += 1; continue; }
			if (entry.isDirectory()) {
				if (!forbiddenDirectories.has(entry.name) && !matchesAny(`${path}/`, config.audit.exclude) && !matchesAny(`${path}/__entry__`, config.audit.exclude)) {
					pending.push(path);
				}
				continue;
			}

			if (!entry.isFile() || matchesAny(path, config.audit.exclude)) { inventory.excludedFiles += 1; continue; }
			if (path === 'package.json') await readDependencies(root, inventory, config.audit.maxFileBytes);

			const language = extensions[extname(entry.name).toLowerCase()];

			if (!language || (!config.project.languages.includes('auto') && !config.project.languages.includes(language))) { inventory.excludedFiles += 1; continue; }
			if (inventory.files.length >= config.audit.maxFiles) throw new Error('Repository exceeds maxFiles');

			const content = await readSource(root, path, config.audit.maxFileBytes);

			if (content === null) { inventory.binaryFiles += 1; continue; }
			const bytes = Buffer.byteLength(content);
			const lines = content === '' ? 0 : content.split('\n').length;

			inventory.totalBytes += bytes;
			inventory.totalLines += lines;
			if (inventory.totalBytes > config.audit.maxRepositoryBytes) throw new Error('Repository exceeds maxRepositoryBytes');

			const target = resolveInside(destination, path);

			await mkdir(dirname(target), { recursive: true, mode: 0o700 });
			await writeFile(target, content, { mode: 0o400, flag: 'wx' });
			inventory.files.push({ path, language, bytes, lines, hash: createHash('sha256').update(content).digest('hex') });
			if (!inventory.languages.includes(language)) inventory.languages.push(language);
		}
	}

	let documentBytes = 0;

	for (const path of config.architecture.documents) {
		const content = await readSource(root, path, Math.min(config.audit.maxFileBytes, 65536));

		if (content !== null) {
			documentBytes += Buffer.byteLength(content);
			if (inventory.totalBytes + documentBytes > config.audit.maxRepositoryBytes) throw new Error('Repository source and architecture documents exceed maxRepositoryBytes');
			inventory.documents.push({ path, content });
		}
	}

	inventory.files.sort(compareFiles);
	inventory.languages.sort();
	await chmod(destination, 0o500);
	return inventory;
};


/** Read dependency names only; never retain scripts, resolutions, plugin settings, or executable metadata. */
const readDependencies = async (root: string, inventory: Inventory, limit: number): Promise<void> => {
	const content = await readSource(root, 'package.json', limit);

	if (content === null) return;
	let manifest: Record<string, unknown>;

	try {
		manifest = JSON.parse(content);
	} catch {
		throw new Error('Repository package.json contains invalid JSON');
	}

	for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
		const section = manifest?.[field];

		if (!section || typeof section !== 'object' || Array.isArray(section)) continue;
		for (const name of Object.keys(section)) {
			if (name.length <= 214 && /^(@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i.test(name) && !inventory.dependencies.includes(name)) inventory.dependencies.push(name);
		}
	}

	inventory.dependencies.sort();
};


/** Sort inventory paths deterministically for stable reports and scanner inputs. */
const compareFiles = (left: SourceFile, right: SourceFile): number => left.path.localeCompare(right.path, 'en');


/** Convert a scanner path into a relative inventory path; reject locations outside the snapshot. */
export const findingPath = (snapshot: string, scannerPath: string): string => {
	const path = scannerPath.startsWith('/') ? relative(snapshot, scannerPath) : scannerPath.replace(/^\.\//, '');

	resolveInside(snapshot, path);
	return path.split('\\').join('/');
};
