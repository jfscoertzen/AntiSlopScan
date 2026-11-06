/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
const fields = ['severity', 'category', 'ruleId', 'file', 'scanner', 'assessment', 'method'];
const controls = new Map();
const search = document.querySelector('#search');
const confidence = document.querySelector('#confidence');
const sort = document.querySelector('#sort');
const list = document.querySelector('#finding-list');
const rows = [...document.querySelectorAll('[data-finding]')];
const severityOrder = ['critical', 'major', 'minor', 'info'];
const pageSize = 50;
const theme = document.querySelector('#theme');
const accent = document.querySelector('#report-accent');
document.documentElement.classList.add('has-js');
let page = 1;
let matches = [];
let printState = [];

for (const field of fields) controls.set(field, document.getElementById(field));
const entries = rows.map(/** Cache plain text once; never parse repository evidence as markup. @param {HTMLElement} row @returns {object} */ (row) => ({ row, search: row.textContent.toLowerCase(), scanners: JSON.parse(row.dataset.scanner), data: row.dataset }));

/** Show one page while keeping all evidence available for printing or without JavaScript. @returns {void} */
const showPage = () => {
	const pages = Math.max(1, Math.ceil(matches.length / pageSize));

	page = Math.min(page, pages);
	for (const row of rows) row.hidden = true;
	for (const entry of matches.slice((page - 1) * pageSize, page * pageSize)) {
		entry.row.hidden = false;
		list.append(entry.row);
	}
	document.querySelector('#visible-count').textContent = `${matches.length.toLocaleString()} of ${rows.length.toLocaleString()} findings. ${matches.length ? 'Expand a finding for evidence and references.' : 'No findings match these filters.'}`;
	document.querySelector('#page-label').textContent = `Page ${page} of ${pages}`;
	document.querySelector('#previous').disabled = page <= 1;
	document.querySelector('#next').disabled = page >= pages;
};


/** Compose exact filters, text search, confidence threshold, and deterministic sorting. @returns {void} */
const filter = () => {
	const query = search.value.trim().toLowerCase();

	matches = entries.filter(/** Evaluate only escaped data attributes and cached plain text. @param {object} entry @returns {boolean} */ (entry) => {
		for (const [field, control] of controls) {
			if (!control.value) continue;
			if (field === 'scanner' ? !entry.scanners.includes(control.value) : entry.data[field] !== control.value) return false;
		}
		return Number(entry.data.confidence) * 100 >= Number(confidence.value) && entry.search.includes(query);
	});
	matches.sort(/** Sort without changing canonical identities or evidence. @param {object} left @param {object} right @returns {number} */ (left, right) => {
		const primary = sort.value === 'file' ? left.data.file.localeCompare(right.data.file)
			: sort.value === 'confidence' ? Number(right.data.confidence) - Number(left.data.confidence)
				: severityOrder.indexOf(left.data.severity) - severityOrder.indexOf(right.data.severity);

		return primary || left.data.file.localeCompare(right.data.file) || Number(left.data.line) - Number(right.data.line);
	});
	page = 1;
	showPage();
};


/** Clear hidden constraints before dashboard navigation or manual reset. @returns {void} */
const reset = () => {
	for (const control of controls.values()) control.value = '';
	search.value = '';
	confidence.value = '0';
	sort.value = 'severity';
	filter();
};


/** Apply and remember a palette where browser storage permits it; system mode follows OS CSS. @returns {void} */
const applyTheme = () => {
	if (theme.value === 'system') delete document.documentElement.dataset.theme;
	else document.documentElement.dataset.theme = theme.value;
	try { localStorage.setItem('antislopscan-theme', theme.value); }
	catch { document.querySelector('#theme-note').textContent = 'Theme applies to this page; preference could not be saved.'; }
};

try {
	const saved = localStorage.getItem('antislopscan-theme');

	if (saved === 'light' || saved === 'dark') theme.value = saved;
} catch { theme.value = 'system'; }
applyTheme();
theme.addEventListener('change', applyTheme);

/** Apply a palette identifier validated by the generated native options, preserving the application's saved preference. @returns {void} */
const applyAccent = () => {
	document.documentElement.dataset.accent = accent.value;
	try { localStorage.setItem('antislopscan-accent', accent.value); }
	catch { document.querySelector('#accent-note').textContent = 'Accent applies to this page; preference could not be saved.'; }
};

try {
	const saved = localStorage.getItem('antislopscan-accent');

	if (saved !== null) {
		accent.value = saved;
		if (!accent.value) accent.value = 'neutral';
	}
} catch { accent.value = 'teal'; }
applyAccent();
accent.addEventListener('change', applyAccent);
search.addEventListener('input', filter);
confidence.addEventListener('input', filter);
sort.addEventListener('change', filter);
for (const control of controls.values()) control.addEventListener('change', filter);
document.querySelector('#reset').addEventListener('click', reset);
document.querySelector('#previous').addEventListener('click', /** Navigate to the preceding matching page. @returns {void} */ () => { page -= 1; showPage(); });
document.querySelector('#next').addEventListener('click', /** Navigate to the next matching page. @returns {void} */ () => { page += 1; showPage(); });
for (const button of document.querySelectorAll('[data-drill]')) {
	button.disabled = false;
	button.addEventListener('click', /** Drill into one exact dashboard group and move keyboard focus to its results. @returns {void} */ () => {
		reset();
		controls.get(button.dataset.drill).value = button.dataset.value;
		filter();
		document.querySelector('#findings').focus();
	});
}
filter();

window.addEventListener('beforeprint', /** Expand all native disclosures so manual printing retains complete evidence. @returns {void} */ () => {
	printState = [...document.querySelectorAll('details')].map(/** Remember the current review state before printing. @param {HTMLDetailsElement} detail @returns {object} */ (detail) => ({ detail, open: detail.open }));
	for (const state of printState) state.detail.open = true;
});
window.addEventListener('afterprint', /** Restore interactive disclosure state after manual printing. @returns {void} */ () => {
	for (const state of printState) state.detail.open = state.open;
	printState = [];
});
