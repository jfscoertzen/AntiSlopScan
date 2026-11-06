/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import type { Principle, AiPrincipleReview } from '../domain.js';

export type IllustrationFamily = 'consolidation' | 'boundaries' | 'contracts' | 'flows';
const designIds = new Set([
	'DRY',
	'KISS',
	'YAGNI',
	'SRP',
	'OCP',
	'LSP',
	'ISP',
	'DIP',
	'SOC',
	'SSOT',
	'COHESION',
	'COUPLING',
	'ENCAPSULATION',
	'ABSTRACTION',
	'COMPOSITION',
	'ASTONISHMENT',
	'DEMETER',
	'CQS',
	'CONVENTION',
	'EXPLICIT',
	'INFORMATION_HIDING',
	'CONTRACT'
]);
const architectureIds = new Set([
	'MODULARITY',
	'LAYERS',
	'CYCLES',
	'STABILITY',
	'BOUNDARIES',
	'DOMAIN',
	'GOD_MODULE',
	'ABSTRACTION_COST',
	'INHERITANCE',
	'DRIFT',
	'EROSION',
	'PATTERNS',
	'FRAMEWORKS',
	'OVERLAP'
]);
export const conceptExplanations: Record<IllustrationFamily, string> = {
	consolidation:
		'Several copies connect to one shared owner. The shared path represents changing one authoritative implementation instead of keeping duplicated knowledge synchronized.',
	boundaries:
		'Components stay inside coherent modules and communicate through an explicit bridge. The bridge represents a controlled dependency, not unrestricted access to internals.',
	contracts:
		'A stable interface connects interchangeable implementations. Callers keep using the same contract as implementation details change.',
	flows:
		'Work moves through a bounded buffer and a returning control path. This explains accumulation, processing and feedback conceptually; actual runtime loops require independent evidence.'
};

/** Classify catalog principles by their established domain, without deriving project conclusions. */
export const principleDomain = (id: string): string =>
	designIds.has(id) ? 'design' : architectureIds.has(id) ? 'architecture' : 'systems';

/** Choose a conceptual illustration family relevant to the principle's teaching objective. */
export const principleFamily = (id: string): IllustrationFamily => {
	if (['DRY', 'SSOT', 'KISS', 'YAGNI', 'ABSTRACTION_COST', 'FRAMEWORKS'].includes(id)) return 'consolidation';
	if (
		[
			'OCP',
			'LSP',
			'ISP',
			'DIP',
			'ABSTRACTION',
			'COMPOSITION',
			'ASTONISHMENT',
			'CQS',
			'CONVENTION',
			'EXPLICIT',
			'CONTRACT',
			'INHERITANCE',
			'PATTERNS'
		].includes(id)
	)
		return 'contracts';
	return principleDomain(id) === 'systems' || ['CYCLES', 'DRIFT', 'EROSION', 'STABILITY'].includes(id)
		? 'flows'
		: 'boundaries';
};

/** Label separate deterministic and LLM classifications without promoting model output to verified evidence. */
export const principleState = (
	principle: Principle,
	ai?: AiPrincipleReview
): 'risk' | 'supported' | 'observation' | 'unassessed' => {
	if (
		['verified_violation', 'strong_evidence', 'potential_risk'].includes(principle.assessment) ||
		(ai && ['potential_risk', 'violation'].includes(ai.assessment))
	)
		return 'risk';
	if (ai?.assessment === 'supported') return 'supported';
	return principle.assessment === 'informational' ? 'observation' : 'unassessed';
};
