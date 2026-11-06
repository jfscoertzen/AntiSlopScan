/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { realpath } from 'node:fs/promises';

/** Check canonical or lexical containment, including the root itself. */
export const isInside = (root: string, candidate: string): boolean => {
	const path = relative(resolve(root), resolve(candidate));

	return path === '' || (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path));
};


/** Resolve a relative path inside a root; reject absolute paths and traversal. */
export const resolveInside = (root: string, path: string): string => {
	if (isAbsolute(path) || path.includes('\0')) throw new Error('Expected a relative path');

	const result = resolve(root, path);

	if (!isInside(root, result)) throw new Error('Path escapes the configured root');
	return result;
};


/** Canonicalize an existing path and require containment; throw on missing paths or symlink escape. */
export const canonicalInside = async (root: string, candidate: string): Promise<string> => {
	const canonicalRoot = await realpath(root);
	const canonicalCandidate = await realpath(candidate);

	if (!isInside(canonicalRoot, canonicalCandidate)) throw new Error('Path escapes the configured root');
	return canonicalCandidate;
};
