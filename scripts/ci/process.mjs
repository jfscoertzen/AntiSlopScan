/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { spawn } from 'node:child_process';
import { open } from 'node:fs/promises';

export class CommandFailure extends Error {
	/** Preserve the actual exit classification without embedding subprocess output or credentials. @param {string} message @param {number | null} exitCode @param {boolean} timedOut */
	constructor(message, exitCode, timedOut) {
		super(message);
		this.exitCode = exitCode;
		this.timedOut = timedOut;
	}
}

/** Remove operator/provider settings and credentials from verification subprocesses. @returns {NodeJS.ProcessEnv} */
export const testEnvironment = () => {
	const environment = {};

	for (const [key, value] of Object.entries(process.env)) {
		if (key === 'ANTISLOPSCAN_CHROMIUM_SANDBOX') { environment[key] = value; continue; }
		if (/TOKEN|PASSWORD|SECRET|API_KEY/i.test(key) || /^(SNYK_|ANTISLOPSCAN_|CODESENTRY_|AUDIT_AI_)/.test(key)) continue;
		environment[key] = value;
	}
	environment.CI = 'true';
	environment.NO_UPDATE_NOTIFIER = '1';
	return environment;
};

/** Execute a fixed pipeline command, stream diagnostics, and kill its process group on deadline. @param {string} executable @param {string[]} args @param {{cwd?: string, log: string, timeoutMs?: number, env?: NodeJS.ProcessEnv}} options @returns {Promise<void>} */
export const command = async (executable, args, options) => {
	const log = await open(options.log, 'w', 0o600);
	const child = spawn(executable, args, {
		cwd: options.cwd ?? process.cwd(), env: options.env ?? testEnvironment(), shell: false,
		stdio: ['ignore', log.fd, log.fd], detached: process.platform !== 'win32'
	});
	let expired = false;

	/** End every subprocess owned by this stage on timeout. @returns {void} */
	const stop = () => {
		expired = true;
		try {
			if (child.pid && process.platform !== 'win32') process.kill(-child.pid, 'SIGKILL');
			else child.kill('SIGKILL');
		} catch (error) {
			if (error.code !== 'ESRCH') process.stderr.write(`Stage cleanup failed: ${error.code}\n`);
		}
	};
	const timer = setTimeout(stop, options.timeoutMs ?? 300000);

	try {
		await new Promise(/** Observe spawn failures and completion without retrying a failed gate. @param {(value?: unknown) => void} resolve @param {(error: Error) => void} reject @returns {void} */ (resolve, reject) => {
			child.once('error', reject);
			child.once('close', /** Classify a command failure without embedding potentially sensitive output in the error. @param {number | null} code @param {string | null} signal @returns {void} */ (code, signal) => {
				if (code === 0 && !expired) resolve();
				else reject(new CommandFailure(`${expired ? 'Stage timed out' : `Command exited ${code ?? signal}`}; see ${options.log}`, code, expired));
			});
		});
	} finally {
		clearTimeout(timer);
		await log.close();
	}
};
