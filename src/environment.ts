/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */

/**
 * Read a deployment setting; the renamed prefix takes precedence, including explicit empty values.
 * @param suffix Setting name without the application prefix.
 * @returns The renamed value, legacy fallback, or undefined when neither is configured.
 */
export const environmentSetting = (suffix: string): string | undefined => process.env[`ANTISLOPSCAN_${suffix}`] ?? process.env[`CODESENTRY_${suffix}`];
