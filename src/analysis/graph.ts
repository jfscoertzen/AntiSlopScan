/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import type { GraphEdge } from '../domain.js';

/** Find strongly connected components with iterative Kosaraju traversal, avoiding call-stack exhaustion. */
export const findCycles = (files: string[], edges: GraphEdge[]): string[][] => {
	const forward = new Map<string, string[]>();
	const reverse = new Map<string, string[]>();
	const visited = new Set<string>();
	const finished: string[] = [];
	const cycles: string[][] = [];

	for (const file of files) { forward.set(file, []); reverse.set(file, []); }
	for (const edge of edges) {
		forward.get(edge.from)?.push(edge.to);
		reverse.get(edge.to)?.push(edge.from);
	}

	for (const file of files) {
		if (visited.has(file)) continue;
		const stack: { file: string; expanded: boolean }[] = [{ file, expanded: false }];

		while (stack.length) {
			const current = stack.pop()!;

			if (current.expanded) { finished.push(current.file); continue; }
			if (visited.has(current.file)) continue;
			visited.add(current.file);
			stack.push({ file: current.file, expanded: true });
			for (const target of forward.get(current.file) ?? []) {
				if (!visited.has(target)) stack.push({ file: target, expanded: false });
			}
		}
	}

	visited.clear();
	for (const file of finished.reverse()) {
		if (visited.has(file)) continue;
		const component: string[] = [];
		const stack = [file];

		while (stack.length) {
			const current = stack.pop()!;

			if (visited.has(current)) continue;
			visited.add(current);
			component.push(current);
			for (const target of reverse.get(current) ?? []) {
				if (!visited.has(target)) stack.push(target);
			}
		}

		if (component.length > 1 || forward.get(file)?.includes(file)) cycles.push(component.sort());
	}

	cycles.sort(compareComponents);
	return cycles;
};


/** Sort components by their first member after canonical member sorting. */
const compareComponents = (left: string[], right: string[]): number => left[0].localeCompare(right[0], 'en');
