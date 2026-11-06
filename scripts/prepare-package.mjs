/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { access, chmod, copyFile, mkdir, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const lock = JSON.parse(await readFile(new URL('package-lock.json', root), 'utf8'));

if (manifest.name !== lock.name || manifest.version !== lock.version) {
	throw new Error('Package metadata and the authoritative lockfile differ');
}
const bundled = new Set(manifest.bundleDependencies === true ? Object.keys(manifest.dependencies) : manifest.bundleDependencies ?? []);

for (const dependency of Object.keys(manifest.dependencies)) {
	if (!bundled.has(dependency)) throw new Error(`Offline releases must bundle runtime dependency ${dependency}`);
}
for (const [path, expected] of Object.entries(lock.packages)) {
	if (!path || expected.dev || expected.link) continue;
	let installed;

	try {
		installed = JSON.parse(await readFile(new URL(`${path}/package.json`, root), 'utf8'));
	} catch (error) {
		if (error.code === 'ENOENT' && expected.optional) continue;
		throw error;
	}
	if (installed.version !== expected.version) throw new Error(`Installed ${path} does not match the release lockfile`);
}
for (const path of ['dist/cli.js', 'dist/worker.js', 'dist/reports/pdf.js', 'dist/ui/index.html', 'dist/vendor/anti-slop/index.js', 'dist/vendor/anti-slop/LICENSE', 'assets/report.css', 'assets/theme.css', 'assets/branding/antislopscan-mark.png', 'assets/report.js', 'tools/vendor/anti-slop/LICENSE', 'LICENSE.TXT', 'NOTICE']) {
	await access(new URL(path, root));
}
await chmod(new URL(manifest.bin.antislopscan, root), 0o755);
await copyFile(new URL('package-lock.json', root), new URL('config/npm-dependencies.lock.json', root));
await mkdir(new URL('artifacts/', root), { recursive: true });
process.stdout.write(`Prepared ${manifest.name}@${manifest.version} with compiled assets and verified bundled runtime dependencies.\n`);
