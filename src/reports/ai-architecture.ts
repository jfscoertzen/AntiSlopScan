/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { escapeHtml, renderConcept, renderGauge, renderIcon } from './presentation.js';
import type { AuditResult } from '../domain.js';

/** Publish separate model-score provenance and limits; complete interpretations/citations follow in the principle chapter. */
export const renderAiArchitecture = async (result: AuditResult): Promise<string> => {
	const review = result.aiArchitecture;

	if (!review) return '';
	const limits: string[] = [];
	const errors: string[] = [];

	for (const limit of review.limitations) limits.push(`<li>${escapeHtml(limit)}</li>`);
	for (const error of review.errors) errors.push(`<li>${escapeHtml(error)}</li>`);
	return `<section id="llm-architecture"><p class="folio">Optional semantic review</p><h2 class="chapter-title">LLM architecture assessment</h2><div class="ai-publication-summary"><div class="ai-score">${renderGauge(review.score, 'LLM sample score')}<div><h3>LLM sample score</h3><p>${review.status === 'partial' ? 'Incomplete review; no aggregate score.' : 'Sample-based assessment, separate from static quality and CI.'}</p><strong class="execution-${review.status}">${renderIcon(review.status === 'completed' ? 'circleCheck' : 'circleX')}${review.status === 'completed' ? 'Review completed' : 'Partial review'}</strong></div></div>${renderConcept('contracts')}</div><div class="summary ai-scope"><div><strong>${review.assessedPrinciples}/${review.requestedPrinciples}</strong>Principles graded</div><div><strong>${review.sampledFiles}/${review.totalFiles}</strong>Files sampled</div><div><strong>${review.sampledBytes.toLocaleString('en')}</strong>Redacted source bytes</div><div><strong>${review.sampledDocuments}</strong>Supplied architecture documents</div></div><dl class="publication-metadata"><div><dt>Provider and model</dt><dd>${escapeHtml(review.provider)} / ${escapeHtml(review.model)}</dd></div><div><dt>Endpoint</dt><dd><code>${escapeHtml(review.baseUrl)}</code></dd></div><div><dt>Completed / rubric</dt><dd>${escapeHtml(review.completedAt)} / ${escapeHtml(review.rubricVersion)}</dd></div></dl><details class="method-disclosure"><summary>${renderIcon('info')}Scoring methodology and assessment limits</summary><div><p>${escapeHtml(review.formula)}</p><ul>${limits.join('')}</ul></div></details>${errors.length ? `<div class="execution-errors"><h3>Provider execution errors</h3><ul>${errors.join('')}</ul></div>` : ''}<p class="caption">Full static assessments, model interpretations and exact citations appear together in the design and systems principle chapter. Confidence is an estimate, not a calibrated probability.</p></section>`;
};
