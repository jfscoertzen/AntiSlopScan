/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { expect, test } from 'vitest';
import { parseConfig } from '../src/config.js';
import { resolveInside } from '../src/security/paths.js';
import { calculateScores } from '../src/scoring.js';
import { findCycles } from '../src/analysis/graph.js';

/** Verify strict option validation and supported appliance defaults. */
const configurationContract = () => {
	expect(parseConfig({ version: '1.0' }).audit.parallelScanners).toBe(4);
	expect(parseConfig({}, 'portable').scanners.rustAntiSlop.enabled).toBe(false);
	expect(parseConfig({}, 'portable').reports.formats).toEqual(['html', 'json', 'sarif']);
	expect(parseConfig({ scanners: { rustAntiSlop: { enabled: true } } }, 'portable').scanners.rustAntiSlop.enabled).toBe(true);
	expect(/** Attempt an invalid negative inventory limit. */ () => parseConfig({ audit: { maxFiles: -1 } })).toThrow();
	expect(/** Attempt to inject an unregistered scanner command. */ () => parseConfig({ scanners: { eslint: { enabled: true, command: 'evil' } } })).toThrow();
	expect(/** Attempt an unsupported ESLint profile. */ () => parseConfig({ scanners: { eslint: { profile: 'invented' } } })).toThrow();
	expect(/** Attempt source transmission without explicit consent. */ () => parseConfig({ ai: { enabled: true, allowSourceTransmission: false } })).toThrow();
	expect(/** Attempt a scoring policy with no positive category weights. */ () => parseConfig({ scoring: { weights: { slop: 0, codeQuality: 0, architecture: 0, systemsThinking: 0, security: 0, maintainability: 0, technicalDebt: 0 } } })).toThrow();
};


/** Verify lexical traversal and lookalike root rejection. */
const pathContract = () => {
	expect(resolveInside('/workspace', 'src/a.ts')).toBe('/workspace/src/a.ts');
	expect(/** Attempt traversal into a lookalike sibling root. */ () => resolveInside('/workspace', '../workspace-other/a.ts')).toThrow();
	expect(/** Attempt an absolute path through a relative-path API. */ () => resolveInside('/workspace', '/etc/passwd')).toThrow();
};


/** Verify incomplete scanner execution cannot produce a passing score. */
const scoreContract = () => {
	const config = parseConfig({});
	const scores = calculateScores([], [], config, 100);

	expect(scores.overall).toBeNull();
	expect(scores.coverage).toBe(0);
};


/** Verify strongly connected components include self-cycles and disconnected cycles. */
const cycleContract = () => {
	const edges = [
		{ from: 'a', to: 'b', line: 1, typeOnly: false },
		{ from: 'b', to: 'a', line: 1, typeOnly: false },
		{ from: 'c', to: 'c', line: 1, typeOnly: false },
	];

	expect(findCycles(['a', 'b', 'c', 'd'], edges)).toEqual([['a', 'b'], ['c']]);
};

test('configuration rejects unsafe or unsupported options', configurationContract);
test('paths remain confined to the configured root', pathContract);
test('unavailable analysis never receives an overall score', scoreContract);
test('cycles are actual strongly connected components', cycleContract);
