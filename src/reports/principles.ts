/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import {
	conceptExplanations,
	principleFamily,
	principleState
} from '../presentation/principles.js';
import { conceptLabels, escapeHtml, renderConcept, renderIcon } from './presentation.js';
import type { AuditResult, AiPrincipleReview, Principle, Finding } from '../domain.js';

/** Explain the four conceptual artwork families once rather than repeating decorative illustrations inside every assessment. */
const renderGuide = (): string => {
	const figures: string[] = [];

	for (const family of Object.keys(conceptLabels) as (keyof typeof conceptLabels)[])
		figures.push(
			`<figure>${renderConcept(family)}<figcaption><h3>${conceptLabels[family]}</h3><p>${escapeHtml(conceptExplanations[family])}</p></figcaption></figure>`
		);
	return `<div class="principle-guide">${figures.join('')}</div><p class="caption">Conceptual illustrations explain design principles. They do not depict this repository or establish runtime behavior.</p>`;
};

/** Retain complete model reasoning, recommendations and checked source citations as separately labeled interpretation. */
const renderInterpretation = (review: AiPrincipleReview): string => {
	const citations: string[] = [];

	for (const evidence of review.evidence)
		citations.push(
			`<div class="evidence-citation"><p><button disabled class="source-reference" data-drill="file" data-value="${escapeHtml(evidence.file)}">${renderIcon('file')}<code>${escapeHtml(evidence.file)}:${evidence.line}-${evidence.endLine}</code></button></p><pre>${escapeHtml(evidence.quote)}</pre></div>`
		);
	return `<div class="assessment-block llm-assessment"><h4>${renderIcon('workflow')}LLM interpretation <span>${escapeHtml(review.assessment.replaceAll('_', ' '))} / ${review.score === null ? 'Not scored' : `${review.score}/100`}</span></h4><p>${escapeHtml(review.reasoning)}</p><p class="recommendation"><strong>Recommendation:</strong> ${escapeHtml(review.recommendation)}</p><p class="caption">Estimated confidence ${Math.round(review.confidence * 100)}%. Quotes match transmitted source; this does not verify the model's interpretation.</p>${citations.join('')}</div>`;
};

/** Factor genuinely identical catalog guidance into chapter text while preserving any differing historical metadata. */
const commonGuidance = (
	principles: Principle[],
	field: 'falsePositives' | 'scoreImpact'
): string => {
	const value = principles[0]?.[field] ?? '';

	for (const principle of principles) if (principle[field] !== value) return '';
	return value;
};

/** Render one principle with distinct static/model evidence, without treating missing assessment as a pass. */
const renderPrinciple = (
	principle: Principle | undefined,
	review: AiPrincipleReview | undefined,
	findings: Map<string, Finding>,
	commonFalsePositives: string,
	commonImpact: string
): string => {
	const id = principle?.id ?? review!.principleId;
	const rules = new Set<string>();
	const links: string[] = [];
	const state = principle ? principleState(principle, review) : 'unassessed';
	const status = review
		? `LLM: ${review.assessment.replaceAll('_', ' ')}${review.score === null ? '' : ` / ${review.score}/100`}`
		: principle!.assessment.replaceAll('_', ' ');

	for (const findingId of principle?.findings ?? []) {
		const finding = findings.get(findingId);

		if (finding && finding.method !== 'ai_assisted') rules.add(finding.ruleId);
	}
	for (const rule of [...rules].slice(0, 8))
		links.push(
			`<button disabled class="rule-link" data-drill="ruleId" data-value="${escapeHtml(rule)}">${escapeHtml(rule)}</button>`
		);
	const staticBody = principle
		? `<div class="assessment-block static-assessment"><h4>${renderIcon('code')}Static assessment <span>${escapeHtml(principle.assessment.replaceAll('_', ' '))}</span></h4><p>${escapeHtml(principle.description)}</p><p><strong>Method and evidence:</strong> ${escapeHtml(principle.methodology)}</p>${principle.requiredEvidence !== principle.methodology ? `<p><strong>Required evidence:</strong> ${escapeHtml(principle.requiredEvidence)}</p>` : ''}${!commonFalsePositives ? `<p><strong>False positives:</strong> ${escapeHtml(principle.falsePositives)}</p>` : ''}<p class="recommendation"><strong>Recommendation:</strong> ${escapeHtml(principle.recommendation)}</p>${!commonImpact ? `<p class="caption">${escapeHtml(principle.scoreImpact)}</p>` : ''}${principle.findings.length ? `<p class="caption">${principle.findings.length} linked static findings / ${Math.round(principle.confidence * 100)}% estimated confidence / ${escapeHtml(principle.severity)} catalog severity.</p><div class="principle-rules">${links.join('')}</div>` : '<p class="caption">No linked static findings. This is not evidence of whole-system compliance.</p>'}</div>`
		: '<p class="caption">This historical model assessment has no matching static catalog entry.</p>';
	return `<details class="principle-report principle-${state}"><summary>${renderConcept(principleFamily(id))}<span><strong>${escapeHtml(principle?.name ?? id)}</strong><small>${escapeHtml(id)} / ${principle ? `${principle.findings.length} linked static findings` : 'Unmapped catalog entry'}</small></span><span class="principle-verdict">${escapeHtml(status)}</span>${renderIcon('chevron')}</summary><div class="principle-body">${staticBody}${review ? renderInterpretation(review) : ''}</div></details>`;
};

/** Join existing static and LLM assessments for publication; preserve orphan model assessments and all citations. */
export const renderPrinciples = (result: AuditResult): string => {
	const findings = new Map<string, Finding>();
	const reviews = new Map<string, AiPrincipleReview>();
	const rendered = new Set<string>();
	const entries: string[] = [];
	const falsePositives = commonGuidance(result.principles, 'falsePositives');
	const impact = commonGuidance(result.principles, 'scoreImpact');

	for (const finding of result.findings) findings.set(finding.id, finding);
	for (const review of result.aiArchitecture?.principles ?? [])
		reviews.set(review.principleId, review);
	for (const principle of result.principles) {
		entries.push(
			renderPrinciple(principle, reviews.get(principle.id), findings, falsePositives, impact)
		);
		rendered.add(principle.id);
	}
	for (const review of result.aiArchitecture?.principles ?? []) {
		if (!rendered.has(review.principleId))
			entries.push(renderPrinciple(undefined, review, findings, falsePositives, impact));
	}
	return `<section id="principles"><p class="folio">Design and systems intelligence</p><h2 class="chapter-title">Design and systems principles</h2><p>Static evidence and model interpretations are labeled separately. Unassessable principles receive no grade; source imports do not establish causal loops or runtime outcomes.</p>${renderGuide()}${falsePositives ? `<p class="method-note"><strong>Interpreting static indicators:</strong> ${escapeHtml(falsePositives)}</p>` : ''}${impact ? `<p class="caption">${escapeHtml(impact)}</p>` : ''}${entries.join('') || '<p>No principle assessments were recorded.</p>'}</section>`;
};
