/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
try {
	const response = await fetch(`http://127.0.0.1:${process.env.PORT ?? 3000}/health`, { signal: AbortSignal.timeout(3000) });

	process.exitCode = response.ok ? 0 : 1;
} catch {
	process.exitCode = 1;
}
