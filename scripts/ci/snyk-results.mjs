/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */

/** Require actual nonempty scanner text without trusting HTML, paths or URLs. @param {unknown} value @returns {string} */
const text = (value) => {
	if (typeof value !== 'string' || !value.trim()) throw new Error('Invalid Snyk finding text');
	return value;
};


/** Normalize dependency advisories while retaining every reported dependency path. @param {object} body @returns {object[]} */
const dependencies = (body) => {
	if (!Array.isArray(body.vulnerabilities) || typeof body.ok !== 'boolean') throw new Error('Invalid Snyk dependency report');
	const issues = new Map();

	for (const item of body.vulnerabilities) {
		const id = text(item.id);
		const name = text(item.name);
		const version = text(item.version);
		const key = `${id}:${name}:${version}`;

		if (!issues.has(key)) issues.set(key, { id, title: text(item.title), severity: text(item.severity), package: `${name}@${version}`, description: item.description ?? '', fixedIn: item.fixedIn ?? [], paths: [], location: '', trace: [] });
		if (!Array.isArray(item.from) || !item.from.every(/** Require printable package path segments. @param {unknown} segment @returns {boolean} */ (segment) => typeof segment === 'string')) throw new Error('Invalid Snyk dependency path');
		const path = item.from.join(' → ');

		if (!issues.get(key).paths.includes(path)) issues.get(key).paths.push(path);
	}
	return [...issues.values()];
};


/** Format a SARIF location as inert evidence text, never as a filesystem path to open. @param {object} location @returns {string} */
const locationText = (location) => {
	const physical = location?.physicalLocation;

	return physical?.artifactLocation?.uri ? `${physical.artifactLocation.uri}:${physical.region?.startLine ?? 1}` : '';
};


/** Normalize Snyk Code SARIF with per-finding source locations and data-flow references. @param {object} body @returns {object[]} */
const code = (body) => {
	if (body.version !== '2.1.0' || !Array.isArray(body.runs) || !body.runs.length) throw new Error('Invalid Snyk Code SARIF');
	const issues = [];

	for (const run of body.runs) {
		if (run.tool?.driver?.name !== 'SnykCode' || !Array.isArray(run.results)) throw new Error('Invalid Snyk Code execution results');
		if (run.invocations?.some(/** Do not reinterpret a tool execution failure as a clean scan. @param {object} invocation @returns {boolean} */ (invocation) => invocation.executionSuccessful === false)) throw new Error('Snyk Code reported an execution failure');
		const rules = new Map((run.tool.driver.rules ?? []).map(/** Index genuine scanner rule metadata. @param {object} rule @returns {[string, object]} */ (rule) => [rule.id, rule]));

		for (const result of run.results) {
			const rule = rules.get(result.ruleId);
			const level = result.level ?? rule?.defaultConfiguration?.level;
			const severity = { error: 'high', warning: 'medium', note: 'low', none: 'low' }[level];
			const trace = [];

			if (!severity) throw new Error('Unknown Snyk Code severity');
			for (const flow of result.codeFlows ?? []) for (const thread of flow.threadFlows ?? []) for (const step of thread.locations ?? []) {
				const location = locationText(step.location);

				if (location && !trace.includes(location)) trace.push(location);
			}
			issues.push({ id: text(result.ruleId), title: rule?.shortDescription?.text ?? result.ruleId, severity, description: text(result.message?.text), location: (result.locations ?? []).map(locationText).filter(Boolean).join(', '), trace, paths: [], fixedIn: [] });
		}
	}
	return issues;
};


/** Accept only completed Snyk exits and valid scanner evidence; all severities remain visible and high/critical findings block release. @param {'dependencies'|'code'} kind @param {unknown} body @param {number} exitCode @returns {object} */
export const summarizeSnyk = (kind, body, exitCode) => {
	if (![0, 1].includes(exitCode)) throw new Error(`Snyk scan failed with exit ${exitCode}`);
	if (!body || typeof body !== 'object' || Array.isArray(body) || body.error || body.ok === false && !Array.isArray(body.vulnerabilities)) throw new Error('Snyk returned an error instead of scan evidence');
	if (!['dependencies', 'code'].includes(kind)) throw new Error('Unknown Snyk scan kind');
	const issues = kind === 'dependencies' ? dependencies(body) : code(body);
	const counts = { critical: 0, high: 0, medium: 0, low: 0 };

	for (const issue of issues) {
		if (!Object.hasOwn(counts, issue.severity)) throw new Error('Unknown Snyk finding severity');
		counts[issue.severity]++;
	}
	if (kind === 'dependencies' && body.ok !== (exitCode === 0)) throw new Error('Snyk dependency completion and exit code disagree');
	if ((exitCode === 1) !== (issues.length > 0)) throw new Error('Snyk exit code and finding evidence disagree');
	return { status: 'completed', exitCode, passed: counts.critical + counts.high === 0, counts, issues, dependencyCount: kind === 'dependencies' ? body.dependencyCount ?? null : null };
};
