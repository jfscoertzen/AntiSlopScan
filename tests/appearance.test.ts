/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { expect, test } from 'vitest';
import { accentOptions, normalizeAccent } from '../ui/appearance.js';

/** Preserve each supported selection and use the neutral default for absent or hostile browser storage. */
const accentContract = (): void => {
	for (const option of accentOptions) expect(normalizeAccent(option.id)).toBe(option.id);
	for (const value of [null, undefined, '', 'unknown', 'BLUE', '#164b3d', 'url(https://invalid.example)', {}, 7]) {
		expect(normalizeAccent(value)).toBe('neutral');
	}
	expect(accentOptions).toHaveLength(7);
};

test('accent preferences accept only the supported palette identifiers', accentContract);
