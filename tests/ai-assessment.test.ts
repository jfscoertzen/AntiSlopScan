/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { expect, test } from '@jest/globals';
import {
	validatePrincipleBatch,
	summarizeAiScore,
	resolvePrincipleReferences
} from '../src/ai/assessment.js';

const sample = {
	file: 'module.ts',
	startLine: 10,
	endLine: 12,
	content: 'export const read = () => state;\nexport const write = (value) => { state = value; };\n'
};
const review = {
	principleId: 'CQS',
	assessment: 'supported',
	score: 90,
	confidence: 0.8,
	reasoning: 'Read and write contracts are separate in the supplied sample.',
	recommendation: 'Verify the same separation in callers.',
	evidence: [{ file: 'module.ts', line: 10, endLine: 10, quote: 'export const read = () => state;' }]
};

/** Require exact sample evidence, valid IDs, uncertainty exclusion, confidence, and complete batch accounting. */
const assessmentContract = (): void => {
	expect(validatePrincipleBatch({ assessments: [review] }, ['CQS'], [sample])[0].score).toBe(90);
	expect(
		/** Reject a line outside the transmitted source window. */ () =>
			validatePrincipleBatch(
				{ assessments: [{ ...review, evidence: [{ ...review.evidence[0], line: 1 }] }] },
				['CQS'],
				[sample]
			)
	).toThrow();
	expect(
		/** Reject model-invented source text. */ () =>
			validatePrincipleBatch(
				{
					assessments: [
						{ ...review, evidence: [{ ...review.evidence[0], quote: 'invented source evidence' }] }
					]
				},
				['CQS'],
				[sample]
			)
	).toThrow();
	expect(
		/** Reject unrequested principle identifiers. */ () =>
			validatePrincipleBatch({ assessments: [review] }, ['DRY'], [sample])
	).toThrow();
	expect(
		/** Reject duplicate or overfull batches. */ () =>
			validatePrincipleBatch({ assessments: [review, review] }, ['CQS'], [sample])
	).toThrow();
	expect(
		/** Refuse a score below the confidence threshold. */ () =>
			validatePrincipleBatch({ assessments: [{ ...review, confidence: 0.2 }] }, ['CQS'], [sample])
	).toThrow();
	expect(
		/** Keep unassessable principles outside scoring. */ () =>
			validatePrincipleBatch(
				{ assessments: [{ ...review, assessment: 'not_assessable' }] },
				['CQS'],
				[sample]
			)
	).toThrow();
	const { evidence: _evidence, ...wire } = review;
	const resolved = resolvePrincipleReferences(
		{ assessments: [{ ...wire, evidenceIds: ['S1.1'] }] },
		['CQS'],
		[sample]
	);

	expect(resolved[0].evidence[0].line).toBe(10);
	expect(resolved[0].evidence[0].quote).toContain('export const read');
	expect(
		/** Reject references outside the appliance-assigned catalog. */ () =>
			resolvePrincipleReferences({ assessments: [{ ...wire, evidenceIds: ['OUTSIDE'] }] }, ['CQS'], [sample])
	).toThrow();
	const unknown = { ...review, assessment: 'not_assessable', score: null, confidence: 0, evidence: [] };

	expect(validatePrincipleBatch({ assessments: [unknown] }, ['CQS'], [sample])[0].score).toBeNull();
	expect(summarizeAiScore([review, unknown] as never, false)).toEqual({ score: 90, assessedPrinciples: 1 });
	expect(summarizeAiScore([review] as never, true).score).toBeNull();
	expect(summarizeAiScore([], false).score).toBeNull();
};

test(
	'LLM scores require complete batches and cited evidence; uncertainty and partial failures never pass',
	assessmentContract
);
