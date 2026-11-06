/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { applicationRoot } from '../security/process.js';
import { iconPaths, type IconName } from '../presentation/icons.js';
import { accentOptions } from '../presentation/appearance.js';
import type { IllustrationFamily } from '../presentation/principles.js';
import type { AuditResult, Config } from '../domain.js';

export interface ReportPresentation {
	css: string;
	mark: string;
	network: string;
	posters: Partial<Record<IllustrationFamily, string>>;
}

export const conceptLabels: Record<IllustrationFamily, string> = {
	consolidation: 'Shared authority',
	boundaries: 'Explicit boundaries',
	contracts: 'Stable contracts',
	flows: 'Bounded flows'
};

/** Escape all repository/model text and attribute values before inserting report markup. */
export const escapeHtml = (input: unknown): string =>
	String(input ?? '')
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');

/** Offer natural path-segment wrapping without altering copied text, source locations or filter values. */
export const escapePath = (input: string): string => escapeHtml(input).replaceAll('/', '/<wbr>');

/** Read fixed installation assets; evidence appendices omit cover/guide images to keep repeated sections small. */
export const loadPresentation = async (includeArtwork = true): Promise<ReportPresentation> => {
	const [theme, layout, mark] = await Promise.all([
		readFile(join(applicationRoot, 'assets/theme.css'), 'utf8'),
		readFile(join(applicationRoot, 'assets/report.css'), 'utf8'),
		readFile(join(applicationRoot, 'assets/branding/antislopscan-mark.png'))
	]);
	const posters: ReportPresentation['posters'] = {};
	let network = '';

	if (includeArtwork) {
		network = (
			await readFile(join(applicationRoot, 'assets/branding/intelligence/topology-background.png'))
		).toString('base64');
		for (const family of Object.keys(conceptLabels) as IllustrationFamily[])
			posters[family] = (
				await readFile(join(applicationRoot, `assets/branding/principles/${family}-poster.png`))
			).toString('base64');
	}
	return { css: `${theme}\n${layout}`, mark: mark.toString('base64'), network, posters };
};

/** Embed each original icon/poster once; repeated report rows reference local SVG symbols without network access. */
export const renderAssetDefinitions = (presentation: ReportPresentation): string => {
	const symbols: string[] = [];

	for (const [name, paths] of Object.entries(iconPaths)) {
		const elements: string[] = [];

		for (const path of paths) elements.push(`<path d="${path}"/>`);
		symbols.push(
			`<symbol id="report-icon-${name}" viewBox="0 0 24 24">${elements.join('')}</symbol>`
		);
	}
	for (const [family, poster] of Object.entries(presentation.posters))
		symbols.push(
			`<symbol id="concept-${family}" viewBox="0 0 256 256"><image href="data:image/png;base64,${poster}" width="256" height="256"/></symbol>`
		);
	return `<svg class="asset-definitions" xmlns="http://www.w3.org/2000/svg" width="0" height="0" aria-hidden="true"><defs><symbol id="report-brand" viewBox="0 0 1024 1024"><image href="data:image/png;base64,${presentation.mark}" width="1024" height="1024"/></symbol>${symbols.join('')}</defs></svg>`;
};

/** Reuse the application's original SVG icon set; adjacent text supplies the accessible name. */
export const renderIcon = (name: IconName): string =>
	`<svg class="report-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#report-icon-${name}"/></svg>`;

/** Show a static conceptual illustration with dimensions; measured architecture is presented separately. */
export const renderConcept = (family: IllustrationFamily): string =>
	`<svg class="concept-art" width="96" height="96" viewBox="0 0 256 256" aria-hidden="true"><use href="#concept-${family}"/></svg>`;

/** Draw an exact-value quality gauge; missing assessments never appear as zero or as a passing score. */
export const renderGauge = (score: number | null, label: string): string => {
	const circumference = 2 * Math.PI * 54;
	const arc = score === null ? 0 : (circumference * Math.min(100, Math.max(0, score))) / 100;
	const description =
		score === null ? `${label}: not assessed` : `${label}: ${score} out of 100, higher is better`;

	return `<svg class="score-gauge" viewBox="0 0 128 128" width="128" height="128" role="img" aria-label="${escapeHtml(description)}"><circle class="gauge-track" cx="64" cy="64" r="54"/><circle class="gauge-arc" cx="64" cy="64" r="54" stroke-dasharray="${arc} ${circumference}" transform="rotate(-90 64 64)"/><text class="gauge-value" x="64" y="69" text-anchor="middle">${score ?? 'N/A'}</text><text class="gauge-unit" x="64" y="89" text-anchor="middle">/ 100</text></svg>`;
};

/** Format a traceable UTC publication timestamp; unexpected historical values remain visible as escaped text. */
const publicationTime = (value: string): string =>
	Number.isNaN(Date.parse(value))
		? value
		: `${new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }).format(new Date(value))} UTC`;

/** Render compact branding shared by the cover and repeated evidence-section mastheads. */
export const renderBrand = (): string =>
	`<div class="brand"><svg class="brand-mark" width="48" height="48" role="img" aria-label="AntiSlopScan mark"><use href="#report-brand"/></svg><div><p class="product">antislopscan</p><p class="folio">Software intelligence</p></div></div>`;

/** Render a score-led publication cover from canonical data, retaining report-summary configuration and honest CI status. */
export const renderCover = (
	result: AuditResult,
	config: Config,
	presentation: ReportPresentation
): string => {
	const options: string[] = [];
	let critical = 0;

	for (const option of accentOptions)
		options.push(
			`<option value="${option.id}"${option.id === 'teal' ? ' selected' : ''}>${option.label}</option>`
		);
	for (const finding of result.findings) if (finding.severity === 'critical') critical += 1;
	return `<header class="report-cover"><div class="masthead">${renderBrand()}<div class="report-preferences" role="group" aria-label="Report appearance"><label class="theme-control" for="theme">Appearance<select id="theme"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select><small id="theme-note" role="status"></small></label><label class="theme-control" for="report-accent">Accent color<select id="report-accent">${options.join('')}</select><small id="accent-note" role="status"></small></label></div><p class="edition">Repository audit<br>Version ${escapeHtml(result.applianceVersion)}</p></div><div class="cover-title"><p class="folio">Code quality / Architecture / Systems thinking</p><h1${result.project.name.length > 80 ? ' class="long-title"' : ''}>${escapeHtml(result.project.name)}</h1><p class="repository-path">${renderIcon('folder')}<code>${escapeHtml(result.project.source)}</code></p><p class="publication-time">${renderIcon('clock')}Completed ${escapeHtml(publicationTime(result.completedAt))}</p></div>${config.reports.includeExecutiveSummary ? `<div class="outcome-band"><img class="cover-topology" src="data:image/png;base64,${presentation.network}" width="1536" height="1024" alt=""><div class="quality-reading">${renderGauge(result.scores.overall, 'Overall quality')}<div><p class="folio">Deterministic quality</p><h2>Overall quality</h2><p>Higher is better. Read alongside coverage and evidence.</p></div></div><div class="gate-reading"><p class="folio">Configured quality gate</p><strong class="${result.ci.passed ? 'gate-pass' : 'gate-fail'}">${renderIcon(result.ci.passed ? 'circleCheck' : 'circleX')}${result.ci.passed ? 'Passed' : 'Failed'}</strong><p>${escapeHtml(result.ci.reasons[0] ?? 'All configured gate conditions were met.')}</p>${result.ci.reasons.length > 1 ? `<small>${result.ci.reasons.length - 1} additional gate reasons are recorded in the decision below.</small>` : ''}</div></div><p class="artwork-caption">Conceptual software relationships / AntiSlopScan identity. Measured dependencies are presented separately when available.</p><div class="cover-metrics"><div>${renderIcon('scan')}<strong>${result.findings.length.toLocaleString('en')}</strong><span>Findings and observations</span></div><div>${renderIcon('alert')}<strong>${critical.toLocaleString('en')}</strong><span>Critical findings</span></div><div>${renderIcon('activity')}<strong>${result.scores.coverage}%</strong><span>Tool execution coverage</span></div><div>${renderIcon('file')}<strong>${result.inventory.files.length.toLocaleString('en')}</strong><span>Source files</span></div></div>` : ''}<div class="cover-context"><p><strong>Inventory</strong> ${result.inventory.totalLines.toLocaleString('en')} physical source lines / ${escapeHtml(result.inventory.languages.join(', ') || 'no recognized languages')}</p><p>Evidence-backed static analysis with explicit confidence and coverage limits. A quality score is not a security certification.${result.aiArchitecture ? ' LLM assessments are separately labeled and require human review.' : ''}</p></div><nav aria-label="Report sections"><a href="#dashboard">Overview</a><a href="#findings">Findings</a><a href="#scanners">Scanner coverage</a><a href="#architecture">Architecture</a><a href="#principles">Principles</a></nav><div class="cover-trace"><p><span>Audit identifier</span><code>${escapeHtml(result.id)}</code></p><p><span>Analysis policy fingerprint</span><code>${escapeHtml(result.configurationHash)}</code></p><p class="caption">Generated locally. Complete evidence and methodology follow. Open-source software / Apache-2.0.</p></div></header>`;
};
