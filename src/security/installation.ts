/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { access, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const applicationRoot = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(new URL('../../package.json', import.meta.url));
const scanners = {
	slopscore: { package: 'slopscore', entry: 'bin/slopscore.js' },
	oxlint: { package: 'oxlint', entry: 'bin/oxlint' },
	jscpd: { package: 'jscpd', entry: 'run-jscpd.js' },
	dependencyCruiser: { package: 'dependency-cruiser', entry: 'bin/dependency-cruiser.mjs' },
} as const;

export type JavaScriptScanner = keyof typeof scanners;

/** Narrow a scanner identifier to the fixed npm executable allowlist; repository input cannot add entries. */
export const isJavaScriptScanner = (id: string): id is JavaScriptScanner => Object.hasOwn(scanners, id);


/** Resolve a pinned scanner from this installation's dependency lookup paths, including npm hoisting and legacy checkouts. */
export const javascriptInstallation = async (id: JavaScriptScanner): Promise<{ script: string; version: string } | null> => {
	const scanner = scanners[id];
	const paths = new Set([join(applicationRoot, 'node_modules'), ...(require.resolve.paths(scanner.package) ?? []), join(applicationRoot, 'tools/node_modules')]);

	for (const directory of paths) {
		const root = join(directory, scanner.package);
		let manifest;

		try {
			manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
			throw error;
		}
		if (manifest.name !== scanner.package || typeof manifest.version !== 'string') {
			throw new Error('Installed scanner manifest does not match the executable allowlist');
		}
		const script = join(root, scanner.entry);

		await access(script);
		return { script, version: manifest.version };
	}

	return null;
};
