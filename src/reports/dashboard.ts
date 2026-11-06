/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { groupEvidence, severityOrder } from '../review.js';
import { categoryPresentation } from '../presentation/categories.js';
import { escapeHtml, escapePath, renderIcon } from './presentation.js';
import type { AuditResult, Finding } from '../domain.js';

export { escapeHtml } from './presentation.js';

/** Render count-ranked drill-downs with full evidence counts and explicit high-severity subtotals. */
const renderRanking = (findings: Finding[], field: 'ruleId' | 'file', title: string): string => {
	const items: string[] = [];

	for (const group of groupEvidence(findings, field).slice(0, 8))
		items.push(
			`<li><button disabled class="rank-button" data-drill="${field}" data-value="${escapeHtml(group.key)}"><span>${field === 'file' ? escapePath(group.key) : escapeHtml(group.key)}</span><strong>${group.count.toLocaleString('en')}<small>${group.highSeverity} critical / major</small></strong></button></li>`
		);
	return `<div class="ranking"><h3>${renderIcon(field === 'file' ? 'file' : 'scan')}${title}</h3>${items.length ? `<ol class="rank-list">${items.join('')}</ol>` : '<p>No findings to group.</p>'}</div>`;
};

/** Draw proportional severity segments from actual counts; the adjacent controls expose every exact value. */
const severityRing = (result: AuditResult): string => {
	const segments: string[] = [];
	const circumference = 2 * Math.PI * 52;
	let offset = 0;

	for (const severity of severityOrder) {
		let count = 0;

		for (const finding of result.findings) if (finding.severity === severity) count += 1;
		const length = (circumference * count) / Math.max(1, result.findings.length);

		segments.push(
			`<circle class="severity-segment ${severity}" cx="76" cy="76" r="52" stroke-dasharray="${length} ${circumference}" stroke-dashoffset="${-offset}"><title>${severity}: ${count}</title></circle>`
		);
		offset += length;
	}
	return `<svg class="severity-chart" viewBox="0 0 152 152" width="152" height="152" role="img" aria-label="Severity distribution; exact counts follow"><circle class="severity-track" cx="76" cy="76" r="52"/><g transform="rotate(-90 76 76)">${segments.join('')}</g><text x="76" y="76" text-anchor="middle">${result.findings.length.toLocaleString('en')}</text><text class="chart-unit" x="76" y="95" text-anchor="middle">findings</text></svg>`;
};

/** Render an evidence-derived dashboard; count volume is not presented as a vulnerability probability. */
export const renderDashboard = (result: AuditResult): string => {
	const severityRows: string[] = [];
	const scoreRows: string[] = [];

	for (const severity of severityOrder) {
		let count = 0;

		for (const finding of result.findings) if (finding.severity === severity) count += 1;
		severityRows.push(
			`<button disabled class="bar-row" data-drill="severity" data-value="${severity}"><span class="${severity}">${renderIcon(severity === 'critical' ? 'circleX' : severity === 'major' ? 'alert' : 'info')}${severity}</span><strong>${count.toLocaleString('en')}</strong></button>`
		);
	}
	for (const [category, score] of Object.entries(result.scores.categories)) {
		const presentation = categoryPresentation[category as keyof typeof categoryPresentation];

		scoreRows.push(
			`<button disabled class="bar-row category-row" data-drill="category" data-value="${category}"><span>${renderIcon(presentation.icon)}${presentation.label}</span><meter value="${score ?? 0}" max="100" aria-label="${presentation.label} quality score"></meter><strong>${score ?? 'N/A'}</strong></button>`
		);
	}
	return `<section id="dashboard"><p class="folio">Evidence overview</p><h2 class="chapter-title">Where to look first</h2><div class="dashboard-grid"><div class="distribution"><h3>${renderIcon('scan')}Findings by severity</h3><div class="severity-layout">${severityRing(result)}<div class="severity-legend">${severityRows.join('')}</div></div><p class="caption">Severity classifies findings; it is not a probability. Select a count to inspect its evidence.</p></div><div class="category-scores"><h3>${renderIcon('gauge')}Category scores</h3>${scoreRows.join('')}<p class="caption">Higher is better. Unassessed categories have no score.</p></div>${renderRanking(result.findings, 'ruleId', 'Most frequent rules')}${renderRanking(result.findings, 'file', 'Files with most findings')}</div><p class="caption">Counts include heuristic and informational observations. Repeated low-severity rules can dominate volume. Review the evidence before prioritizing work.</p></section>`;
};
