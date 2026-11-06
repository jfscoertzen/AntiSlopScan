/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import type { Finding, Principle } from '../domain.js';

const design: [string, string, string, string][] = [
	['DRY', 'Do not repeat yourself', 'Keep business knowledge authoritative.', 'Token and line clone evidence is an indicator; independent business intent needs review.'],
	['KISS', 'Keep it simple', 'Limit unnecessary decision complexity.', 'AST cyclomatic complexity is a heuristic proxy, not proof of unnecessary complexity.'],
	['YAGNI', 'Build what is needed', 'Avoid speculative features and abstraction.', 'Requires feature requirements and usage evidence; static absence of imports is insufficient.'],
	['SRP', 'Single responsibility', 'Keep responsibilities cohesive.', 'Module size and callable complexity indicate review candidates; responsibility is semantic.'],
	['OCP', 'Open/closed', 'Extend behavior without needless edits to stable code.', 'Requires change scenarios and extension contracts.'],
	['LSP', 'Liskov substitution', 'Preserve behavioral subtype contracts.', 'Requires subtype contracts and behavioral tests.'],
	['ISP', 'Interface segregation', 'Keep consumer contracts focused.', 'Requires consumer usage and contract requirements.'],
	['DIP', 'Dependency inversion', 'Direct policy dependencies through suitable contracts.', 'Configured forbidden dependency edges establish violations; abstraction quality requires review.'],
	['SOC', 'Separation of concerns', 'Keep independent concerns separate.', 'Module size is a review indicator; configured boundaries provide stronger evidence.'],
	['SSOT', 'Single source of truth', 'Keep one authoritative source for shared facts.', 'Duplication alone cannot prove competing authority; domain documentation is required.'],
	['COHESION', 'High cohesion', 'Group behavior that changes for the same reason.', 'Requires semantic or historical change evidence.'],
	['COUPLING', 'Low coupling', 'Minimize unnecessary dependencies.', 'Unique relative-import fan-out and cycles identify structural coupling.'],
	['ENCAPSULATION', 'Encapsulation', 'Protect state through deliberate contracts.', 'Requires visibility, ownership, and contract analysis.'],
	['ABSTRACTION', 'Abstraction', 'Expose essential behavior without accidental detail.', 'Requires intended consumer contracts and semantic review.'],
	['COMPOSITION', 'Composition over inheritance', 'Prefer independent behavior composition where useful.', 'Inheritance depth alone cannot establish inappropriate inheritance.'],
	['ASTONISHMENT', 'Least astonishment', 'Preserve predictable contracts.', 'Requires documented expectations and behavioral tests.'],
	['DEMETER', 'Law of Demeter', 'Limit knowledge of collaborator internals.', 'Member-chain length alone is insufficient, especially for fluent APIs.'],
	['CQS', 'Command/query separation', 'Keep read and mutation contracts explicit.', 'Requires domain side-effect contracts and dataflow.'],
	['CONVENTION', 'Convention over configuration', 'Use established defaults consistently.', 'Requires project-specific architecture conventions.'],
	['EXPLICIT', 'Explicit over implicit', 'Make failures and async ownership visible.', 'AST empty catches and async Promise misuse provide concrete syntax evidence.'],
	['INFORMATION_HIDING', 'Information hiding', 'Hide volatile implementation decisions.', 'Requires documented public contracts and planned changes.'],
	['CONTRACT', 'Design by contract', 'Make preconditions and failure behavior deliberate.', 'Unsafe constructs are detected; complete contract adherence needs behavioral evidence.'],
];

const architecture: [string, string, string, string][] = [
	['MODULARITY', 'Modularity', 'Keep components independently understandable.', 'Relative-import strongly connected components and fan-out expose structural risks.'],
	['LAYERS', 'Layered architecture', 'Respect established layer responsibilities.', 'Only operator-supplied boundary rules can establish layer violations.'],
	['CYCLES', 'Acyclic dependencies', 'Avoid cyclic runtime dependency components.', 'Iterative strongly connected component analysis over resolved runtime imports.'],
	['STABILITY', 'Stable dependency direction', 'Depend toward stable components.', 'Fan-in and fan-out are recorded; volatility requires history and intended direction.'],
	['BOUNDARIES', 'Architectural boundaries', 'Respect explicit dependency constraints.', 'Match configured source and forbidden target globs against resolved import edges.'],
	['DOMAIN', 'Domain isolation', 'Keep domain policy separate from infrastructure.', 'Requires operator-supplied boundaries defining domain paths.'],
	['GOD_MODULE', 'God modules and services', 'Keep each module a bounded concern.', 'Configured line limit yields a potential risk; size does not prove multiple responsibilities.'],
	['ABSTRACTION_COST', 'Excessive abstractions', 'Require evidence for abstraction cost.', 'Requires caller, feature, and lifetime context; one use alone is not a defect.'],
	['INHERITANCE', 'Deep inheritance', 'Control behavioral inheritance complexity.', 'Not assessed without resolved cross-file type hierarchy and contracts.'],
	['DRIFT', 'Architectural drift', 'Track changes against architecture intent.', 'Comparable baseline graph and violation measurements; absent baseline means current risk only.'],
	['EROSION', 'Architectural erosion', 'Measure adverse structural change over time.', 'Comparable baselines record cycle, boundary, coupling, complexity, duplication, and dependency deltas.'],
	['PATTERNS', 'Consistent architecture patterns', 'Apply established patterns consistently.', 'Requires a declared pattern contract; similarity alone cannot establish inconsistency.'],
	['FRAMEWORKS', 'Framework dependency cost', 'Use framework dependencies intentionally.', 'Dependency count is measured; necessity requires requirements and deployment context.'],
	['OVERLAP', 'Service responsibility overlap', 'Give services coherent ownership.', 'Requires service boundaries, capabilities, and domain ownership documentation.'],
];

const systems: [string, string, string, string][] = [
	['HOLISM', 'Holism', 'Consider interactions across components.', 'Resolved source dependency graph is observational; integration behavior is not inferred.'],
	['INTERCONNECTEDNESS', 'Interconnectedness', 'Map component relationships.', 'Resolved import edges provide static structural observations only.'],
	['FEEDBACK', 'Feedback loops', 'Understand event and control feedback.', 'Requires event topology and runtime evidence; import cycles are not causal loops.'],
	['REINFORCING', 'Reinforcing loops', 'Control amplifying feedback behavior.', 'Requires causal relationships and gain evidence; no penalty for absent loops.'],
	['BALANCING', 'Balancing loops', 'Apply stabilizing controls where required.', 'Requires explicit stabilization requirements and runtime behavior.'],
	['EMERGENCE', 'Emergence', 'Test system-level behavior.', 'Requires integration observations beyond static component structure.'],
	['NONLINEARITY', 'Nonlinearity', 'Control amplification and threshold effects.', 'Promise.all over mapped input indicates potential fan-out; bounded inputs can be intentional.'],
	['SYSTEM_BOUNDARIES', 'System boundaries', 'Make system ownership and interfaces explicit.', 'Configured import boundaries establish only source-level constraints.'],
	['STOCKS', 'Stocks and flows', 'Bound state accumulation and processing rates.', 'Unbounded mapped concurrency and operator queue requirements yield review indicators.'],
	['DELAYS', 'Delays', 'Account for timeouts and blocking work.', 'Direct fetch cancellation and sync I/O in async callables are scoped AST heuristics.'],
	['LEVERAGE', 'Leverage points', 'Identify highly connected components.', 'Static fan-in identifies structural change impact, not business importance.'],
	['CAUSAL', 'Causal loop analysis', 'Explain evidence-backed causes and effects.', 'Source imports are not sufficient to construct a causal loop map.'],
	['ARCHETYPES', 'System archetypes', 'Recognize supported recurring system structures.', 'Requires runtime flows, constraints, and causal evidence.'],
	['CONSEQUENCES', 'Unintended consequences', 'Assess cross-component change risk.', 'Fan-in observations identify review scope; outcomes require change scenarios.'],
	['LOCAL_GLOBAL', 'Local versus global optimization', 'Check system-wide cost shifts.', 'Blocking work and mapped fan-out are local indicators requiring load context.'],
	['DYNAMIC', 'Dynamic complexity', 'Understand asynchronous interactions.', 'Async Promise misuse is concrete; runtime scheduling and emergent behavior require integration evidence.'],
	['FAULT_ISOLATION', 'Fault isolation', 'Contain dependency and resource failures.', 'Direct request deadlines are observable; circuit-breaker necessity requires failure requirements.'],
	['IDEMPOTENCY', 'Idempotency and duplicate delivery', 'Keep repeated business effects safe.', 'Requires effect identity, transaction, and delivery contracts; not inferred from method names.'],
	['RETRIES', 'Retries and backoff', 'Bound repeat attempts without duplicate effects.', 'Requires a verified retry mechanism and external effect semantics.'],
	['CONSISTENCY', 'Distributed consistency', 'Preserve declared transaction and consistency contracts.', 'Requires datastore and message-delivery contracts; commits do not prove defects.'],
];

/** Build a complete principle catalog; unsupported concepts remain explicitly unassessable. */
export const assessPrinciples = (findings: Finding[], hasGraph: boolean): Principle[] => {
	const result: Principle[] = [];

	for (const [id, name, description, methodology] of [...design, ...architecture, ...systems]) {
		const related: Finding[] = [];

		for (const finding of findings) { if (finding.principles.includes(id)) related.push(finding); }
		let assessment: Principle['assessment'] = 'not_assessable';

		for (const finding of related) {
			if (finding.assessment === 'verified_violation') { assessment = 'verified_violation'; break; }
			if (finding.assessment === 'strong_evidence') assessment = 'strong_evidence';
			else if (assessment !== 'strong_evidence') assessment = finding.assessment;
		}

		if (!related.length && hasGraph && ['HOLISM', 'INTERCONNECTEDNESS', 'LEVERAGE', 'CONSEQUENCES'].includes(id)) assessment = 'informational';
		result.push({ id, name, description, languages: ['all; AST and import graph evidence currently JS/TS only'], methodology, requiredEvidence: methodology, severity: 'major', confidence: related.length ? Math.max(...related.map(findingConfidence)) : 0, scoreImpact: 'Only actual findings contribute. Informational, not assessable, and not applicable assessments have zero penalty.', recommendation: related.length ? related[0].recommendation : 'Supply architecture requirements, contracts, and integration evidence for human review.', falsePositives: 'A structural or syntax heuristic does not prove intent, production reachability, or a missing capability. Review applicability before acting.', assessment, findings: related.map(findingId) });
	}

	return result;
};


/** Extract a finding confidence for catalog aggregation. */
const findingConfidence = (finding: Finding): number => finding.confidence;


/** Extract a stable finding identifier for principle references. */
const findingId = (finding: Finding): string => finding.id;
