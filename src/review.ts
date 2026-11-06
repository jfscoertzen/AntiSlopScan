/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import type { Finding } from './domain.js';

export const severityOrder = ['critical', 'major', 'minor', 'info'] as const;
export interface EvidenceFilters {
	query?: string; severity?: string; category?: string; ruleId?: string; file?: string;
	scanner?: string; assessment?: string; method?: string; minimumConfidence?: number;
	sort?: 'severity' | 'file' | 'confidence';
}
export interface EvidenceGroup { key: string; count: number; highSeverity: number }
export interface IssueReference { title: string; url: string }

/** Match exact evidence dimensions together so every caller applies the same field semantics. */
const matchesExactFilters = (finding: Finding, filters: EvidenceFilters): boolean => {
	for (const field of ['severity', 'category', 'ruleId', 'file', 'assessment', 'method'] as const) {
		if (filters[field] && finding[field] !== filters[field]) return false;
	}
	return true;
};

/** Filter and deterministically sort canonical findings without changing them or interpreting source as HTML. */
export const filterEvidence = (findings: Finding[], filters: EvidenceFilters = {}): Finding[] => {
	const query = filters.query?.trim().toLowerCase();
	const result: Finding[] = [];

	for (const finding of findings) {
		if (!matchesExactFilters(finding, filters)) continue;
		if (filters.scanner && !finding.sources.includes(filters.scanner) && finding.scanner !== filters.scanner) continue;
		if (finding.confidence * 100 < (filters.minimumConfidence ?? 0)) continue;
		if (query && !`${finding.file} ${finding.ruleId} ${finding.message} ${finding.evidence}`.toLowerCase().includes(query)) continue;
		result.push(finding);
	}

	return result.sort(/** Order evidence by the selected dimension, then source location and stable identity. */ (left, right) => {
		const primary = filters.sort === 'file' ? left.file.localeCompare(right.file)
			: filters.sort === 'confidence' ? right.confidence - left.confidence
				: severityOrder.indexOf(left.severity) - severityOrder.indexOf(right.severity);

		return primary || left.file.localeCompare(right.file) || left.line - right.line || left.id.localeCompare(right.id);
	});
};


/** Count complete evidence by rule, file, severity, or category; high severity remains separate from raw volume. */
export const groupEvidence = (findings: Finding[], field: 'ruleId' | 'file' | 'severity' | 'category'): EvidenceGroup[] => {
	const groups = new Map<string, EvidenceGroup>();

	for (const finding of findings) {
		const key = finding[field];
		const group = groups.get(key) ?? { key, count: 0, highSeverity: 0 };

		group.count += 1;
		if (finding.severity === 'critical' || finding.severity === 'major') group.highSeverity += 1;
		groups.set(key, group);
	}

	return [...groups.values()].sort(/** Rank by evidence volume with a stable key for tied groups. */ (left, right) => right.count - left.count || left.key.localeCompare(right.key));
};


/** Resolve only appliance-owned HTTPS references; never use repository-supplied URLs, paths, or query data. */
export const referencesFor = (finding: Finding): IssueReference[] => {
	const links: IssueReference[] = [];
	const aliases: Record<string, string> = { 'security/dynamic-evaluation': 'no-eval', 'errors/empty-catch': 'no-empty', 'async/promise-executor': 'no-async-promise-executor', 'design/complexity': 'complexity' };
	const rule = aliases[finding.ruleId] ?? finding.ruleId.replace(/^eslint\//, '');
	const sources = new Set([finding.scanner, ...finding.sources]);

	const eslintRules = new Set(['no-eval', 'no-new-func', 'no-empty', 'no-async-promise-executor', 'complexity', 'no-unreachable', 'no-constant-condition', 'no-dupe-args', 'no-dupe-keys', 'no-duplicate-case', 'no-unsafe-finally', 'no-unsafe-optional-chaining', 'no-promise-executor-return', 'no-var', 'eqeqeq', 'max-depth', 'max-params', 'max-lines-per-function', 'no-unused-vars', 'no-debugger', 'no-fallthrough', 'no-prototype-builtins']);

	if (sources.has('eslint') && eslintRules.has(rule)) links.push({ title: `ESLint: ${rule}`, url: `https://eslint.org/docs/latest/rules/${rule}` });
	else if (sources.has('eslint')) links.push({ title: 'ESLint rule reference', url: 'https://eslint.org/docs/latest/rules/' });
	if (sources.has('oxlint')) links.push({ title: 'Oxlint rule reference', url: 'https://oxc.rs/docs/guide/usage/linter/rules.html' });
	if (sources.has('oxlintAntiSlop')) links.push({ title: 'Vendored Anti-Slop rules', url: 'https://github.com/dmmulroy/anti-slop/tree/e8c4880471b23ab7f216fba7b27d173a6ef07d4c' });
	if (sources.has('slopscore')) links.push({ title: 'SlopScore detector documentation', url: 'https://github.com/Vinay-O/slopscore' });
	if (sources.has('rustAntiSlop')) links.push({ title: 'AntiSlop CLI rules and profiles', url: 'https://github.com/skew202/antislop' });
	if (sources.has('gitleaks')) links.push({ title: 'Gitleaks detection and remediation', url: 'https://github.com/gitleaks/gitleaks' });
	if (sources.has('ruff')) links.push({ title: 'Ruff rule reference', url: 'https://docs.astral.sh/ruff/rules/' });
	if (sources.has('radon')) links.push({ title: 'Radon complexity metrics', url: 'https://radon.readthedocs.io/en/latest/intro.html' });
	if (sources.has('jscpd')) links.push({ title: 'jscpd duplication detection', url: 'https://github.com/kucherenko/jscpd' });
	if (sources.has('dependencyCruiser')) links.push({ title: 'Dependency-cruiser rules', url: 'https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md' });
	if (sources.has('semgrep')) links.push({ title: 'Semgrep rule syntax and interpretation', url: 'https://semgrep.dev/docs/writing-rules/rule-syntax' });
	if (finding.ruleId === 'security/dynamic-evaluation') links.push({ title: 'OWASP: Code injection', url: 'https://owasp.org/www-community/attacks/Code_Injection' });
	if (finding.ruleId === 'errors/empty-catch' && !sources.has('eslint')) links.push({ title: 'ESLint: Empty blocks', url: 'https://eslint.org/docs/latest/rules/no-empty' });
	return links;
};
