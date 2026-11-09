/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const tarball = join(root, 'artifacts', `${manifest.name}-${manifest.version}.tgz`);
const directory = await mkdtemp(join(tmpdir(), 'antislopscan-package-'));
const source = join(directory, 'source');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const cache = join(directory, 'empty-npm-cache');
const scannerIds = ['systems', 'eslint', 'slopscore', 'oxlint', 'oxlintAntiSlop', 'jscpd', 'dependencyCruiser'];
const nativeIds = ['rustAntiSlop', 'semgrep', 'gitleaks', 'radon', 'ruff'];
const environment = { ...process.env, HOME: directory, USERPROFILE: directory, CI: 'true', NO_UPDATE_NOTIFIER: '1' };
let gui;
let guiClosed;

try {
	await mkdir(source);
	await writeFile(join(source, 'values.ts'), 'export const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];\n');
	await writeFile(join(source, 'index.ts'), 'import { values } from "./values.js";\nexport const total = (multiplier: number) => {\n let result = 0;\n for (const item of values) {\n  const scaled = item * multiplier;\n  const remainder = scaled % 3;\n  result += remainder === 0 ? scaled / 3 : scaled - remainder;\n }\n return result;\n};\n');
	const policy = join(directory, 'policy.json');

	await writeFile(policy, JSON.stringify({ scoring: { minimumOverallScore: 0, minimumCategoryScore: 0 }, ci: { failBelowScore: 0, failOnCritical: false } }));
	for (const global of [true, false]) {
		const prefix = join(directory, global ? 'global' : 'local');
		const args = ['install', '--prefix', prefix, '--registry=https://registry.npmjs.org', '--ignore-scripts', '--offline', '--omit=dev', '--cache', cache, '--no-audit', '--no-fund', '--update-notifier=false', tarball];

		if (global) args.splice(1, 0, '--global');
		await execute(npm, args, { cwd: directory, env: environment, timeout: 120000, maxBuffer: 1048576 });
		const installed = global && process.platform !== 'win32' ? join(prefix, 'lib/node_modules/antislopscan') : join(prefix, 'node_modules/antislopscan');
		const entry = join(installed, 'dist/cli.js');
		const help = await execute(process.execPath, [entry, '--help'], { env: environment });

		assert.match(help.stdout, /antislopscan cli/);
		assert.match(help.stdout, /antislopscan gui/);
		if (global && process.platform !== 'win32') {
			const command = await execute(join(prefix, 'bin/antislopscan'), ['--help'], { env: environment });

			assert.equal(command.stdout, help.stdout);
		}
		const output = join(directory, global ? 'global reports' : 'local reports');
		const audit = await execute(process.execPath, [entry, 'cli', '--profile', 'portable', '--source', source, '--config', policy, '--output', output], { cwd: directory, env: environment, timeout: 60000, maxBuffer: 1048576 }).catch(/** Preserve synthetic-fixture diagnostics when an installed scanner fails. @param {Error} error @returns {Promise<never>} */ async (error) => {
			const report = JSON.parse(await readFile(join(output, 'report.json'), 'utf8'));

			await writeFile(join(resolve(process.env.ANTISLOPSCAN_TEST_ARTIFACTS ?? 'artifacts'), 'npm-package-failure.json'), JSON.stringify(report, null, 2));
			throw error;
		});
		const result = JSON.parse(await readFile(join(output, 'report.json'), 'utf8'));

		assert.equal(JSON.parse(audit.stdout).outputDirectory, output);
		assert.equal(result.ci.passed, true);
		assert.equal(result.scores.coverage, 100);
		assert.deepEqual((await readdir(output)).sort(), ['report.html', 'report.json', 'report.sarif.json']);
		for (const id of scannerIds) {
			const scanner = result.scanners.find(/** Select the requested installed JavaScript scanner. @param {{id: string}} scanner @returns {boolean} */ (scanner) => scanner.id === id);

			assert.equal(scanner?.status, 'completed', `${id} did not run from ${global ? 'global' : 'local'} dependencies`);
		}
		for (const id of nativeIds) {
			assert.equal(result.scanners.find(/** Select an explicitly disabled native scanner. @param {{id: string}} scanner @returns {boolean} */ (scanner) => scanner.id === id)?.status, 'skipped');
		}
		assert.match(await readFile(join(installed, 'LICENSE.TXT'), 'utf8'), /Apache License/);
		assert.equal(JSON.parse(await readFile(join(installed, 'config/npm-dependencies.lock.json'), 'utf8')).version, manifest.version);
		assert.equal((await readdir(join(installed, 'tools'))).includes('python'), false);
		assert.equal((await readdir(join(installed, 'tools'))).includes('bin'), false);
		assert.equal((await readdir(join(installed, 'node_modules'))).includes('jest'), false);
		assert.equal((await readdir(installed)).includes('AGENTS.md'), false);
		assert.equal((await readdir(installed)).includes('.env'), false);
		assert.equal((await readdir(join(installed, 'config'))).includes('local.json'), false);
		assert.equal((await readdir(join(installed, 'docs'))).includes('articles'), false);
		console.log(`${global ? 'Global' : 'Local'} tarball install with an empty offline cache: CLI, real npm scanners, reports, lock and notices passed.`);
	}
	const reservation = createServer();

	await promisify(reservation.listen.bind(reservation))(0, '127.0.0.1');
	const address = reservation.address();

	assert.ok(address && typeof address !== 'string');
	const port = address.port;

	await promisify(reservation.close.bind(reservation))();
	const globalEntry = join(directory, 'global', process.platform === 'win32' ? 'node_modules' : 'lib/node_modules', 'antislopscan/dist/cli.js');

	gui = spawn(process.execPath, [globalEntry, 'gui', '--profile', 'portable', '--source', source, '--data', join(directory, 'state'), '--port', String(port)], { env: { ...environment, ANTISLOPSCAN_ORIGIN: `http://localhost:${port}`, ANTISLOPSCAN_API_TOKEN: '' }, stdio: ['ignore', 'ignore', 'pipe'] });
	guiClosed = once(gui, 'close');
	let diagnostics = '';

	gui.stderr.on('data', /** Retain diagnostics from the controlled packaged server. @param {Buffer} chunk @returns {void} */ (chunk) => { diagnostics += chunk.toString(); });
	let ready = false;

	for (let attempt = 0; attempt < 200 && gui.exitCode === null; attempt += 1) {
		try {
			ready = (await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(500) })).ok;
		} catch {
			ready = false;
		}
		if (ready) break;
		await delay(50);
	}
	assert.ok(ready, diagnostics);
	assert.match(await (await fetch(`http://127.0.0.1:${port}/`)).text(), /<title>antislopscan/);
	const defaults = await (await fetch(`http://127.0.0.1:${port}/api/config/default`)).json();

	assert.equal(defaults.config.scanners.rustAntiSlop.enabled, false);
	assert.deepEqual(defaults.config.reports.formats, ['html', 'json', 'sarif']);
	console.log('Packaged GUI, profile defaults and clean server shutdown passed.');
} finally {
	gui?.kill('SIGTERM');
	if (guiClosed) await guiClosed;
	await rm(directory, { recursive: true, force: true });
}
