/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { expect, test } from '@jest/globals';
import { layoutDependencies } from '../ui/graph-layout.js';
import type { DependencyGraph } from '../src/domain.js';

const graph: DependencyGraph = {
	nodes: [
		{ file: 'src/a.ts', fanIn: 1, fanOut: 2, lines: 50, complexity: 8 },
		{ file: 'src/b.ts', fanIn: 1, fanOut: 0, lines: 12, complexity: 1 },
		{ file: 'types/c.ts', fanIn: 1, fanOut: 0, lines: 6, complexity: 0 },
		{ file: 'unconnected.ts', fanIn: 0, fanOut: 0, lines: 2, complexity: 1 },
	],
	edges: [
		{ from: 'src/a.ts', to: 'src/b.ts', line: 2, typeOnly: false },
		{ from: 'src/a.ts', to: 'types/c.ts', line: 3, typeOnly: true },
		{ from: 'src/a.ts', to: 'src/a.ts', line: 4, typeOnly: false },
	], cycles: [['src/a.ts']], unresolvedImports: 1,
};

/** Verify visualization never invents edges, mutates evidence, or loses self-loops through invalid geometry. */
const evidenceContract = (): void => {
	const original = JSON.stringify(graph);
	const layout = layoutDependencies(graph);

	expect(layout.edges).toHaveLength(3);
	for (const edge of layout.edges) expect(graph.edges).toContainEqual({ from: edge.from, to: edge.to, line: edge.line, typeOnly: edge.typeOnly });
	for (const node of layout.nodes) { expect(Number.isFinite(node.x)).toBe(true); expect(Number.isFinite(node.y)).toBe(true); }
	expect(layout.edges[2].path).not.toContain('NaN');
	expect(JSON.stringify(graph)).toBe(original);
	expect(layoutDependencies(graph)).toEqual(layout);
};


/** Verify query neighborhoods, runtime-only view, bounds, and unavailable graph states remain honest. */
const filterContract = (): void => {
	const runtime = layoutDependencies(graph, { runtimeOnly: true });

	expect(runtime.edges.every(/** Type edges must not be displayed as runtime imports. */ (edge) => !edge.typeOnly)).toBe(true);
	const neighborhood = layoutDependencies(graph, { query: 'b.ts' });

	expect(neighborhood.nodes.map(/** Read only displayed module identities. */ (node) => node.file)).toEqual(['src/a.ts', 'src/b.ts']);
	expect(layoutDependencies(graph, { maxNodes: 1 }).nodes).toHaveLength(1);
	expect(layoutDependencies(graph, { query: 'missing' }).edges).toEqual([]);
	expect(layoutDependencies({ nodes: [], edges: [], cycles: [], unresolvedImports: 0 }).nodes).toEqual([]);
};

test('dependency visualization preserves real evidence and deterministic geometry', evidenceContract);
test('dependency visualization filters and bounds only the display', filterContract);
