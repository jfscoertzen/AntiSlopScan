/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import type { AuditResult, Erosion } from '../domain.js';

/** Compare structural measurements only for matching projects and policies; never infer defects from churn. */
export const measureErosion = (result: AuditResult, baseline?: AuditResult): Erosion => {
	const measurements = collectMeasurements(result);
	const deltas: Record<string, number> = {};
	const comparable = baseline !== undefined && result.project.identity === baseline.project.identity && result.configurationHash === baseline.configurationHash;

	if (baseline && !comparable) throw new Error('Baseline project or analysis policy does not match this audit');
	if (comparable) {
		const prior = collectMeasurements(baseline!);

		for (const [name, value] of Object.entries(measurements)) deltas[name] = value - (prior[name] ?? 0);
	}

	const signals = comparable ? deltas : measurements;
	let penalty = 0;

	for (const name of ['cycles', 'boundaryViolations', 'highFanOutModules', 'complexModules', 'duplicateIndicators']) penalty += Math.max(0, signals[name] ?? 0) * (name === 'cycles' || name === 'boundaryViolations' ? 8 : 3);
	if (comparable) penalty += Math.min(10, Math.max(0, deltas.dependencies ?? 0));

	const systems = result.scanners.find(isSystemsScanner);
	const assessable = systems?.status === 'completed' && result.graph.nodes.length > 0;

	return {
		basis: comparable ? 'historical_comparison' : 'current_structural_risk', score: assessable ? Math.round(100 / (1 + penalty / 20)) : null,
		baselineId: comparable ? baseline!.id : undefined, comparable, measurements, deltas,
		explanation: comparable ? 'Higher is better. Positive changes in runtime cycle components, configured boundary violations, high-fan-out modules, complex modules, duplicate indicators, and dependency count reduce this score. Absolute counts and per-kLOC densities are provided; changes in scope still need review. This measures structural change, not defect incidence.' : 'No historical baseline was supplied. Higher is better; this score describes current structural risk, not measured deterioration. Counts of cycles and boundaries carry weight 8; coupling, complexity, and duplication indicators carry weight 3; score=100/(1+penalty/20). Unused abstractions, runtime consistency, and semantic pattern drift require additional evidence.',
	};
};


/** Identify the independent engine's scanner result. */
const isSystemsScanner = (scanner: AuditResult['scanners'][number]): boolean => scanner.id === 'systems';


/** Collect reproducible measurements without depending on scanner execution order. */
const collectMeasurements = (result: AuditResult): Record<string, number> => {
	const measurements: Record<string, number> = { cycles: result.graph.cycles.length, boundaryViolations: 0, highFanOutModules: 0, complexModules: 0, duplicateIndicators: 0, dependencies: result.inventory.dependencies.length, relativeEdges: result.graph.edges.length, modules: result.graph.nodes.length, totalLines: result.inventory.totalLines, maximumFanIn: 0, maximumFanOut: 0, maximumComplexity: 0 };

	for (const finding of result.findings) {
		if (finding.ruleId === 'architecture/boundary') measurements.boundaryViolations += 1;
		if (finding.ruleId === 'architecture/fan-out') measurements.highFanOutModules += 1;
		if (finding.ruleId === 'design/complexity') measurements.complexModules += 1;
		if (finding.ruleId === 'design/duplication') measurements.duplicateIndicators += 1;
	}
	for (const node of result.graph.nodes) {
		measurements.maximumFanIn = Math.max(measurements.maximumFanIn, node.fanIn);
		measurements.maximumFanOut = Math.max(measurements.maximumFanOut, node.fanOut);
		measurements.maximumComplexity = Math.max(measurements.maximumComplexity, node.complexity);
	}

	measurements.duplicateIndicatorsPerKloc = measurements.duplicateIndicators / Math.max(1, measurements.totalLines / 1000);
	return measurements;
};
