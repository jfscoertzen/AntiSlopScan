/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
/** Original application/report icon paths; no external font or icon service is needed. */
export const iconPaths = {
	grid: ['M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z'],
	scan: ['M4 8V4h4 M16 4h4v4 M20 16v4h-4 M8 20H4v-4 M7 12h10 M12 9v6'],
	network: ['M9 3h6v6H9z M2 16h6v6H2z M16 16h6v6h-6z M12 9v4 M5 16v-3h14v3'],
	workflow: ['M3 3h6v6H3z M15 15h6v6h-6z M9 6h8v5 M17 11l-3-3 M17 11l3-3 M6 9v9h9'],
	gauge: ['M4 18a9 9 0 1 1 16 0 M12 14l4-6 M7 18h10 M7 7l1 1 M4 12h2 M18 12h2'],
	shield: ['M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6z M8 12l3 3 5-6'],
	activity: ['M2 12h5l3-8 4 16 3-8h5'],
	alert: ['M12 3L2 21h20z M12 9v5 M12 17v1'],
	info: ['M12 8v1 M12 12v5 M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18'],
	circleCheck: ['M8 12l3 3 5-6 M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18'],
	circleX: ['M9 9l6 6 M15 9l-6 6 M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18'],
	clock: ['M12 7v5l3 2 M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18'],
	folder: ['M3 6h7l2 3h9v11H3z M3 6V4h7l2 2'],
	file: ['M5 3h9l5 5v13H5z M14 3v6h5 M8 13h8 M8 17h5'],
	settings: ['M4 6h16 M4 12h16 M4 18h16 M8 3v6 M16 9v6 M10 15v6'],
	plus: ['M12 4v16 M4 12h16'],
	chevron: ['M9 5l7 7-7 7'],
	download: ['M12 3v12 M7 10l5 5 5-5 M4 17v4h16v-4'],
	copy: ['M8 8h13v13H8z M16 8V3H3v13h5'],
	layers: ['M12 3L2 8l10 5 10-5z M3 12l9 5 9-5 M3 16l9 5 9-5'],
	branch: [
		'M6 3v13 M6 16a3 3 0 1 0 0 6 3 3 0 0 0 0-6 M18 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6 M18 8v3a5 5 0 0 1-5 5H6'
	],
	code: ['M8 5l-6 7 6 7 M16 5l6 7-6 7 M14 3l-4 18'],
	wrench: ['M14 6l4 4 3-3a7 7 0 0 1-9 9l-7 6-3-3 7-7a7 7 0 0 1 8-9z'],
	connection: ['M8 3v5 M16 3v5 M5 8h14v4a7 7 0 0 1-14 0z M12 19v4'],
	close: ['M5 5l14 14 M19 5L5 19']
} as const;
export type IconName = keyof typeof iconPaths;
