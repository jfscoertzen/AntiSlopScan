/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { fileURLToPath } from 'node:url';
import { canonicalRule, makeFinding } from '../findings.js';
import { findingPath } from '../security/snapshot.js';
import type { AuditContext, Category, Finding, Severity } from '../domain.js';

/** Require an object in scanner output; reject schema drift rather than invent an empty result. */
export const record = (input: unknown): Record<string, unknown> => {
	if (input === null || typeof input !== 'object' || Array.isArray(input)) throw new Error('Scanner output expected an object');
	return input as Record<string, unknown>;
};


/** Require an array in scanner output. */
export const array = (input: unknown): unknown[] => {
	if (!Array.isArray(input)) throw new Error('Scanner output expected an array');
	return input;
};


/** Require a bounded scanner string. */
export const string = (input: unknown): string => {
	if (typeof input !== 'string' || input.length > 20000) throw new Error('Scanner output expected a bounded string');
	return input;
};


/** Require a positive integer source location. */
const lineNumber = (input: unknown): number => {
	if (typeof input !== 'number' || !Number.isSafeInteger(input) || input < 1) throw new Error('Scanner output has an invalid location');
	return input;
};


/** Resolve a scanner file URI only when it names an included source file. */
export const sourcePath = (context: AuditContext, input: unknown): string => {
	const uri = string(input);
	const path = findingPath(context.snapshot, uri.startsWith('file:') ? fileURLToPath(uri) : decodeURIComponent(uri));

	for (const file of context.inventory.files) { if (file.path === path) return path; }
	throw new Error('Scanner output refers to a file outside its audited inventory');
};


/** Normalize SARIF from installed tools, rejecting malformed result structures and failure notifications. */
export const fromSarif = (input: unknown, scanner: string, context: AuditContext): Finding[] => {
	const document = record(input);
	const findings: Finding[] = [];

	if (document.version !== '2.1.0') throw new Error('Unsupported scanner SARIF version');
	for (const rawRun of array(document.runs)) {
		const run = record(rawRun);

		for (const rawInvocation of run.invocations === undefined ? [] : array(run.invocations)) {
			if (record(rawInvocation).executionSuccessful === false) throw new Error('Scanner SARIF reports unsuccessful execution');
		}

		for (const rawResult of array(run.results)) {
			const result = record(rawResult);
			const rule = string(result.ruleId);
			const locations = array(result.locations);

			if (!locations.length) throw new Error('Scanner finding has no location');
			const physical = record(record(locations[0]).physicalLocation);
			const artifact = record(physical.artifactLocation);
			const region = record(physical.region);
			const file = sourcePath(context, artifact.uri);
			const rawMessage = string(record(result.message).text);
			const category: Category = scanner === 'gitleaks' || scanner === 'semgrep' ? 'security' : scanner === 'rustAntiSlop' || scanner === 'oxlintAntiSlop' ? 'slop' : scanner === 'jscpd' ? 'maintainability' : 'codeQuality';
			const severity: Severity = scanner === 'gitleaks' ? 'critical' : result.level === 'error' ? 'major' : result.level === 'note' ? 'info' : 'minor';
			const heuristic = ['rustAntiSlop', 'oxlintAntiSlop', 'jscpd'].includes(scanner);
			const message = scanner === 'gitleaks' ? 'Credential pattern detected; matched value withheld' : rawMessage;
			const ruleId = scanner === 'jscpd' ? 'design/duplication' : canonicalRule(rule.replace(/^eslint\(([^)]+)\)$/, '$1'));

			findings.push(makeFinding({ ruleId, scanner, category, severity, file, line: lineNumber(region.startLine), column: region.startColumn === undefined ? 1 : lineNumber(region.startColumn), message, evidence: `${scanner} rule ${ruleId}: ${message}`, recommendation: scanner === 'gitleaks' ? 'Remove exposed credentials from source and rotate them through the owning secret-management process.' : 'Review the scanner evidence in context and apply the corresponding rule guidance.', method: heuristic ? 'heuristic' : 'deterministic', confidence: heuristic ? 0.7 : 0.95, assessment: heuristic ? 'potential_risk' : 'strong_evidence', principles: scanner === 'jscpd' ? ['DRY'] : [] }));
		}
	}

	return findings;
};


/** Normalize verified SlopScore 2.7 JSON fields without retaining raw snippets or credentials. */
export const fromSlopScore = (input: unknown, context: AuditContext): { findings: Finding[]; analyzedFiles: number } => {
	const result = record(input);
	const findings: Finding[] = [];

	if (typeof result.fileCount !== 'number' || result.fileCount < 0) throw new Error('SlopScore omitted fileCount');
	for (const raw of array(result.findings)) {
		const item = record(raw);

		if (context.codeSnapshot && item.id === '055') continue;
		const category: Category = item.category === 'security' ? 'security' : 'slop';
		const severity = string(item.severity) as Severity;

		if (!['critical', 'major', 'minor'].includes(severity)) throw new Error('Unsupported SlopScore severity');
		const ruleId = canonicalRule(string(item.id));
		const message = string(item.title);

		findings.push(makeFinding({ ruleId, scanner: 'slopscore', category, severity, file: sourcePath(context, item.file), line: lineNumber(item.line), message, evidence: `SlopScore rule ${ruleId}: ${message}`, recommendation: string(item.fix), confidence: item.confidence === 'high' ? 0.9 : item.confidence === 'medium' ? 0.65 : 0.4, method: 'heuristic', assessment: 'potential_risk' }));
	}

	return { findings, analyzedFiles: result.fileCount };
};
