/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import type { AuditResult, Finding } from '../domain.js';

/** Encode each path segment without converting source paths into executable or remote URLs. */
const encodePath = (path: string): string => path.split('/').map(encodeURIComponent).join('/');


/** Convert the canonical result into SARIF 2.1.0, preserving fingerprints, confidence, and execution failures. */
export const renderSarif = (result: AuditResult): object => {
	const rules = new Map<string, object>();
	const results: object[] = [];
	const notifications: object[] = [];

	for (const finding of result.findings) {
		if (!rules.has(finding.ruleId)) rules.set(finding.ruleId, { id: finding.ruleId, name: finding.ruleId, shortDescription: { text: finding.message }, help: { text: finding.recommendation }, properties: { tags: [finding.category, ...finding.principles] } });
		results.push({ ruleId: finding.ruleId, level: sarifLevel(finding), message: { text: finding.message }, locations: [{ physicalLocation: { artifactLocation: { uri: encodePath(finding.file) }, region: { startLine: finding.line, startColumn: finding.column } } }], partialFingerprints: { 'antislopscan/v1': finding.fingerprint }, properties: { category: finding.category, confidence: finding.confidence, method: finding.method, assessment: finding.assessment, scanners: finding.sources } });
	}
	let executionSuccessful = true;

	for (const scanner of result.scanners) {
		if (['failed', 'timed_out', 'unavailable'].includes(scanner.status)) {
			executionSuccessful = false;
			notifications.push({ level: 'error', descriptor: { id: `scanner/${scanner.id}` }, message: { text: `${scanner.name}: ${scanner.status}. ${scanner.message ?? ''}` } });
		}
	}

	return { version: '2.1.0', $schema: 'https://json.schemastore.org/sarif-2.1.0.json', runs: [{ tool: { driver: { name: 'antislopscan', version: result.applianceVersion, rules: [...rules.values()] } }, invocations: [{ executionSuccessful, toolExecutionNotifications: notifications }], results, properties: { auditId: result.id, coverage: result.scores.coverage, overallScore: result.scores.overall, ...(result.aiArchitecture ? { aiArchitecture: result.aiArchitecture } : {}) } }] };
};


/** Map actionable findings to SARIF levels while keeping advisory observations as notes. */
const sarifLevel = (finding: Finding): string => finding.assessment === 'informational' || finding.severity === 'info' ? 'note' : ['critical', 'major'].includes(finding.severity) ? 'error' : 'warning';
