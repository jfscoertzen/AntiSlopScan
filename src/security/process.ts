/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { spawn } from 'node:child_process';
import { access, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { applicationRoot, isJavaScriptScanner, javascriptInstallation } from './installation.js';

export { applicationRoot } from './installation.js';
const nativeBinaries = { rustAntiSlop: join(applicationRoot, 'tools/bin/antislop'), ruff: join(applicationRoot, 'tools/python/bin/ruff'), radon: join(applicationRoot, 'tools/python/bin/radon'), semgrep: join(applicationRoot, 'tools/python/bin/semgrep'), gitleaks: join(applicationRoot, 'tools/bin/gitleaks') } as const;
export type NativeScanner = keyof typeof nativeBinaries;

export class ProcessFailure extends Error {
	/** Carry a safe execution status without exposing scanner stderr or source contents. */
	constructor(message: string, readonly status: 'failed' | 'timed_out') { super(message); }
}

export interface ProcessOptions { timeoutMs: number; maxOutputBytes: number; memoryMb: number; signal?: AbortSignal }
export interface ProcessOutput { stdout: string; exitCode: number; durationMs: number }

/** Check an appliance-owned native binary at its fixed location. */
export const nativeAvailable = async (id: NativeScanner): Promise<boolean> => {
	try { await access(nativeBinaries[id]); return true; }
	catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
		throw error;
	}
};


/** Execute a permitted appliance entry point, with bounded output, deadline, CPU time, and a clean environment. */
export const runProcess = async (entry: 'worker' | 'slopscore' | 'oxlint' | 'jscpd' | 'dependencyCruiser' | NativeScanner, args: string[], cwd: string, options: ProcessOptions): Promise<ProcessOutput> => {
	const started = performance.now();
	let script: string | undefined;

	if (entry === 'worker') script = join(applicationRoot, 'dist/worker.js');
	else if (isJavaScriptScanner(entry)) {
		const installed = await javascriptInstallation(entry);

		if (!installed) throw new Error('Pinned JavaScript scanner is not installed');
		script = installed.script;
	}
	const executable = script ? process.execPath : nativeBinaries[entry as NativeScanner];
	const commandArgs = script ? [`--max-old-space-size=${options.memoryMb}`, script, ...args] : args;
	const canonical = await realpath(executable);

	options.signal?.throwIfAborted();
	const environment: NodeJS.ProcessEnv = {
		PATH: '/usr/local/bin:/usr/bin:/bin', HOME: cwd, TMPDIR: cwd,
		NO_COLOR: '1', CI: 'true', PYTHONNOUSERSITE: '1', PYTHONSAFEPATH: '1',
		SEMGREP_SEND_METRICS: 'off', SEMGREP_ENABLE_VERSION_CHECK: '0',
		RAYON_NUM_THREADS: '2', OMP_NUM_THREADS: '2',
	};
	const resourceArguments = [`--cpu=${Math.max(1, Math.ceil(options.timeoutMs / 1000))}`, '--nofile=256', '--fsize=67108864'];
	const usePrlimit = process.platform === 'linux';
	const command = usePrlimit ? '/usr/bin/prlimit' : canonical;
	const argumentsList = usePrlimit ? [...resourceArguments, '--', canonical, ...commandArgs] : commandArgs;

	return new Promise<ProcessOutput>(/** Settle only after child close; stop the scanner process group on limits or cancellation. */ (resolveOutput, rejectOutput) => {
		const child = spawn(command, argumentsList, { cwd, env: environment, stdio: ['ignore', 'pipe', 'pipe'], shell: false, detached: process.platform !== 'win32' });
		const chunks: Buffer[] = [];
		let size = 0;
		let failure: ProcessFailure | undefined;

		/** Stop a running process group; ignore only the race where it has already exited. */
		const stop = (reason: ProcessFailure): void => {
			failure ??= reason;
			try {
				if (child.pid && process.platform !== 'win32') process.kill(-child.pid, 'SIGKILL');
				else child.kill('SIGKILL');
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code !== 'ESRCH') rejectOutput(error);
			}
		};

		/** Abort the scanner when the owning audit's deadline expires. */
		const abort = (): void => stop(new ProcessFailure('Audit deadline exceeded', 'timed_out'));
		/** Enforce a per-scanner wall-clock deadline. */
		const timeout = (): void => stop(new ProcessFailure('Scanner deadline exceeded', 'timed_out'));
		/** Bound both output streams; retain stdout only, since stderr may contain source or secrets. */
		const consume = (chunk: Buffer, retain: boolean): void => {
			size += chunk.length;
			if (size > options.maxOutputBytes) { stop(new ProcessFailure('Scanner output limit exceeded', 'failed')); return; }
			if (retain) chunks.push(chunk);
		};
		/** Receive a stdout chunk into the bounded buffer. */
		const stdout = (chunk: Buffer): void => consume(chunk, true);
		/** Count stderr without persisting its potentially sensitive contents. */
		const stderr = (chunk: Buffer): void => consume(chunk, false);
		/** Release timers and signal listeners after the subprocess terminates. */
		const cleanup = (): void => { clearTimeout(timer); options.signal?.removeEventListener('abort', abort); };
		/** Report execution failures without swallowing the original operating-system error. */
		const failed = (error: Error): void => { cleanup(); rejectOutput(error); };
		/** Return complete stdout only after exit; signal termination is never a successful scan. */
		const closed = (code: number | null): void => {
			cleanup();
			if (failure) { rejectOutput(failure); return; }
			if (code === null) { rejectOutput(new ProcessFailure('Scanner terminated by signal', 'failed')); return; }
			resolveOutput({ stdout: Buffer.concat(chunks).toString('utf8'), exitCode: code, durationMs: Math.round(performance.now() - started) });
		};

		const timer = setTimeout(timeout, options.timeoutMs);

		options.signal?.addEventListener('abort', abort, { once: true });
		child.stdout.on('data', stdout);
		child.stderr.on('data', stderr);
		child.once('error', failed);
		child.once('close', closed);
		if (options.signal?.aborted) abort();
	});
};
