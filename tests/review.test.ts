/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { expect, test } from '@jest/globals';
import { filterEvidence, groupEvidence, referencesFor } from '../src/review.js';
import type { Finding } from '../src/domain.js';

const finding: Finding = { id: 'one', ruleId: 'no-eval', scanner: 'eslint', category: 'security', severity: 'critical', assessment: 'potential_risk', method: 'deterministic', confidence: .8, file: 'src/a.ts', line: 7, column: 1, message: 'Dynamic evaluation', evidence: '<script>bad</script>', recommendation: 'Parse data', principles: [], fingerprint: 'a', sources: ['eslint'] };

/** Verify exact drill-down filters compose, respect confidence, and retain canonical objects. */
const filtering = (): void => {
	const minor: Finding = { ...finding, id: 'two', file: 'src/b.ts', severity: 'minor', confidence: .4 };

	expect(filterEvidence([minor, finding], { severity: 'critical', file: 'src/a.ts', ruleId: 'no-eval', scanner: 'eslint', assessment: 'potential_risk', method: 'deterministic', minimumConfidence: 70, query: 'SCRIPT', sort: 'severity' })).toEqual([finding]);
	expect(filterEvidence([finding], { minimumConfidence: 90 })).toEqual([]);
	expect(filterEvidence([finding], { scanner: 'gitleaks' })).toEqual([]);
	expect(filterEvidence([minor, finding], { sort: 'severity' })[0]).toBe(finding);
};


/** Verify grouped counts include all evidence and use stable deterministic tie-breaking. */
const grouping = (): void => {
	const groups = groupEvidence([finding, { ...finding, file: 'src/b.ts', severity: 'minor' }, { ...finding, ruleId: 'complexity' }], 'ruleId');

	expect(groups[0]).toEqual({ key: 'no-eval', count: 2, highSeverity: 1 });
	expect(groups[1].key).toBe('complexity');
};


/** Verify references are curated HTTPS destinations and never interpolate evidence or arbitrary URLs. */
const referenceSafety = (): void => {
	expect(referencesFor(finding)[0].url).toBe('https://eslint.org/docs/latest/rules/no-eval');
	const hostile = referencesFor({ ...finding, ruleId: 'javascript:alert(1)', scanner: 'unknown', sources: [], message: 'https://evil.invalid' });

	expect(hostile).toEqual([]);
	expect(referencesFor({ ...finding, scanner: 'gitleaks', sources: ['gitleaks'], ruleId: 'generic-api-key' })[0].url).toContain('github.com/gitleaks/gitleaks');
	expect(referencesFor({ ...finding, ruleId: 'security/dynamic-evaluation' })[0].url).toBe('https://eslint.org/docs/latest/rules/no-eval');
};

test('review filters compose and prioritize severity', filtering);
test('review groups preserve complete counts', grouping);
test('online references cannot be supplied by repository evidence', referenceSafety);
