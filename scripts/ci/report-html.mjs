/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */

/** Escape evidence text and attribute values. @param {unknown} value @returns {string} */
export const escapeHtml = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

/** Render a labeled semantic status without trusting a CSS class from artifacts. @param {string} value @returns {string} */
const status = (value) => `<span class="status ${['passed','failed','skipped','pending','not_run','running'].includes(value) ? value : ''}">${escapeHtml(value?.replaceAll('_',' ') ?? 'not available')}</span>`;

/** Render a dense evidence table with fixed headings and already escaped cells. @param {string[]} headings @param {string[][]} rows @returns {string} */
const table = (headings, rows) => {
	let html = '<table><thead><tr>';

	for (const heading of headings) html += `<th scope="col">${escapeHtml(heading)}</th>`;
	html += '</tr></thead><tbody>';
	for (const row of rows) {
		html += '<tr>';
		for (const cell of row) html += `<td>${cell}</td>`;
		html += '</tr>';
	}
	return html + '</tbody></table>';
};

/** Render genuine scanner states and their observed findings, never treating unavailable as clean. @param {object | undefined} result @returns {string} */
const scanners = (result) => {
	if (!result) return '<p class="muted">This gate did not produce a current completed scanner report.</p>';
	const rows = [];

	for (const scanner of result.scanners ?? []) rows.push([escapeHtml(`${scanner.name} ${scanner.version}`), status(scanner.status), escapeHtml(`${scanner.durationMs ?? 0} ms`), escapeHtml(scanner.message ?? '')]);
	let html = table(['Scanner / version', 'Execution', 'Duration', 'Context'], rows);

	html += `<p>${escapeHtml(result.findings?.length ?? 0)} normalized findings/observations. Overall quality: ${escapeHtml(result.scores?.overall ?? 'not assessed')}; execution coverage: ${escapeHtml(result.scores?.coverage ?? 'not assessed')}%.</p>`;
	const counts = {};
	for (const finding of result.findings ?? []) counts[`${finding.category} / ${finding.severity}`] = (counts[`${finding.category} / ${finding.severity}`] ?? 0) + 1;
	const findingRows = [];
	for (const [name, count] of Object.entries(counts)) findingRows.push([escapeHtml(name), String(count)]);
	if (findingRows.length) html += table(['Category / severity', 'Count'], findingRows);
	return html;
};


/** Present actual Snyk completion, severity counts and remediation/location evidence without deriving an invented repository score. @param {object | undefined} report @returns {string} */
const snykReport = (report) => {
	if (!report) return '<p class="muted">Snyk did not produce current-run evidence. An unexecuted or unavailable scan is not a clean result.</p>';
	let html = `<p>Pinned CLI: ${escapeHtml(report.expectedVersion)}. Executed version: ${escapeHtml(report.version ?? 'not available')}. Release threshold: ${escapeHtml(report.severityThreshold)}. Gate: ${status(report.passed ? 'passed' : 'failed')}.</p><p>Dependency scanning includes production and development packages. Counts below describe reported advisories/issues; no numeric repository score is invented. All reported severities remain visible.</p>`;
	const rows = [];

	for (const [kind, scan] of Object.entries(report.scans ?? {})) rows.push([escapeHtml(kind === 'code' ? 'Source code (SAST)' : 'npm dependencies'), status(scan.status), status(scan.passed ? 'passed' : 'failed'), ...['critical', 'high', 'medium', 'low'].map(/** Show unavailable measurements explicitly instead of zeros. @param {string} severity @returns {string} */ (severity) => escapeHtml(scan.counts?.[severity] ?? 'not assessed')), escapeHtml(`${((scan.durationMs ?? 0) / 1000).toFixed(2)} s`)]);
	html += table(['Scan', 'Execution', 'Gate', 'Critical', 'High', 'Medium', 'Low', 'Duration'], rows);
	for (const [kind, scan] of Object.entries(report.scans ?? {})) {
		html += `<h3>${kind === 'code' ? 'Source code findings' : 'Dependency advisories'}</h3>`;
		if (scan.error) html += `<p class="failure">${escapeHtml(scan.error)}</p>`;
		if (scan.status === 'completed' && !scan.issues?.length) html += '<p>No findings were reported by this completed scan.</p>';
		if (scan.dependencyCount !== null && scan.dependencyCount !== undefined) html += `<p>${escapeHtml(scan.dependencyCount)} dependencies assessed; ${escapeHtml(scan.issues?.length ?? 0)} unique advisory/package/version combinations. Code findings are counted per reported location.</p>`;
		for (const issue of scan.issues ?? []) {
			html += `<details class="case"><summary>${escapeHtml(issue.severity)} · ${escapeHtml(issue.title)}</summary><p>${escapeHtml(issue.id)} · ${escapeHtml(issue.package ?? issue.location)}</p>`;
			if (kind === 'code') html += `<p>${escapeHtml(issue.description)}</p>`;
			else html += `<p>Fixed versions: ${escapeHtml(issue.fixedIn?.length ? issue.fixedIn.join(', ') : 'No upstream fixed version reported')}.</p>`;
			for (const path of issue.paths ?? []) html += `<pre>${escapeHtml(path)}</pre>`;
			if (issue.trace?.length) html += `<p>Reported data-flow locations:</p><pre>${escapeHtml(issue.trace.join('\n'))}</pre>`;
			if (/^SNYK-[A-Z0-9-]+$/.test(issue.id)) html += `<p><a href="https://security.snyk.io/vuln/${encodeURIComponent(issue.id)}">Snyk advisory and remediation details</a></p>`;
			html += '</details>';
		}
		if (scan.artifact) html += `<p class="case-meta">Full scanner evidence: ${escapeHtml(scan.artifact)} in the CI artifact download.</p>`;
	}
	return html;
};

/** Render a portable branded CI document from actual outcomes and source-defined checks. @param {object} model @param {{css: string, mark: string, network: string}} assets @returns {string} */
export const renderCiHtml = (model, assets) => {
	const { journal } = model;
	const totals = { passed: 0, failed: 0, notRun: 0 };
	for (const item of model.cases) {
		if (item.status === 'passed') totals.passed++;
		else if (item.status === 'failed') totals.failed++;
		else totals.notRun++;
	}
	const stepRows = [];
	for (const step of journal.steps) stepRows.push([escapeHtml(step.name), status(step.status), `${(step.durationMs / 1000).toFixed(2)} s`, escapeHtml([step.description, step.error].filter(Boolean).join(' '))]);
	let html = `<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>AntiSlopScan CI verification</title><style>${assets.css}</style></head><body><main><header class="cover"><img class="topology" src="data:image/png;base64,${assets.network}" alt="" width="1536" height="1024"><div class="cover-content"><div class="brand"><img src="data:image/png;base64,${assets.mark}" width="48" height="48" alt="AntiSlopScan mark">antislopscan</div><div class="kicker">Software intelligence / CI verification</div><h1>Evidence for this build.</h1>${status(model.passed ? 'passed' : 'failed')}<p>Version ${escapeHtml(model.version)} · ${escapeHtml(journal.mode)} · ${escapeHtml(journal.completedAt ?? journal.startedAt)}</p><p>Run ${escapeHtml(journal.runId)}</p><p>${escapeHtml(journal.context?.repository ?? 'Local working tree')} · ${escapeHtml(journal.context?.reference ?? 'local')}<br>${escapeHtml(journal.context?.commit ?? 'Source revision not recorded')}</p><div class="metrics"><div class="metric"><strong>${totals.passed}</strong><span>tests passed</span></div><div class="metric"><strong>${totals.failed}</strong><span>tests failed</span></div><div class="metric"><strong>${totals.notRun}</strong><span>tests not run / skipped</span></div><div class="metric"><strong>${model.visuals.length}</strong><span>verified screenshots</span></div></div></div></header><nav aria-label="Report chapters"><a href="#pipeline">Pipeline</a><a href="#tests">Test cases</a><a href="#coverage">Coverage</a><a href="#security">Security</a><a href="#self">Self-audit</a><a href="#visuals">Visual evidence</a><a href="#diagnostics">Diagnostics</a></nav>`;
	html += `<section id="pipeline" class="chapter"><h2>Pipeline execution</h2><p>Only executed gates receive a pass. Failed and skipped gates remain visible. Durations are measured wall-clock time.</p>${table(['Gate', 'Outcome', 'Duration', 'Checks / failure context'], stepRows)}<p><strong>Release publication:</strong> ${escapeHtml(journal.publication)}</p>`;
	if (model.executable) html += `<p>Portable executable: ${status(model.executable.passed ? 'passed' : 'failed')} · version ${escapeHtml(model.executable.version)} · ${escapeHtml(model.executable.coverage)}% scanner execution coverage. Archive checksums are retained in release/SHA256SUMS.</p>`;
	if (model.issues.length) {
		html += '<div class="notice"><strong>Evidence validation issues</strong><ul>';
		for (const issue of model.issues) html += `<li>${escapeHtml(issue)}</li>`;
		html += '</ul></div>';
	}
	html += '</section><section id="tests" class="chapter major"><h2>Every test case</h2><p>Contracts and assertion expressions below come from this checkout. Runtime status comes from Jest. A failed test may stop before later assertions; these definitions do not imply that unexecuted checks passed.</p>';
	let project = '';
	for (const item of model.cases) {
		if (project !== item.project) { project = item.project; html += `<h3>${escapeHtml(project)}</h3>`; }
		html += `<details class="case"><summary>${status(item.status)} ${escapeHtml(item.title)}</summary><p class="case-meta">${escapeHtml(item.file ?? 'unmapped')} · ${item.durationMs === null ? 'not measured' : `${escapeHtml(item.durationMs)} ms`} · ${escapeHtml(item.id)}</p><p>${escapeHtml(item.purpose)}</p>`;
		if (item.evidenceSource && item.evidenceSource !== item.file) html += `<p class="case-meta">Executed assertion scenario: ${escapeHtml(item.evidenceSource)}</p>`;
		for (const check of item.checks) html += `<pre>${escapeHtml(check)}</pre>`;
		for (const failure of item.failures) html += `<pre class="failure">${escapeHtml(failure)}</pre>`;
		html += '</details>';
	}
	html += '</section><section id="coverage" class="chapter major"><h2>Critical-module coverage</h2><p>The denominator covers the five documented core modules, not the whole application or browser execution. Functional scenarios separately exercise workers and the UI.</p>';
	const coverageRows = [];
	for (const [file, entry] of Object.entries(model.coverage ?? {})) {
		const name = file === 'total' ? 'Measured total' : file.replace(/^.*\/(src\/)/, '$1');

		coverageRows.push([escapeHtml(name), `${escapeHtml(entry.lines?.pct)}%`, `${escapeHtml(entry.statements?.pct)}%`, `${escapeHtml(entry.functions?.pct)}%`, `${escapeHtml(entry.branches?.pct)}%`]);
	}
	html += coverageRows.length ? table(['Module', 'Lines', 'Statements', 'Functions', 'Branches'], coverageRows) : '<p>Coverage was not produced by a completed backend gate.</p>';
	html += '</section><section id="security" class="chapter major"><h2>Security and static analysis</h2>' + scanners(model.sast);
	if (model.security) html += `<p>Full-history and working-tree Gitleaks scans completed. No detected secrets were permitted by the gate. Dependency auditing explicitly includes development packages under NODE_ENV=production.</p>`;
	const advisoryRows = [];
	for (const [severity, count] of Object.entries(model.security?.advisoryCounts ?? model.dependencies?.metadata?.vulnerabilities ?? {})) advisoryRows.push([escapeHtml(severity), escapeHtml(count)]);
	if (advisoryRows.length) html += table(['Advisory severity', 'Count'], advisoryRows);
	const dependencies = [];
	for (const [name, item] of Object.entries(model.dependencies?.vulnerabilities ?? {})) dependencies.push([escapeHtml(name), escapeHtml(item.severity), escapeHtml(item.range), escapeHtml(item.fixAvailable ? JSON.stringify(item.fixAvailable) : 'No automatic fix reported')]);
	if (dependencies.length) html += table(['Dependency', 'Severity', 'Affected range', 'Registry fix information'], dependencies);
	html += '<p class="muted">These are tool observations and configured thresholds, not proof of zero vulnerabilities. Lower-severity advisories remain visible.</p><h3>Snyk dependency and source security</h3>' + snykReport(model.snyk) + '</section><section id="self" class="chapter major"><h2>AntiSlopScan self-audit</h2>' + scanners(model.audit) + '</section>';
	html += '<section id="visuals" class="chapter major"><h2>Frontend visual evidence</h2><p>Each image was captured after its checkpoint assertions. Secret input fields are masked. Images show fixture UI states; clipboard, download bytes, network isolation and animation properties are verified by assertions rather than pixels alone. Static captures do not demonstrate motion.</p>';
	for (const scenario of ['ui-dashboard', 'ui-model']) {
		html += `<h3>${scenario === 'ui-dashboard' ? 'Assessment and investigation' : 'Model review and architecture principles'}</h3>`;
		for (const kind of ['feature', 'layout']) {
			html += kind === 'layout' ? '<h3>Appearance and responsive matrix</h3><div class="gallery layouts">' : '<div class="gallery">';
			for (const capture of model.visuals) {
				if (capture.scenario !== scenario || capture.kind !== kind) continue;
				html += `<figure class="${kind}"><img src="data:image/png;base64,${capture.image}" alt="${escapeHtml(capture.title)}" width="${escapeHtml(capture.pixelWidth ?? 1440)}" height="${escapeHtml(capture.pixelHeight ?? 1000)}"><figcaption><strong>${escapeHtml(capture.title)}</strong>${escapeHtml(capture.checks)}<div class="source">${escapeHtml(capture.scenario)}/${escapeHtml(capture.file)} · ${escapeHtml(capture.viewport?.width)} × ${escapeHtml(capture.viewport?.height)} CSS px</div></figcaption></figure>`;
			}
			html += '</div>';
		}
	}
	html += '</section><section id="diagnostics" class="chapter major"><h2>Diagnostic evidence</h2><p>Bounded log tails are sanitized and escaped. Full logs, JSON/SARIF and screenshot manifests remain in the artifact download. Some tests deliberately trigger failures in controlled fixtures; their log messages are not failed Jest cases.</p>';
	for (const log of model.logs) html += `<details><summary>${escapeHtml(log.name)}</summary><pre>${escapeHtml(log.text)}</pre></details>`;
	return html + '</section><footer>AntiSlopScan · Apache-2.0 · Generated from actual CI evidence. Screenshots contain disposable fixtures, not an operator repository.</footer></main></body></html>';
};
