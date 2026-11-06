/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { applicationRoot } from '../security/process.js';
import { categories, type AuditResult, type Config, type Finding } from '../domain.js';
import { referencesFor, groupEvidence } from '../review.js';
import { escapeHtml, renderDashboard } from './dashboard.js';
import { renderAiArchitecture } from './ai-architecture.js';
import {
	loadPresentation,
	renderAssetDefinitions,
	renderCover,
	renderBrand,
	renderIcon,
	escapePath
} from './presentation.js';
import { renderPrinciples } from './principles.js';
import { categoryPresentation, severityIcons } from '../presentation/categories.js';

export { escapeHtml } from './dashboard.js';

/** Render standalone HTML; PDF summary rendering may omit the evidence appendix without changing full-audit statistics. */
export const renderHtml = async (
	result: AuditResult,
	config: Config,
	includeFindings = true
): Promise<string> => {
	const presentation = await loadPresentation();
	const { css, mark } = presentation;
	const aiArchitecture = await renderAiArchitecture(result);
	const script = await readFile(join(applicationRoot, 'assets/report.js'), 'utf8');
	const scriptHash = createHash('sha256').update(script).digest('base64');
	const scannerRows: string[] = [];
	const categoryOptions: string[] = [];
	const scores: string[] = [];
	const findings: string[] = [];
	const limitations: string[] = [];
	const fileOptions: string[] = [];
	const ruleOptions: string[] = [];
	const scannerOptions: string[] = [];

	for (const group of groupEvidence(result.findings, 'file'))
		fileOptions.push(
			`<option value="${escapeHtml(group.key)}">${escapeHtml(group.key)} (${group.count})</option>`
		);
	for (const group of groupEvidence(result.findings, 'ruleId'))
		ruleOptions.push(
			`<option value="${escapeHtml(group.key)}">${escapeHtml(group.key)} (${group.count})</option>`
		);
	for (const scanner of result.scanners)
		scannerOptions.push(
			`<option value="${escapeHtml(scanner.id)}">${escapeHtml(scanner.name)}</option>`
		);

	for (const scanner of result.scanners)
		scannerRows.push(
			`<tr><td><strong>${escapeHtml(scanner.name)}</strong><br><span class="muted">${escapeHtml(scanner.version)}</span></td><td class="status execution-${scanner.status}">${renderIcon(scanner.status === 'completed' ? 'circleCheck' : ['failed', 'timed_out', 'unavailable'].includes(scanner.status) ? 'circleX' : 'info')}${escapeHtml(scanner.status.replaceAll('_', ' '))}</td><td class="numeric">${scanner.analyzedFiles}</td><td class="numeric">${scanner.durationMs.toLocaleString('en')} ms</td><td>${escapeHtml(scanner.message ?? '')}</td></tr>`
		);
	for (const category of categories) {
		categoryOptions.push(
			`<option value="${category}">${categoryPresentation[category].label}</option>`
		);
		scores.push(
			`<tr><th scope="row">${renderIcon(categoryPresentation[category].icon)}${categoryPresentation[category].label}</th><td class="numeric">${result.scores.categories[category] ?? 'Not assessed'}</td><td class="numeric">${result.scores.penalties[category].toFixed(2)}</td></tr>`
		);
	}
	if (includeFindings)
		for (const finding of result.findings) findings.push(renderFinding(finding, config));
	for (const limitation of result.limitations)
		limitations.push(`<li>${escapeHtml(limitation)}</li>`);
	const ciReasons: string[] = [];

	for (const reason of result.ci.reasons) ciReasons.push(`<li>${escapeHtml(reason)}</li>`);
	const reportRows: string[] = [];

	for (const report of result.reports)
		reportRows.push(
			`<li>${escapeHtml(report.format)}: ${escapeHtml(report.status)} ${escapeHtml(report.message ?? '')}</li>`
		);
	return `<!doctype html>
<html lang="en" data-accent="teal"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-${scriptHash}'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; connect-src 'none'">
<title>antislopscan audit: ${escapeHtml(result.project.name)}</title><link rel="icon" href="data:image/png;base64,${mark}"><style>${css}</style></head>
<body>${renderAssetDefinitions(presentation)}<a class="skip" href="#report-main">Skip to audit outcome</a>${renderCover(result, config, presentation)}
<main id="report-main">
${renderDashboard(result)}
${aiArchitecture}
<section aria-labelledby="scores"><p class="folio">Quality model and decision</p><h2 id="scores" class="chapter-title">Score methodology</h2><div class="scroll"><table><thead><tr><th>Category</th><th>Score / 100</th><th>Weighted evidence</th></tr></thead><tbody>${scores.join('')}</tbody></table></div><details class="method-disclosure"><summary>${renderIcon('info')}Scoring methodology and confidence</summary><div><p>${escapeHtml(result.scores.formula)}</p><p>${result.scores.confidence === null ? 'No actionable finding confidence was estimated.' : `Mean finding confidence: ${result.scores.confidence}%.`} Confidence is a detector estimate, not an empirical probability. Not assessed categories are omitted from the overall weighted mean.</p></div></details>${config.reports.includeExecutiveSummary ? `<div class="ci-decision"><h3>${renderIcon(result.ci.passed ? 'circleCheck' : 'circleX')}Configured CI gate: ${result.ci.passed ? 'Pass' : 'Fail'}</h3>${ciReasons.length ? `<ul>${ciReasons.join('')}</ul>` : '<p>All configured gate conditions were met.</p>'}</div>` : ''}</section>
${includeFindings ? `<section id="findings" tabindex="-1"><p class="folio">Evidence explorer</p><h2>Findings and evidence</h2><div class="controls"><label for="search">Search findings<input id="search" type="search" placeholder="Rule, path, or evidence"></label><label for="severity">Severity<select id="severity"><option value="">All severities</option><option>critical</option><option>major</option><option>minor</option><option>info</option></select></label><label for="category">Category<select id="category"><option value="">All categories</option>${categoryOptions.join('')}</select></label></div><details class="advanced"><summary>Advanced filters</summary><div class="controls"><label for="ruleId">Rule<select id="ruleId"><option value="">All rules</option>${ruleOptions.join('')}</select></label><label for="file">File<select id="file"><option value="">All files</option>${fileOptions.join('')}</select></label><label for="scanner">Scanner<select id="scanner"><option value="">All scanners</option>${scannerOptions.join('')}</select></label><label for="assessment">Assessment<select id="assessment"><option value="">All assessments</option><option value="verified_violation">Verified violation</option><option value="strong_evidence">Strong evidence</option><option value="potential_risk">Potential risk</option><option value="informational">Informational observation</option></select></label><label for="method">Method<select id="method"><option value="">All methods</option><option value="deterministic">Deterministic</option><option value="heuristic">Heuristic</option><option value="ai_assisted">AI assisted</option></select></label><label for="confidence">Minimum confidence (%)<input id="confidence" type="number" min="0" max="100" value="0"></label></div></details><div class="controls"><label for="sort">Sort findings<select id="sort"><option value="severity">Severity first</option><option value="file">File and line</option><option value="confidence">Confidence first</option></select></label><button id="reset">Reset filters</button></div><p id="visible-count" role="status">${result.findings.length} of ${result.findings.length} findings. JavaScript enables filters and pagination.</p><noscript><p>All findings are available below. Expand a finding to read its evidence.</p></noscript><div id="finding-list">${findings.join('') || '<p>No findings were emitted by completed scanners. Review tool coverage and limitations before interpreting this result.</p>'}</div><div class="pagination controls"><button id="previous">Previous findings</button><span id="page-label"></span><button id="next">Next findings</button></div></section>` : ''}
<section id="scanners"><p class="folio">Execution coverage</p><h2 class="chapter-title">Scanner execution</h2><p>Completed means the tool ran on supported input. Failures and missing tools are visible and reduce coverage.</p><div class="scroll"><table class="scanner-table"><colgroup><col class="scanner-name"><col class="scanner-status"><col class="scanner-files"><col class="scanner-duration"><col></colgroup><thead><tr><th>Scanner and version</th><th>Status</th><th>Files</th><th>Duration</th><th>Details</th></tr></thead><tbody>${scannerRows.join('')}</tbody></table></div></section>
<section id="architecture"><p class="folio">Connected systems evidence</p><h2 class="chapter-title">Architecture and structural change</h2><div class="structural-summary">${renderIcon('network')}<div><h3>${result.erosion.basis === 'historical_comparison' ? 'Historical comparison' : 'Current structural risk'}: ${result.erosion.score ?? 'Not assessed'} / 100</h3><p>${escapeHtml(result.erosion.explanation)}</p></div></div><details class="method-disclosure"><summary>Structural measurements and comparable deltas</summary><div><pre>${escapeHtml(JSON.stringify({ measurements: result.erosion.measurements, deltas: result.erosion.deltas }, null, 2))}</pre></div></details>${config.reports.includeDependencyGraphs ? renderGraph(result) : ''}</section>
${renderPrinciples(result)}
<section id="limitations"><p class="folio">Scope and provenance</p><h2 class="chapter-title">Coverage and limitations</h2><ul>${limitations.join('')}</ul><p>Skipped symlinks: ${result.inventory.skippedSymlinks}; excluded files: ${result.inventory.excludedFiles}; binary files: ${result.inventory.binaryFiles}; unresolved or external import references: ${result.graph.unresolvedImports}.</p><h3>Artifact execution status</h3><ul>${reportRows.join('')}</ul></section></main>
<footer>antislopscan is open-source software, Apache-2.0. Author: Stephan Coertzen. Generated locally from canonical audit JSON.</footer><script>${script}</script></body></html>`;
};

/** Render escaped evidence as a native disclosure, or a fully expanded block for a bounded PDF section. */
const renderFinding = (finding: Finding, config: Config, expanded = false): string => {
	const references: string[] = [];
	const tag = expanded ? 'article' : 'details';
	const titleTag = expanded ? 'div' : 'summary';

	for (const reference of referencesFor(finding))
		references.push(
			`<li><a href="${escapeHtml(reference.url)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">${escapeHtml(reference.title)}</a></li>`
		);
	return `<${tag} class="finding" id="finding-${escapeHtml(finding.id)}" data-finding data-severity="${finding.severity}" data-category="${finding.category}" data-rule-id="${escapeHtml(finding.ruleId)}" data-file="${escapeHtml(finding.file)}" data-scanner="${escapeHtml(JSON.stringify([finding.scanner, ...finding.sources]))}" data-assessment="${finding.assessment}" data-method="${finding.method}" data-confidence="${finding.confidence}" data-line="${finding.line}"><${titleTag} class="finding-heading"><span class="finding-kicker"><span class="severity ${finding.severity}">${renderIcon(severityIcons[finding.severity])}${finding.severity}</span><code>${escapeHtml(finding.ruleId)}</code><span>${escapeHtml(finding.assessment.replaceAll('_', ' '))}</span></span><h3>${escapeHtml(finding.message)}</h3><code class="finding-path">${escapeHtml(finding.file)}:${finding.line}:${finding.column}</code></${titleTag}><div class="finding-body"><h4>Evidence</h4><p>${escapeHtml(finding.evidence)}</p>${finding.snippet ? `<pre>${escapeHtml(finding.snippet)}</pre>` : ''}${config.reports.includeRecommendations ? `<div class="finding-recommendation"><h4>Recommendation</h4><p>${escapeHtml(finding.recommendation)}</p></div>` : ''}<p class="finding-provenance">${escapeHtml(finding.method.replaceAll('_', ' '))} / ${Math.round(finding.confidence * 100)}% detector confidence / ${escapeHtml(finding.sources.join(', '))}</p><p class="caption fingerprint">Fingerprint: ${escapeHtml(finding.fingerprint)}</p><h4>Issue references</h4>${references.length ? `<ul class="references">${references.join('')}</ul>` : '<p class="caption">No curated online reference for this rule.</p>'}</div></${tag}>`;
};

/** Render one complete evidence slice without repeating or falsifying full-audit summary measurements. */
export const renderPdfAppendix = async (
	result: AuditResult,
	config: Config,
	findings: Finding[],
	offset: number
): Promise<string> => {
	const presentation = await loadPresentation(false);
	const { css } = presentation;
	const rows: string[] = [];

	for (const finding of findings) rows.push(renderFinding(finding, config, true));
	return `<!doctype html><html lang="en" data-accent="teal"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; connect-src 'none'"><title>antislopscan evidence appendix</title><style>${css}</style></head><body class="evidence-appendix">${renderAssetDefinitions(presentation)}<header class="appendix-masthead">${renderBrand()}<div><p class="folio">Complete finding evidence</p><h1>${escapeHtml(result.project.name)}</h1><p>Evidence appendix: findings ${offset + 1}-${offset + findings.length} of ${result.findings.length}.</p><p class="caption">Audit ${escapeHtml(result.id)}</p></div></header><main><section><h2>Finding evidence and recommendations</h2><p class="caption">References open external documentation only when followed. Confidence is a detector estimate; all findings require context.</p>${rows.join('')}</section></main></body></html>`;
};

/** Draw a bounded static import graph and retain a searchable, complete edge table as the accessible alternative. */
const renderGraph = (result: AuditResult): string => {
	const nodes = result.graph.nodes.slice(0, 40);
	const positions = new Map<string, { x: number; y: number }>();
	const elements: string[] = [];
	const legend: string[] = [];
	const edgeRows: string[] = [];
	const width = 960;
	const height = 660;

	for (const [index, node] of nodes.entries()) {
		const angle = (2 * Math.PI * index) / Math.max(1, nodes.length);

		positions.set(node.file, {
			x: width / 2 + 320 * Math.cos(angle),
			y: height / 2 + 260 * Math.sin(angle)
		});
	}
	for (const edge of result.graph.edges.slice(0, 500)) {
		const from = positions.get(edge.from);
		const to = positions.get(edge.to);

		if (from && to)
			elements.push(
				`<line class="graph-edge${edge.typeOnly ? ' type-edge' : ''}" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" marker-end="url(#arrow)"/>`
			);
	}
	for (const [index, node] of nodes.entries()) {
		const position = positions.get(node.file)!;

		elements.push(
			`<g><title>${escapeHtml(node.file)} / fan-in ${node.fanIn} / fan-out ${node.fanOut}</title><circle class="graph-node" cx="${position.x}" cy="${position.y}" r="7"/><text x="${position.x + 10}" y="${position.y - 10}">${index + 1}</text></g>`
		);
		legend.push(`<li>${escapePath(node.file)}</li>`);
	}
	for (const edge of result.graph.edges)
		edgeRows.push(
			`<tr><td>${escapePath(edge.from)}:${edge.line}</td><td>${escapePath(edge.to)}</td><td>${edge.typeOnly ? 'type' : 'runtime'}</td></tr>`
		);

	return `<h3>${renderIcon('network')}Static import relationships</h3><p>Diagram shows up to 40 modules and 500 edges. The table includes all ${result.graph.edges.length} resolved edges. Arrows point from importer to dependency. Numbers correspond to the file key below.</p>${nodes.length ? `<div class="graph-illustration"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Numbered static dependency graph; the file key and complete relationships follow"><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z"/></marker></defs><ellipse class="graph-orbit" cx="480" cy="330" rx="320" ry="260"/>${elements.join('')}</svg></div><ol class="graph-key">${legend.join('')}</ol>` : '<p>No JS/TS graph nodes were assessed.</p>'}<details class="method-disclosure"><summary>Complete resolved import table</summary><div class="scroll"><table class="dependency-table"><thead><tr><th>Importer</th><th>Dependency</th><th>Kind</th></tr></thead><tbody>${edgeRows.join('')}</tbody></table></div></details>`;
};
