/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { createHash } from 'node:crypto';
import type { Category, Finding, Method, Severity, Assessment } from './domain.js';

export interface FindingInput {
	ruleId: string; scanner?: string; category: Category; severity: Severity; file: string;
	line?: number; column?: number; message: string; evidence: string; recommendation: string;
	method?: Method; confidence?: number; assessment?: Assessment; principles?: string[];
}

/** Remove likely credentials from report text; security scanner output never includes matched values. */
export const redact = (content: string): string => content
	.replace(/\b(?:sk-(?:proj-)?[\w-]{16,}|gh[pousr]_[\w]{20,}|AKIA[A-Z0-9]{16})\b/g, '[REDACTED]')
	.replace(/((?:password|secret|api[_-]?key|access[_-]?token|authorization)\s*[=:]\s*)["'`]?[^\s"'`,;}]+/gi, '$1[REDACTED]')
	.replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g, '[REDACTED PRIVATE KEY]');


/** Create a canonical finding with content-based baseline identity and no source-derived identifier. */
export const makeFinding = (input: FindingInput): Finding => {
	const scanner = input.scanner ?? 'systems';
	const line = Math.max(1, input.line ?? 1);
	const evidence = redact(input.evidence).slice(0, 2000);
	const fingerprint = createHash('sha256').update(`${input.ruleId}\0${input.file}\0${evidence}`).digest('hex');

	return {
		...input, scanner, line, column: Math.max(1, input.column ?? 1),
		message: redact(input.message).slice(0, 2000), evidence,
		recommendation: redact(input.recommendation).slice(0, 2000),
		method: input.method ?? 'deterministic', confidence: input.confidence ?? 1,
		assessment: input.assessment ?? 'verified_violation', principles: input.principles ?? [],
		fingerprint, id: `${fingerprint.slice(0, 16)}-${line}`, sources: [scanner],
	};
};


/** Normalize equivalent scanner rules so overlapping evidence is scored once. */
export const canonicalRule = (rule: string): string => {
	const normalized = rule.replace(/^.*\//, '');
	const aliases: Record<string, string> = { 'empty-catch': 'errors/empty-catch', '053': 'errors/empty-catch', 'no-eval': 'security/dynamic-evaluation', 'no-new-func': 'security/dynamic-evaluation', 'dynamic-evaluation': 'security/dynamic-evaluation', 'no-async-promise-executor': 'async/promise-executor', 'promise-executor': 'async/promise-executor', 'complexity': 'design/complexity', 'complexity-high': 'design/complexity' };

	return aliases[normalized] ?? rule;
};


/** Deduplicate matching rule locations; preserve scanner attribution and strongest supported evidence. */
export const deduplicate = (findings: Finding[]): Finding[] => {
	const indexed = new Map<string, Finding>();
	const severityRank: Record<Severity, number> = { critical: 4, major: 3, minor: 2, info: 1 };
	const assessmentRank: Record<Assessment, number> = { verified_violation: 5, strong_evidence: 4, potential_risk: 3, informational: 2, not_assessable: 1, not_applicable: 0 };

	for (const finding of findings) {
		const ruleId = canonicalRule(finding.ruleId);
		const key = `${ruleId}:${finding.file}:${finding.line}`;
		const existing = indexed.get(key);

		if (!existing) { indexed.set(key, finding); continue; }
		const strongest = assessmentRank[finding.assessment] > assessmentRank[existing.assessment]
			|| (assessmentRank[finding.assessment] === assessmentRank[existing.assessment]
				&& (finding.confidence > existing.confidence || (finding.confidence === existing.confidence && finding.scanner === 'systems'))) ? finding : existing;
		const severity = severityRank[finding.severity] > severityRank[existing.severity] ? finding.severity : existing.severity;

		indexed.set(key, { ...strongest, severity, sources: [...new Set([...existing.sources, ...finding.sources])], principles: [...new Set([...existing.principles, ...finding.principles])] });
	}

	return [...indexed.values()].sort(compareFindings);
};


/** Order findings by severity, file, and source location for deterministic output. */
const compareFindings = (left: Finding, right: Finding): number => {
	const ranks: Record<Severity, number> = { critical: 0, major: 1, minor: 2, info: 3 };

	return ranks[left.severity] - ranks[right.severity] || left.file.localeCompare(right.file, 'en') || left.line - right.line || left.ruleId.localeCompare(right.ruleId, 'en');
};
