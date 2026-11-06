/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
/** Named accents shared by the application and standalone report controls. */
export const accentOptions = [
	{ id: 'neutral', label: 'Neutral' },
	{ id: 'blue', label: 'Blue' },
	{ id: 'violet', label: 'Violet' },
	{ id: 'teal', label: 'Teal' },
	{ id: 'orange', label: 'Orange' },
	{ id: 'rose', label: 'Rose' },
	{ id: 'green', label: 'Green' },
] as const;

export type Accent = typeof accentOptions[number]['id'];

/** Accept only supported accent identifiers from browser storage; malformed or missing preferences use neutral. */
export const normalizeAccent = (value: unknown): Accent => {
	for (const option of accentOptions) {
		if (value === option.id) return option.id;
	}
	return 'neutral';
};
