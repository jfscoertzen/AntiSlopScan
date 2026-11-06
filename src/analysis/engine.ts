/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { analyzeAst, resolveImports } from './ast.js';
import { analysisSource } from './source.js';
import { withoutComments } from './comments.js';
import { findCycles } from './graph.js';
import { makeFinding } from '../findings.js';
import { matchesAny } from '../security/snapshot.js';
import type { AuditContext, DependencyGraph, Finding, GraphEdge, GraphNode } from '../domain.js';

export interface EngineResult {
	findings: Finding[];
	graph: DependencyGraph;
	analyzedFiles: number;
}

/** Record duplicated substantial normalized line blocks across different files, with bounded memory. */
const duplicateFindings = (contents: Map<string, string>): Finding[] => {
	const windows = new Map<string, { file: string; line: number }>();
	const pairs = new Set<string>();
	const findings: Finding[] = [];
	const blockLines = 8;
	const maxWindows = 250000;

	for (const [file, content] of contents) {
		const lines = content
			.split('\n')
			.map(
				/** Retain original locations while removing noncode gaps from clone matching. */ (
					text,
					index
				) => ({ text: text.trim().replace(/\s+/g, ' '), line: index + 1 })
			)
			.filter(/** Exclude comment-masked and blank lines. */ (line) => line.text.length > 0);

		for (let index = 0; index <= lines.length - blockLines; index += 1) {
			const normalized: string[] = [];

			for (const line of lines.slice(index, index + blockLines)) normalized.push(line.text);

			const block = normalized.join('\n');

			if (block.length < 240 || normalized.length < 6) continue;
			const hash = createHash('sha256').update(block).digest('hex');
			const previous = windows.get(hash);

			if (!previous && windows.size < maxWindows)
				windows.set(hash, { file, line: lines[index].line });
			if (!previous || previous.file === file) continue;
			const pair = [previous.file, file].sort().join('\0');

			if (pairs.has(pair)) continue;
			pairs.add(pair);
			findings.push(
				makeFinding({
					ruleId: 'design/duplication',
					category: 'maintainability',
					severity: 'minor',
					file,
					line: lines[index].line,
					message: 'Substantial normalized source block is duplicated',
					evidence: `Eight code lines match ${previous.file}:${previous.line}; digest ${hash.slice(0, 16)}`,
					recommendation:
						'Review whether these blocks encode the same business knowledge before sharing an implementation.',
					principles: ['DRY', 'SSOT'],
					method: 'heuristic',
					confidence: 0.8,
					assessment: 'strong_evidence'
				})
			);
		}
	}

	return findings;
};

/** Evaluate explicit operator requirements as review indicators, never as proven runtime absence. */
const requirementFindings = (context: AuditContext, contents: Map<string, string>): Finding[] => {
	const findings: Finding[] = [];
	const patterns = {
		timeout: /AbortSignal|AbortController|timeout|deadline/i,
		boundedQueue: /highWaterMark|maxSize|capacity|concurrency|backpressure/i,
		idempotency: /idempotenc|deduplic|unique|transaction/i
	};

	for (const requirement of context.config.architecture.requirements) {
		for (const [file, content] of contents) {
			if (!matchesAny(file, requirement.files) || patterns[requirement.capability].test(content))
				continue;
			findings.push(
				makeFinding({
					ruleId: `requirements/${requirement.id}`,
					category: 'systemsThinking',
					severity: 'major',
					file,
					message: 'Declared capability has no local textual evidence in the selected file',
					evidence: `Operator requirement ${requirement.id}: ${requirement.description}`,
					recommendation:
						'Trace the capability into shared infrastructure or tests; add the required control if the trace confirms its absence.',
					principles: ['CONTRACT', 'SYSTEM_BOUNDARIES'],
					method: 'heuristic',
					confidence: 0.5,
					assessment: 'potential_risk'
				})
			);
		}
	}

	return findings;
};

/** Build a JS/TS graph and evaluate bounded syntax, duplication, and configured architectural constraints. */
export const analyzeRepository = async (context: AuditContext): Promise<EngineResult> => {
	const findings: Finding[] = [];
	const nodes: GraphNode[] = [];
	const edges: GraphEdge[] = [];
	const contents = new Map<string, string>();
	const paths = new Set<string>();
	let unresolvedImports = 0;

	for (const file of context.inventory.files) paths.add(file.path);
	for (const file of context.inventory.files) {
		const source = await readFile(
			join(context.codeSnapshot ?? context.snapshot, file.path),
			'utf8'
		);
		const content = context.codeSnapshot ? source : withoutComments(file.path, source);
		const codeLines = content
			.split('\n')
			.filter(
				/** Count implementation lines, not comment or whitespace padding. */ (line) =>
					line.trim().length > 0
			).length;

		contents.set(file.path, content);
		if (codeLines > context.config.architecture.maxModuleLines)
			findings.push(
				makeFinding({
					ruleId: 'architecture/module-size',
					category: 'architecture',
					severity: 'minor',
					file: file.path,
					message: `Module has ${codeLines} code lines, exceeding the configured review limit`,
					evidence: `Nonblank code line count ${codeLines}; review limit ${context.config.architecture.maxModuleLines}`,
					recommendation: 'Review cohesion and split independent responsibilities when justified.',
					principles: ['GOD_MODULE', 'SRP', 'SOC'],
					method: 'heuristic',
					confidence: 0.6,
					assessment: 'potential_risk'
				})
			);
		if (!['javascript', 'typescript'].includes(file.language)) continue;

		const analysis = analyzeAst(file.path, analysisSource(file.path, content), context.config);
		const resolved = resolveImports(file.path, analysis.imports, paths);

		analysis.node.lines = codeLines;
		findings.push(...analysis.findings);
		nodes.push(analysis.node);
		edges.push(...resolved.edges);
		unresolvedImports += resolved.unresolved;
	}

	const cycles = findCycles([...paths], edges.filter(runtimeEdge));
	const incoming = new Map<string, Set<string>>();
	const outgoing = new Map<string, Set<string>>();

	for (const edge of edges) {
		if (!incoming.has(edge.to)) incoming.set(edge.to, new Set());
		if (!outgoing.has(edge.from)) outgoing.set(edge.from, new Set());
		incoming.get(edge.to)!.add(edge.from);
		outgoing.get(edge.from)!.add(edge.to);
		for (const boundary of context.config.architecture.boundaries) {
			if (matchesAny(edge.from, [boundary.from]) && matchesAny(edge.to, boundary.disallow))
				findings.push(
					makeFinding({
						ruleId: 'architecture/boundary',
						category: 'architecture',
						severity: 'major',
						file: edge.from,
						line: edge.line,
						message: 'Import violates an operator-defined architectural boundary',
						evidence: `${edge.from} imports ${edge.to}; policy: ${boundary.reason}`,
						recommendation:
							'Move the interaction behind the permitted boundary or revise the architectural requirement explicitly.',
						principles: ['BOUNDARIES', 'DIP', 'LAYERS', 'DOMAIN', 'SYSTEM_BOUNDARIES']
					})
				);
		}
	}

	for (const node of nodes) {
		node.fanIn = incoming.get(node.file)?.size ?? 0;
		node.fanOut = outgoing.get(node.file)?.size ?? 0;
		if (node.fanOut > context.config.architecture.maxFanOut)
			findings.push(
				makeFinding({
					ruleId: 'architecture/fan-out',
					category: 'architecture',
					severity: 'minor',
					file: node.file,
					message: 'Module imports many distinct audited modules',
					evidence: `Relative-import fan-out ${node.fanOut}; configured limit ${context.config.architecture.maxFanOut}`,
					recommendation:
						'Review whether this module coordinates too many independent responsibilities; composition roots may intentionally do so.',
					principles: ['COUPLING', 'MODULARITY'],
					method: 'heuristic',
					confidence: 0.7,
					assessment: 'potential_risk'
				})
			);
	}

	for (const cycle of cycles)
		findings.push(
			makeFinding({
				ruleId: 'architecture/cycle',
				category: 'architecture',
				severity: 'major',
				file: cycle[0],
				message: 'Runtime import graph contains a strongly connected component',
				evidence: `Mutually reachable modules: ${cycle.join(', ')}`,
				recommendation:
					'Move shared contracts into a lower-level module or introduce an explicit dependency boundary.',
				principles: ['CYCLES', 'COUPLING', 'MODULARITY']
			})
		);

	findings.push(...duplicateFindings(contents), ...requirementFindings(context, contents));
	return {
		findings,
		graph: { nodes, edges, cycles, unresolvedImports },
		analyzedFiles: context.inventory.files.length
	};
};

/** Exclude type-only dependencies from runtime cycle penalties. */
const runtimeEdge = (edge: GraphEdge): boolean => !edge.typeOnly;
