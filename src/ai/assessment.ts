/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { Ajv } from 'ajv';
import { redact } from '../findings.js';
import type { AiPrincipleReview, AiEvidence } from '../domain.js';
import type { SourceSample } from './evidence.js';

export const aiPrincipleSchema = {
	type: 'object',
	additionalProperties: false,
	required: ['principleId', 'assessment', 'score', 'confidence', 'reasoning', 'recommendation', 'evidence'],
	properties: {
		principleId: { type: 'string', minLength: 1, maxLength: 100 },
		assessment: { enum: ['supported', 'potential_risk', 'violation', 'not_assessable', 'not_applicable'] },
		score: { type: ['integer', 'null'], minimum: 0, maximum: 100 },
		confidence: { type: 'number', minimum: 0, maximum: 1 },
		reasoning: { type: 'string', minLength: 5, maxLength: 2000 },
		recommendation: { type: 'string', minLength: 5, maxLength: 2000 },
		evidence: {
			type: 'array',
			maxItems: 3,
			items: {
				type: 'object',
				additionalProperties: false,
				required: ['file', 'line', 'endLine', 'quote'],
				properties: {
					file: { type: 'string', maxLength: 4096 },
					line: { type: 'integer', minimum: 1 },
					endLine: { type: 'integer', minimum: 1 },
					quote: { type: 'string', minLength: 8, maxLength: 500 }
				}
			}
		}
	}
};

/** Build a strict provider response schema for exactly the requested known principles. */
export const principleBatchSchema = (ids: string[]): Record<string, unknown> => ({
	type: 'object',
	additionalProperties: false,
	required: ['assessments'],
	properties: {
		assessments: {
			type: 'array',
			minItems: ids.length,
			maxItems: ids.length,
			items: {
				...aiPrincipleSchema,
				properties: { ...aiPrincipleSchema.properties, principleId: { enum: ids } }
			}
		}
	}
});

/** Assign immutable source-reference IDs so models select actual excerpts instead of transcribing code. */
export const evidenceCatalog = (samples: SourceSample[]): (AiEvidence & { id: string })[] => {
	const catalog: (AiEvidence & { id: string })[] = [];

	for (const [sampleIndex, sample] of samples.entries()) {
		const lines = sample.content.split('\n');

		for (let index = 0; index < lines.length; index += 4) {
			const quote = Array.from(lines.slice(index, index + 4).join('\n')).slice(0, 500).join('');

			if (quote.trim().length < 8) continue;
			catalog.push({
				id: `S${sampleIndex + 1}.${index + 1}`,
				file: sample.file,
				line: sample.startLine + index,
				endLine: Math.min(sample.endLine, sample.startLine + index + 3),
				quote
			});
		}
	}
	return catalog;
};

/** Require known source IDs in model output; canonical paths, ranges and quotes are assigned by the appliance. */
export const referenceBatchSchema = (ids: string[], references: string[]): Record<string, unknown> => {
	const { evidence: _evidence, ...properties } = aiPrincipleSchema.properties;

	return {
		type: 'object',
		additionalProperties: false,
		required: ['assessments'],
		properties: {
			assessments: {
				type: 'array',
				minItems: ids.length,
				maxItems: ids.length,
				items: {
					type: 'object',
					additionalProperties: false,
					required: [
						'principleId',
						'assessment',
						'score',
						'confidence',
						'reasoning',
						'recommendation',
						'evidenceIds'
					],
					properties: {
						...properties,
						principleId: { enum: ids },
						evidenceIds: { type: 'array', maxItems: 3, uniqueItems: true, items: { enum: references } }
					}
				}
			}
		}
	};
};

/** Resolve immutable citation IDs and then validate the complete canonical review contract. */
export const resolvePrincipleReferences = (
	answer: unknown,
	ids: string[],
	samples: SourceSample[]
): AiPrincipleReview[] => {
	const catalog = evidenceCatalog(samples);
	const validator = new Ajv({ strict: false }).compile(
		referenceBatchSchema(
			ids,
			catalog.map(/** Supply only known reference IDs. */ (entry) => entry.id)
		)
	);

	if (!validator(answer)) throw new Error('AI reference output does not match the assessment schema');
	const input = answer as {
		assessments: (Omit<AiPrincipleReview, 'evidence'> & { evidenceIds: string[] })[];
	};
	const assessments = input.assessments.map(
		/** Resolve only validated catalog entries, preserving model interpretation separately. */ (item) => {
			const { evidenceIds, ...review } = item;
			const evidence = evidenceIds.map(
				/** Copy the immutable source location rather than model-supplied coordinates. */ (id) => {
					const { id: _id, ...entry } = catalog.find(
						/** Resolve an ID permitted by the validated schema. */ (candidate) => candidate.id === id
					)!;

					return entry;
				}
			);

			return { ...review, evidence };
		}
	);

	return validatePrincipleBatch({ assessments }, ids, samples);
};

/** Reject invented locations, quotes, duplicate/omitted IDs, unsupported scores and low-confidence grading. */
export const validatePrincipleBatch = (
	input: unknown,
	ids: string[],
	samples: SourceSample[]
): AiPrincipleReview[] => {
	const validate = new Ajv({ strict: false }).compile(principleBatchSchema(ids));

	if (!validate(input)) throw new Error('AI principle output does not match the assessment schema');
	const reviews = (input as { assessments: AiPrincipleReview[] }).assessments;
	const seen = new Set<string>();

	for (const review of reviews) {
		if (seen.has(review.principleId)) throw new Error('AI response repeats a principle');
		seen.add(review.principleId);
		const uncertain = ['not_assessable', 'not_applicable'].includes(review.assessment);

		if (uncertain && review.score !== null)
			throw new Error('Unassessable principles must not receive scores');
		if (!uncertain && (review.score === null || review.confidence < 0.6 || !review.evidence.length))
			throw new Error('AI scores require cited evidence and at least 60% estimated confidence');
		if (
			review.score !== null &&
			((review.assessment === 'supported' && review.score < 80) ||
				(review.assessment === 'potential_risk' && (review.score < 40 || review.score > 79)) ||
				(review.assessment === 'violation' && review.score > 39))
		)
			throw new Error('AI score contradicts the declared rubric');
		for (const evidence of review.evidence) {
			const sample = samples.find(
				/** Match only transmitted source, never arbitrary repository paths. */ (item) =>
					item.file === evidence.file
			);

			if (
				!sample ||
				evidence.line < sample.startLine ||
				evidence.endLine > sample.endLine ||
				evidence.endLine < evidence.line
			)
				throw new Error('AI evidence has no location in the transmitted sample');
			const cited = sample.content
				.split('\n')
				.slice(evidence.line - sample.startLine, evidence.endLine - sample.startLine + 1)
				.join('\n');

			if (!cited.replace(/\s+/g, ' ').includes(evidence.quote.replace(/\s+/g, ' ')))
				throw new Error('AI evidence quote does not match the cited sample lines');
		}
		review.reasoning = redact(review.reasoning);
		review.recommendation = redact(review.recommendation);
	}
	return reviews;
};

/** Average only eligible model grades; partial execution and no evidence never produce a passing aggregate. */
export const summarizeAiScore = (
	reviews: AiPrincipleReview[],
	partial: boolean
): { score: number | null; assessedPrinciples: number } => {
	const eligible = reviews.filter(
		/** Exclude unassessable and inapplicable principles from the denominator. */ (review) =>
			review.score !== null
	);
	const total = eligible.reduce(
		/** Sum existing validated grades without changing their semantics. */ (sum, review) =>
			sum + review.score!,
		0
	);

	return {
		score: !partial && eligible.length ? Math.round(total / eligible.length) : null,
		assessedPrinciples: eligible.length
	};
};
