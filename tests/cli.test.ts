/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { expect, test } from 'vitest';
import { execFile, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { scannerCatalog } from '../src/scanners/catalog.js';
import { environmentSetting } from '../src/environment.js';

const executable = fileURLToPath(new URL('../dist/cli.js', import.meta.url));
const execute = promisify(execFile);

/** Run the built entry point with bounded output; retain expected numeric CLI failures for assertions. */
const runCli = async (args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> => {
	try {
		const result = await execute(process.execPath, [executable, ...args], { timeout: 30000, maxBuffer: 1048576 });

		return { ...result, exitCode: 0 };
	} catch (error) {
		const failure = error as Error & { code?: number; stdout?: string; stderr?: string };

		if (typeof failure.code !== 'number') throw error;
		return { stdout: failure.stdout ?? '', stderr: failure.stderr ?? '', exitCode: failure.code };
	}
};


/** Verify the public executable and help expose both modes and reject ambiguous output or irrelevant options. */
const commandContract = async (): Promise<void> => {
	const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
	const help = await runCli(['--help']);
	const launcher = await execute(fileURLToPath(new URL('../antislopscan', import.meta.url)), ['--help']);
	const missingOutput = await runCli(['cli', '--source', '.']);
	const invalidOption = await runCli(['cli', '--source', '.', '--output', '/tmp/reports', '--port', '3000']);
	const invalidProfile = await runCli(['cli', '--output', '/tmp/reports', '--profile', 'invented']);

	expect(manifest.name).toBe('antislopscan');
	expect(manifest.bin.antislopscan).toBe('dist/cli.js');
	expect(help.exitCode).toBe(0);
	expect(help.stdout).toContain('antislopscan cli');
	expect(help.stdout).toContain('antislopscan gui');
	expect(launcher.stdout).toBe(help.stdout);
	expect(missingOutput.exitCode).toBe(3);
	expect(missingOutput.stderr).toContain('--output');
	expect(invalidOption.exitCode).toBe(3);
	expect(invalidOption.stderr).toContain('--port');
	expect(invalidProfile.exitCode).toBe(3);
	expect(invalidProfile.stderr).toContain('--profile');
};


/** Verify a real CLI scan writes artifacts only to the requested folder, including spaces, and preserves source. */
const outputContract = async (): Promise<void> => {
	const directory = await mkdtemp(join(tmpdir(), 'antislopscan-cli-'));
	const source = join(directory, 'source');
	const output = join(directory, 'chosen reports');
	const configPath = join(directory, 'config.json');
	const scanners: Record<string, { enabled: boolean }> = {};

	for (const scanner of scannerCatalog) { if (!['systems', 'ai'].includes(scanner.id)) scanners[scanner.id] = { enabled: false }; }
	try {
		await mkdir(source);
		await writeFile(join(source, 'index.ts'), 'export const answer = 42;\n', { mode: 0o444 });
		await writeFile(configPath, JSON.stringify({ scanners, reports: { formats: ['html', 'json', 'sarif'], outputDirectory: join(directory, 'unused') } }));
		const result = await runCli(['cli', '--source', source, '--config', configPath, '--output', output]);
		const summary = JSON.parse(result.stdout);

		expect(result.exitCode).toBe(0);
		expect(summary.outputDirectory).toBe(output);
		expect((await readdir(output)).sort()).toEqual(['report.html', 'report.json', 'report.sarif.json']);
		expect(await readFile(join(output, 'report.html'), 'utf8')).toContain('antislopscan');
		expect(JSON.parse(await readFile(join(output, 'report.json'), 'utf8')).ci.passed).toBe(true);
		expect(await readFile(join(source, 'index.ts'), 'utf8')).toBe('export const answer = 42;\n');
		expect((await readdir(directory)).sort()).toEqual(['chosen reports', 'config.json', 'source']);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
};


/** Verify GUI mode starts an authenticated browser application with explicit source/state folders and shuts down cleanly. */
const guiContract = async (): Promise<void> => {
	const directory = await mkdtemp(join(tmpdir(), 'antislopscan-gui-'));
	const source = join(directory, 'source');
	const state = join(directory, 'state');
	const token = randomBytes(24).toString('hex');
	const reservation = createServer();

	await mkdir(source);
	await promisify(reservation.listen.bind(reservation))(0, '127.0.0.1');
	const address = reservation.address();

	if (!address || typeof address === 'string') throw new Error('Could not reserve a GUI test port');
	const port = address.port;

	await promisify(reservation.close.bind(reservation))();
	const child = spawn(process.execPath, [executable, 'gui', '--source', source, '--data', state, '--port', String(port)], {
		env: { ...process.env, ANTISLOPSCAN_API_TOKEN: token, ANTISLOPSCAN_ORIGIN: `http://localhost:${port}` },
		stdio: ['ignore', 'pipe', 'pipe'],
	});
	const closed = once(child, 'close');
	let stdout = '';
	let stderr = '';

	child.stdout.on('data', /** Retain startup metadata emitted by this controlled child. */ (chunk: Buffer) => { stdout += chunk.toString(); });
	child.stderr.on('data', /** Retain startup diagnostics for a failed controlled-child assertion. */ (chunk: Buffer) => { stderr += chunk.toString(); });
	try {
		let ready = false;

		for (let attempt = 0; attempt < 200 && child.exitCode === null; attempt += 1) {
			try {
				ready = (await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(500) })).ok;
			} catch {
				ready = false;
			}
			if (ready) break;
			await delay(50);
		}
		expect(ready, stderr).toBe(true);
		expect((await fetch(`http://127.0.0.1:${port}/api/audits`)).status).toBe(401);
		expect((await fetch(`http://127.0.0.1:${port}/api/audits`, { headers: { authorization: `Bearer ${token}` } })).status).toBe(200);
		expect(await (await fetch(`http://127.0.0.1:${port}/`)).text()).toContain('<title>antislopscan');
		expect(JSON.parse(stdout).mode).toBe('gui');
		expect(JSON.parse(stdout).dataDirectory).toBe(state);
		expect(await readdir(source)).toEqual([]);
	} finally {
		child.kill('SIGTERM');
		await closed;
		await rm(directory, { recursive: true, force: true });
	}
};


/** Verify legacy settings remain effective and an explicit renamed setting wins without falling through on empty values. */
const environmentContract = (): void => {
	const primary = process.env.ANTISLOPSCAN_RETENTION;
	const legacy = process.env.CODESENTRY_RETENTION;

	try {
		delete process.env.ANTISLOPSCAN_RETENTION;
		process.env.CODESENTRY_RETENTION = '25';
		expect(environmentSetting('RETENTION')).toBe('25');
		process.env.ANTISLOPSCAN_RETENTION = '50';
		expect(environmentSetting('RETENTION')).toBe('50');
		process.env.ANTISLOPSCAN_RETENTION = '';
		expect(environmentSetting('RETENTION')).toBe('');
	} finally {
		if (primary === undefined) delete process.env.ANTISLOPSCAN_RETENTION;
		else process.env.ANTISLOPSCAN_RETENTION = primary;
		if (legacy === undefined) delete process.env.CODESENTRY_RETENTION;
		else process.env.CODESENTRY_RETENTION = legacy;
	}
};

test('public CLI exposes the renamed executable and explicit mode contracts', commandContract);
test('CLI reports go to the user-selected output directory', outputContract);
test('GUI mode starts the browser application using selected paths', guiContract);
test('renamed deployment settings retain legacy compatibility', environmentContract);
