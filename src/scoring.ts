/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { categories, type AuditResult, type Category, type Config, type Finding, type ScannerResult, type Scores } from './domain.js';
import { scannerDefinition } from './scanners/catalog.js';

const severityWeights = { critical: 12, major: 4, minor: 1, info: 0 };
const assessmentWeights = { verified_violation: 1, strong_evidence: 0.8, potential_risk: 0.35, informational: 0, not_assessable: 0, not_applicable: 0 };
const RULE_OCCURRENCE_CAP = 10;
const DENSITY_SCALE = 20;

/** Check whether a category was explicitly enabled by the operator. */
export const categoryEnabled = (category: Category, config: Config): boolean => category === 'slop' || config.analysis[category];


/** Calculate reproducible density-based scores; unavailable coverage is never equated with clean code. */
export const calculateScores = (findings: Finding[], scanners: ScannerResult[], config: Config, totalLines: number): Scores => {
	const penalties = Object.fromEntries(categories.map(zeroCategory)) as Record<Category, number>;
	const categoryScores = Object.fromEntries(categories.map(nullCategory)) as Record<Category, number | null>;
	const counts = new Map<string, number>();
	const covered = new Set<Category>();
	let requested = 0;
	let completedFileFraction = 0;
	let confidenceTotal = 0;
	let confidenceCount = 0;

	for (const scanner of scanners) {
		if (scanner.status === 'skipped' || scanner.status === 'unsupported') continue;
		requested += 1;
		if (scanner.status !== 'completed') continue;
		completedFileFraction += scanner.analyzedFiles > 0 ? 1 : 0;
		for (const category of scannerDefinition(scanner.id).categories) covered.add(category);
	}

	for (const finding of findings) {
		if (!categoryEnabled(finding.category, config)) continue;
		const key = `${finding.category}/${finding.ruleId}`;
		const count = counts.get(key) ?? 0;

		if (count >= RULE_OCCURRENCE_CAP) continue;
		counts.set(key, count + 1);
		penalties[finding.category] += severityWeights[finding.severity] * finding.confidence * assessmentWeights[finding.assessment] * (config.rules.weights[finding.ruleId] ?? 1);
		if (assessmentWeights[finding.assessment] > 0) { confidenceTotal += finding.confidence; confidenceCount += 1; }
	}

	let weightedScore = 0;
	let totalWeight = 0;
	const kloc = Math.max(1, totalLines / 1000);

	for (const category of categories) {
		if (!categoryEnabled(category, config) || !covered.has(category) || completedFileFraction === 0) continue;
		const score = Math.round(100 / (1 + penalties[category] / kloc / DENSITY_SCALE));

		categoryScores[category] = score;
		weightedScore += score * config.scoring.weights[category];
		totalWeight += config.scoring.weights[category];
	}

	return {
		overall: totalWeight > 0 ? Math.round(weightedScore / totalWeight) : null,
		categories: categoryScores, coverage: requested > 0 ? Math.round(100 * completedFileFraction / requested) : 0,
		confidence: confidenceCount > 0 ? Math.round(100 * confidenceTotal / confidenceCount) : null,
		formula: 'Per category: round(100 / (1 + weightedEvidence / max(1,kLOC) / 20)). Severity critical=12 major=4 minor=1 info=0; confidence multiplier; verified=1 strong=.8 potential=.35 informational/unassessable=0; first 10 occurrences per rule/category; operator rule weights. Overall is the weighted mean of assessable categories. Coverage is completed applicable scanner runs with nonempty input / requested applicable runs; it is tool execution coverage, not proof of semantic completeness.',
		penalties,
	};
};


/** Create a zero-valued score entry. */
const zeroCategory = (category: Category): [Category, number] => [category, 0];


/** Create an explicitly unassessed score entry. */
const nullCategory = (category: Category): [Category, null] => [category, null];


/** Compute the CI decision after scanner and report outcomes are known; never gate an unknown result as passing. */
export const evaluateCi = (result: AuditResult, config: Config, baseline?: AuditResult): AuditResult['ci'] => {
	const reasons: string[] = [];
	const known = new Map<string, number>();
	let newHighSeverity: number | null = null;
	let scannerError = false;

	for (const scanner of result.scanners) {
		if (['failed', 'timed_out', 'unavailable'].includes(scanner.status)) scannerError = true;
	}

	if (baseline) {
		for (const finding of baseline.findings) {
			if (['critical', 'major'].includes(finding.severity)) known.set(finding.fingerprint, (known.get(finding.fingerprint) ?? 0) + 1);
		}
		newHighSeverity = 0;
		for (const finding of result.findings) {
			if (!['critical', 'major'].includes(finding.severity)) continue;
			const remaining = known.get(finding.fingerprint) ?? 0;

			if (remaining > 0) known.set(finding.fingerprint, remaining - 1);
			else newHighSeverity += 1;
		}
	}

	if (config.audit.failOnScannerError && scannerError) reasons.push('One or more requested scanners failed, timed out, or were unavailable');
	if (result.reports.some(reportFailed)) { scannerError = true; reasons.push('One or more requested reports failed to generate'); }
	if (result.scores.overall === null) reasons.push('No assessable overall score is available');
	if (config.ci.enabled) {
		if (result.scores.overall !== null && result.scores.overall < Math.max(config.ci.failBelowScore, config.scoring.minimumOverallScore)) reasons.push('Overall score is below the configured threshold');
		for (const [category, score] of Object.entries(result.scores.categories)) {
			if (score !== null && score < config.scoring.minimumCategoryScore) reasons.push(`${category} score is below the category threshold`);
		}
		if (result.scores.coverage < config.ci.minimumCoverage) reasons.push('Scanner execution coverage is below the configured threshold');
		if (config.ci.failOnCritical && result.findings.some(criticalFinding)) reasons.push('Critical findings are present');
		if (config.ci.failOnNewHighSeverityFindings && !baseline) reasons.push('New-high-severity gating requires a compatible baseline');
		if (config.ci.failOnNewHighSeverityFindings && newHighSeverity && newHighSeverity > 0) reasons.push('New high-severity findings are present');
	}

	return { passed: reasons.length === 0, reasons, newHighSeverity, exitCode: reasons.length === 0 ? 0 : scannerError && (config.audit.failOnScannerError || result.reports.some(reportFailed)) ? config.ci.exitCodes.scanner : config.ci.exitCodes.quality };
};


/** Identify an artifact-generation failure for CI policy. */
const reportFailed = (report: AuditResult['reports'][number]): boolean => report.status === 'failed';


/** Identify a critical actionable finding without treating an informational observation as an error. */
const criticalFinding = (finding: Finding): boolean => finding.severity === 'critical' && assessmentWeights[finding.assessment] > 0;
