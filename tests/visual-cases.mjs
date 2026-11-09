/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
export const themes = ['light', 'dark'];
export const accents = ['neutral', 'blue', 'violet', 'teal', 'orange', 'rose', 'green'];
export const widths = [1440, 900, 768, 540, 390, 320];

const dashboard = {
	'connection': ['Connection and authentication', 'Unauthenticated alert, brand, fresh-install accent and bearer connection control.'],
	'empty': ['Empty history and assessment', 'Successful connection opens the initial assessment workflow.'],
	'validation': ['Invalid JSON validation', 'Malformed configuration displays a visible alert.'],
	'assessment': ['Configured assessment', 'Project name, scanner settings and all four report formats are submitted.'],
	'findings': ['Completed audit and finding pagination', 'Actual audit findings appear; the first page contains 50 findings.'],
	'next': ['Next finding page', 'Next page contains actual findings.'],
	'previous': ['Previous finding page', 'Previous restores the first page.'],
	'no-findings': ['Empty finding search', 'A search with no matches renders the no-findings message.'],
	'severity-category': ['Severity and category filters', 'Major/code-quality filtering retains the empty-catch evidence.'],
	'advanced': ['Advanced evidence filters', 'File, rule, method, scanner, assessment, confidence and sorting leave one finding.'],
	'copy': ['Expanded evidence and clipboard', 'Recommendation appears; copied evidence contains the selected rule.'],
	'clipboard-fallback': ['Clipboard denial fallback', 'Copy denial displays instructions and selectable evidence.'],
	'filtered-export': ['Filtered JSON export', 'Downloaded JSON contains exactly the one selected finding; issue links are isolated.'],
	'severity-drill': ['Severity chart drill-down', 'Selecting major in the dashboard applies the major evidence filter.'],
	'rule-drill': ['Rule ranking drill-down', 'Selecting a ranked rule applies its finding filter.'],
	'methodology': ['Scoring methodology', 'The actual methodology disclosure is expanded.'],
	'measurements': ['Structural measurements', 'The measurement and delta disclosure is expanded.'],
	'architecture': ['Dependency relationships', 'The graph has three actual nodes and one resolved relationship.'],
	'principle': ['Static systems principle', 'Holism expands to an informational static assessment.'],
	'module': ['Module-to-finding navigation', 'Selecting helper.ts applies that exact file filter.'],
	'no-modules': ['Empty module search', 'An unmatched path renders the no-modules message.'],
	'runtime-imports': ['Runtime import filtering', 'Matching api.ts leaves two nodes; runtime-only mode retains one edge.'],
	'no-principles': ['Principle assessment filtering', 'Holism combined with unassessed displays a no-match state.'],
	'new-assessment': ['New assessment and focus', 'Opening the form focuses Project name.'],
	'history-mobile': ['Mobile audit history', 'History selection restores repository heading focus at 390px.'],
	'motion-pause': ['User motion pause', 'The rendered hero enters its paused state.'],
	'hidden-pause': ['Hidden-document motion lifecycle', 'A simulated visibility change pauses flow animation; screenshot remains a static view.'],
	'motion-resume': ['Visible-document motion lifecycle', 'Visibility restoration resumes the measured animation play state.'],
	'reduced-motion': ['System reduced motion', 'Computed animation name becomes none.'],
	'escape': ['Appearance keyboard dismissal', 'Escape closes appearance settings.'],
	'persist': ['Keyboard accent and persisted preference', 'ArrowDown selects blue; reload retains dark/blue settings.'],
	'system-light': ['System light appearance', 'System mode clears the explicit theme and follows the light OS palette.'],
	'system-dark': ['System dark appearance', 'The OS dark palette differs and retains the selected blue accent.'],
	'invalid-accent': ['Invalid saved preference', 'Malformed saved accent safely falls back to neutral.'],
	'keyboard': ['Connection keyboard navigation', 'Tab moves from the masked token field to the connection button.'],
	'report-cover': ['Standalone report identity', 'Embedded cover artwork decodes, four principle illustrations exist and no HTTP assets load.'],
	'report-persist': ['Standalone saved appearance', 'The report retains violet through reload and applies dark mode.'],
	'report-next': ['Standalone report pagination', 'The report shows 50 findings and supports next-page navigation.'],
	'report-filters': ['Standalone advanced filters', 'Scanner, method, assessment and file sort retain matching evidence.'],
	'report-drill': ['Standalone file drill-down', 'Selecting api.ts reduces results and exposes safe references.'],
	'report-empty': ['Standalone no-match search', 'Unmatched evidence search produces zero visible findings.'],
	'report-invalid': ['Standalone invalid saved accent', 'Malformed preference falls back to neutral.'],
	'report-print': ['Standalone print palette', 'Print uses a white surface even when the OS appearance is dark.'],
	'coverage': ['Scanner execution coverage', 'The coverage screen displays the actual completed scanner results.']
};
const model = {
	'settings': ['Operator-pinned LLM settings', 'Enabled assessment is checked, provider is disabled, endpoint is read-only; model and byte budget remain editable.'],
	'configured': ['Configured model sample', 'The form uses fixture-model-v2 and a 2048-byte sampling budget.'],
	'overview': ['Independent sampled LLM score', 'Four local provider calls produce 90/100; 14 principle rows are displayed.'],
	'illustration': ['Principle explanation and GIF', 'Expanded DRY loads the conceptual GIF; a static screenshot does not prove motion.'],
	'paused': ['Paused principle illustration', 'Explicit pause replaces the GIF with its static poster.'],
	'reduced': ['Reduced-motion principle illustration', 'Operating-system reduced motion selects the static poster.'],
	'next': ['Next principle page', 'Next page contains 14 actual principle rows.'],
	'previous': ['Previous principle page', 'Previous restores the first principle page.'],
	'search': ['Principle name search', 'DRY search leaves one row.'],
	'empty': ['Principle assessment no-match', 'Combining DRY and unassessed renders the no-match message.'],
	'citation': ['LLM citation drill-down', 'Selecting a citation applies the exact a.ts file filter.'],
	'export': ['Model review exports', 'JSON preserves score 90, model, one sampled file and static score 100; HTML includes the LLM sample section.']
};

/** Describe every required visual checkpoint, including each tested appearance/viewport combination. @param {string} scenario @returns {Record<string, {title: string, checks: string, kind: string}>} */
export const visualCases = (scenario) => {
	const result = {};
	const entries = scenario === 'ui-dashboard' ? dashboard : scenario === 'ui-model' ? model : null;

	if (!entries) throw new Error(`Unknown visual scenario: ${scenario}`);
	for (const [id, [title, checks]] of Object.entries(entries)) result[id] = { title, checks, kind: 'feature' };
	for (const theme of themes) {
		for (const width of widths) {
			result[`layout-${theme}-${width}`] = { title: `${theme} appearance at ${width}px`, checks: 'Actual document geometry has no horizontal overflow.', kind: 'layout' };
			if (scenario === 'ui-dashboard') result[`report-layout-${theme}-${width}`] = { title: `Standalone ${theme} report at ${width}px`, checks: 'The exported report has no horizontal overflow.', kind: 'layout' };
		}
		if (scenario !== 'ui-dashboard') continue;
		for (const accent of accents) {
			result[`report-accent-${theme}-${accent}`] = { title: `Standalone ${theme}/${accent} palette`, checks: 'Measured text/action contrast is at least 4.5:1; control/focus contrast is at least 3:1.', kind: 'layout' };
			for (const width of widths) result[`accent-${theme}-${accent}-${width}`] = { title: `${theme}/${accent} at ${width}px`, checks: 'Computed palette contrast and document overflow assertions passed for this exact combination.', kind: 'layout' };
		}
	}
	if (scenario === 'ui-dashboard') for (const format of ['HTML', 'PDF', 'JSON', 'SARIF']) result[`export-${format}`] = { title: `${format} report download`, checks: 'Playwright observed this format download without failure.', kind: 'feature' };
	return result;
};
