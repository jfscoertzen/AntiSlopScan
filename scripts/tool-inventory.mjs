/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const result = [];
const visited = new Set();

/** Enumerate installed package manifests and declared licenses without loading executable package code. @param {string} directory @returns {Promise<void>} */
const inspect = async (directory) => {
	let entries;

	try { entries = await readdir(directory, { withFileTypes: true }); }
	catch (error) { if (error.code === 'ENOENT') return; throw error; }
	for (const entry of entries) {
		if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
		const path = join(directory, entry.name);

		if (entry.name.startsWith('@')) { await inspect(path); continue; }
		try {
			const manifest = JSON.parse(await readFile(join(path, 'package.json'), 'utf8'));
			const identity = `${manifest.name}@${manifest.version}`;

			if (!visited.has(identity)) { visited.add(identity); result.push({ name: manifest.name, version: manifest.version, license: manifest.license ?? 'Review upstream package notices', location: path }); }
		} catch (error) {
			if (error.code !== 'ENOENT') throw error;
		}
		await inspect(join(path, 'node_modules'));
	}
};

await inspect('node_modules');
await inspect('tools/node_modules');
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
