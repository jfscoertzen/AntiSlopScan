/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */

/** Write structured operational events to stderr; callers must supply identifiers, never source or credentials. */
export const log = (level: 'info' | 'warn' | 'error', event: string, fields: Record<string, string | number | boolean> = {}): void => {
	process.stderr.write(`${JSON.stringify({ time: new Date().toISOString(), level, subsystem: 'antislopscan', event, ...fields })}\n`);
};
