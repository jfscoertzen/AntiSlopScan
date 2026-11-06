/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { redact } from '../findings.js';
import { withoutComments } from '../analysis/comments.js';
import type { AuditContext } from '../domain.js';

export interface SourceSample {
	file: string;
	startLine: number;
	endLine: number;
	content: string;
}
export interface AiInput {
	samples: SourceSample[];
	documents: { path: string; content: string }[];
	sampledBytes: number;
	graph: unknown;
	staticFindings: unknown[];
	requirements: unknown;
}

/** Truncate on a complete UTF-8 boundary so replacement characters cannot exceed the transmission budget. */
const boundedUtf8 = (content: string, bytes: number): string =>
	new TextDecoder().decode(Buffer.from(content).subarray(0, bytes), { stream: true });

/** Select bounded risk-prioritized and evenly spread source windows; redaction precedes every transmitted byte. */
export const collectAiEvidence = async (context: AuditContext): Promise<AiInput> => {
	const { inventory, config } = context;
	const risks = new Map<string, number>();
	const firstLines = new Map<string, number>();

	for (const finding of context.staticEvidence?.findings ?? []) {
		risks.set(
			finding.file,
			(risks.get(finding.file) ?? 0) +
				(finding.severity === 'critical' ? 12 : finding.severity === 'major' ? 4 : 1)
		);
		if (!firstLines.has(finding.file)) firstLines.set(finding.file, finding.line);
	}
	const ranked = [...inventory.files].sort(
		/** Prefer measured review candidates with deterministic path ordering. */ (left, right) =>
			(risks.get(right.path) ?? 0) - (risks.get(left.path) ?? 0) ||
			left.path.localeCompare(right.path)
	);
	const selected = new Map<string, (typeof ranked)[number]>();
	const target = Math.min(config.ai.maxFiles, ranked.length);

	for (const file of ranked.slice(0, Math.ceil(target / 2))) selected.set(file.path, file);
	const ordered = [...inventory.files].sort(
		/** Spread remaining sample slots across repository paths. */ (left, right) =>
			left.path.localeCompare(right.path)
	);

	for (let index = 0; index < ordered.length && selected.size < target; index += 1) {
		const file =
			ordered[Math.floor((index * ordered.length) / Math.max(1, target)) % ordered.length];

		selected.set(file.path, file);
	}
	for (const file of ranked) {
		if (selected.size < target) selected.set(file.path, file);
	}
	const samples: SourceSample[] = [];
	const perFileBytes = Math.max(
		256,
		Math.floor((config.ai.maxSourceBytes * 0.85) / Math.max(1, selected.size))
	);
	let remaining = config.ai.maxSourceBytes;
	let sampledBytes = 0;

	for (const file of selected.values()) {
		if (remaining <= 0) break;
		const source = await readFile(
			join(context.codeSnapshot ?? context.snapshot, file.path),
			'utf8'
		);
		const lines = redact(context.codeSnapshot ? source : withoutComments(file.path, source)).split(
			'\n'
		);
		const firstCode = lines.findIndex(
			/** Skip padding left by comments without changing citation line numbers. */ (line) =>
				line.trim().length > 0
		);

		if (firstCode < 0) continue;
		const startLine = Math.max(firstCode + 1, (firstLines.get(file.path) ?? 1) - 15);
		const excerpt = lines.slice(startLine - 1, startLine + 99).join('\n');
		const content = boundedUtf8(excerpt, Math.min(perFileBytes, remaining));
		const size = Buffer.byteLength(content);

		if (!content.trim()) continue;
		samples.push({
			file: file.path,
			startLine,
			endLine: startLine + content.split('\n').length - 1,
			content
		});
		remaining -= size;
		sampledBytes += size;
	}
	const documents: AiInput['documents'] = [];

	for (const document of inventory.documents) {
		if (remaining <= 0) break;
		const content = boundedUtf8(redact(document.content), remaining);

		documents.push({ path: document.path, content });
		remaining -= Buffer.byteLength(content);
	}
	const paths = new Set(
		samples.map(/** Identify the exact transmitted source windows. */ (sample) => sample.file)
	);
	const graph = context.staticEvidence?.graph;

	return {
		samples,
		documents,
		sampledBytes,
		graph: graph
			? {
					nodes: graph.nodes
						.filter(
							/** Retain source-linked structural context only. */ (node) => paths.has(node.file)
						)
						.slice(0, 80),
					edges: graph.edges
						.filter(
							/** Retain only import relationships touching sampled modules. */ (edge) =>
								paths.has(edge.from) || paths.has(edge.to)
						)
						.slice(0, 200),
					totalNodes: graph.nodes.length,
					totalEdges: graph.edges.length,
					unresolvedImports: graph.unresolvedImports
				}
			: null,
		staticFindings: (context.staticEvidence?.findings ?? [])
			.filter(/** Keep findings tied to transmitted source. */ (finding) => paths.has(finding.file))
			.slice(0, 40)
			.map(
				/** Bound explanatory context without exporting additional source. */ (finding) => ({
					file: finding.file,
					line: finding.line,
					ruleId: finding.ruleId,
					assessment: finding.assessment,
					principles: finding.principles,
					message: finding.message.slice(0, 300)
				})
			),
		requirements: config.architecture.requirements
	};
};
