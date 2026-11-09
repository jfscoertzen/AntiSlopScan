/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { expect, test } from '@jest/globals';
import { findCycles } from '../src/analysis/graph.js';
import type { GraphEdge } from '../src/domain.js';

/** Detect large connected components without recursive stack overflow or runaway work; this is a CI guardrail, not a production SLO. */
const largeDependencyGraph = (): void => {
	const nodeCount = 20000;
	const files = Array.from({ length: nodeCount }, /** Allocate deterministic module names. */ (_, index) => `module-${index}`);
	const edges: GraphEdge[] = files.map(/** Close a single cycle through all modules. */ (from, index) => ({ from, to: files[(index + 1) % nodeCount], line: 1, typeOnly: false }));
	const started = performance.now();
	const result = findCycles(files, edges);
	const elapsedMs = performance.now() - started;

	expect(result).toHaveLength(1);
	expect(result[0]).toHaveLength(nodeCount);
	expect(findCycles(files, edges)).toEqual(result);
	expect(elapsedMs).toBeLessThan(10000);
	expect(findCycles([], [])).toEqual([]);
};

test('20,000-module cycle analysis stays within a ten-second regression budget', largeDependencyGraph);
