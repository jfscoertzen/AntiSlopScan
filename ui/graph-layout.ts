/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import type { DependencyGraph, GraphEdge, GraphNode } from '../src/domain.js';

export interface DisplayNode extends GraphNode {
	x: number;
	y: number;
	label: string;
	radius: number;
}
export interface DisplayEdge extends GraphEdge {
	path: string;
}
export interface GraphDisplay {
	nodes: DisplayNode[];
	edges: DisplayEdge[];
	matchingNodes: number;
	matchingEdges: number;
	width: number;
	height: number;
}

/** Arrange bounded actual modules in two organizational rings; filtering includes one-hop neighbors and never infers relationships. */
export const layoutDependencies = (
	graph: DependencyGraph,
	options: { query?: string; runtimeOnly?: boolean; maxNodes?: number } = {}
): GraphDisplay => {
	const query = options.query?.trim().toLowerCase() ?? '';
	const limit = Math.max(1, Math.min(48, Math.floor(options.maxNodes ?? 32)));
	const eligibleEdges = graph.edges.filter(
		/** Apply the explicit runtime-edge display filter only. */ (edge) =>
			!options.runtimeOnly || !edge.typeOnly
	);
	const matches = new Set<string>();

	for (const node of graph.nodes)
		if (!query || node.file.toLowerCase().includes(query)) matches.add(node.file);
	const neighborhood = new Set(matches);

	if (query)
		for (const edge of eligibleEdges) {
			if (matches.has(edge.from) || matches.has(edge.to)) {
				neighborhood.add(edge.from);
				neighborhood.add(edge.to);
			}
		}
	const candidates = graph.nodes.filter(
		/** Retain only actual matched modules or their immediate neighbors. */ (node) =>
			neighborhood.has(node.file)
	);

	candidates.sort(
		/** Place the most connected canonical modules first, using a deterministic file tie-breaker. */ (
			left,
			right
		) => right.fanIn + right.fanOut - (left.fanIn + left.fanOut) || left.file.localeCompare(right.file)
	);
	const selected = candidates.slice(0, limit);
	const nodes: DisplayNode[] = [];
	const positions = new Map<string, DisplayNode>();
	const hubCount = Math.min(5, Math.max(1, Math.ceil(Math.sqrt(selected.length))));

	for (const [index, node] of selected.entries()) {
		const inner = index < hubCount;
		const ringSize = inner ? hubCount : selected.length - hubCount;
		const ringIndex = inner ? index : index - hubCount;
		const angle = -Math.PI / 2 + (2 * Math.PI * ringIndex) / Math.max(1, ringSize);
		const radius = selected.length === 1 ? 0 : inner ? 95 : 235;
		const name = node.file.split('/').at(-1) ?? node.file;
		const positioned = {
			...node,
			x: 500 + Math.cos(angle) * radius * 1.45,
			y: 310 + Math.sin(angle) * radius,
			label: name.length > 23 ? `${name.slice(0, 20)}…` : name,
			radius: 4 + Math.min(5, Math.sqrt(node.fanIn + node.fanOut))
		};

		nodes.push(positioned);
		positions.set(node.file, positioned);
	}
	const edges: DisplayEdge[] = [];
	let matchingEdges = 0;

	for (const edge of eligibleEdges) {
		if (neighborhood.has(edge.from) && neighborhood.has(edge.to)) matchingEdges += 1;
		const from = positions.get(edge.from);
		const to = positions.get(edge.to);

		if (!from || !to || edges.length >= 100) continue;
		const path =
			edge.from === edge.to
				? `M ${from.x} ${from.y} C ${from.x + 45} ${from.y - 50}, ${from.x + 45} ${from.y + 50}, ${from.x} ${from.y}`
				: `M ${from.x} ${from.y} Q ${(from.x + to.x) / 2 + 25} ${(from.y + to.y) / 2 - 35}, ${to.x} ${to.y}`;

		edges.push({ ...edge, path });
	}
	return { nodes, edges, matchingNodes: candidates.length, matchingEdges, width: 1000, height: 620 };
};
