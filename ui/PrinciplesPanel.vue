<!--
@author Stephan Coertzen (coertzen.jfs@gmail.com)
@license Apache-2.0
antislopscan is open-source software. See LICENSE.TXT for license information.
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { AuditResult } from '../src/domain';
import { principleDomain, principleFamily, principleState, conceptExplanations } from './principles';
import PrincipleIllustration from './PrincipleIllustration.vue';
import ScoreGauge from './ScoreGauge.vue';
import UiIcon from './UiIcon.vue';
import { backgroundMotion } from './theme';

const props = defineProps<{ result: AuditResult }>();
defineEmits<{ drill: [field: string, value: string] }>();
const query = ref('');
const state = ref('');
const domain = ref('');
const page = ref(1);
const pageSize = 14;
const expanded = ref(new Set<string>());
const ai = computed(
	/** Read optional new review data while keeping all historical audits usable. */ () =>
		props.result.aiArchitecture
);
const aiScanner = computed(
	/** Explain missing or failed review using the actual scanner status. */ () =>
		props.result.scanners.find(
			/** Locate the registered semantic adapter. */ (scanner) => scanner.id === 'ai'
		)
);
const linkedRules = computed(
	/** Index real principle-to-rule relationships once for exact evidence navigation. */ () => {
		const index = new Map<string, Set<string>>();

		for (const finding of props.result.findings) {
			if (finding.method === 'ai_assisted') continue;
			for (const id of finding.principles) {
				if (!index.has(id)) index.set(id, new Set());
				index.get(id)!.add(finding.ruleId);
			}
		}
		return index;
	}
);
const rows = computed(
	/** Join two separate assessment methods without overwriting either conclusion. */ () =>
		props.result.principles.map(
			/** Attach presentation metadata and matching optional model evidence. */ (principle) => {
				const review = ai.value?.principles.find(
					/** Match only the same catalog principle. */ (item) => item.principleId === principle.id
				);

				return {
					...principle,
					ai: review,
					state: principleState(principle, review),
					domain: principleDomain(principle.id),
					family: principleFamily(principle.id),
					rules: [...(linkedRules.value.get(principle.id) ?? [])]
				};
			}
		)
);
const filtered = computed(
	/** Apply user constraints to canonical assessments and their explanations. */ () =>
		rows.value.filter(
			/** Match exact status/domain filters and readable principle text. */ (row) =>
				(!state.value || row.state === state.value) &&
				(!domain.value || row.domain === domain.value) &&
				`${row.name} ${row.id} ${row.description}`.toLowerCase().includes(query.value.toLowerCase())
		)
);
const pages = computed(
	/** Keep zero results on a valid first page. */ () =>
		Math.max(1, Math.ceil(filtered.value.length / pageSize))
);
const visible = computed(
	/** Bound mounted disclosures and illustrations for large principle catalogs. */ () =>
		filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize)
);
const risks = computed(
	/** Count principles with supported static indicators or separately labeled LLM risk interpretations. */ () =>
		rows.value.filter(
			/** Count each principle once rather than summing finding occurrences. */ (row) => row.state === 'risk'
		).length
);
const states = [
	{ value: '', label: 'All assessments' },
	{ value: 'risk', label: 'Risks' },
	{ value: 'supported', label: 'Supported in sample' },
	{ value: 'observation', label: 'Observations' },
	{ value: 'unassessed', label: 'Not assessable' }
];

/** Reset the page after a filter or audit changes. */
const firstPage = (): void => {
	page.value = 1;
	expanded.value = new Set();
};

/** Stop off-page illustration playback when pagination replaces its native disclosures. */
const clearExpanded = (): void => {
	expanded.value = new Set();
};

/** Track only open native disclosures so collapsed rows never animate. */
const trackExpanded = (event: Event, id: string): void => {
	const next = new Set(expanded.value);

	if ((event.currentTarget as HTMLDetailsElement).open) next.add(id);
	else next.delete(id);
	expanded.value = next;
};

watch([query, state, domain], firstPage);
watch(page, clearExpanded);
watch(/** Observe a changed historical audit. */ () => props.result.id, firstPage);
</script>
<template>
	<div class="principles-workspace" aria-labelledby="principles-title">
		<div class="section-heading">
			<div>
				<p class="folio">Architecture principle intelligence</p>
				<h3 id="principles-title">Design and systems principles</h3>
				<p class="caption">Inspect the principle, its evidence and the limits of each assessment.</p>
			</div>
			<button
				class="secondary"
				:aria-pressed="backgroundMotion"
				@click="backgroundMotion = !backgroundMotion"
			>
				{{ backgroundMotion ? 'Pause illustrations' : 'Play illustrations' }}
			</button>
		</div>
		<div class="principle-summary">
			<div class="principle-score panel">
				<ScoreGauge :score="ai?.score ?? null" label="LLM architecture sample score" />
				<div>
					<h4>LLM architecture score</h4>
					<strong>{{
						ai?.status === 'partial' ? 'Incomplete review' : ai ? 'Sample-based assessment' : 'Not requested'
					}}</strong>
					<p class="caption">Higher is better. Separate from static quality and CI.</p>
				</div>
			</div>
			<div class="principle-kpi panel">
				<UiIcon name="workflow" /><strong>{{ result.principles.length }}</strong
				><span>Catalog principles</span><small>{{ ai?.assessedPrinciples ?? 0 }} received an LLM grade</small>
			</div>
			<div class="principle-kpi panel">
				<UiIcon name="alert" /><strong>{{ risks }}</strong
				><span>Principles with risk indicators</span><small>Static and LLM evidence remain distinct</small>
			</div>
			<div class="principle-kpi panel">
				<UiIcon name="code" /><strong>{{ ai ? `${ai.sampledFiles}/${ai.totalFiles}` : 'N/A' }}</strong
				><span>Files sampled for LLM</span
				><small>{{
					ai
						? `${ai.sampledBytes.toLocaleString()} redacted source bytes`
						: 'Core static analysis remains available'
				}}</small>
			</div>
		</div>
		<div v-if="ai" class="ai-review-provenance">
			<p>
				<UiIcon name="workflow" /><strong>{{ ai.provider }} / {{ ai.model }}</strong
				><span :class="ai.status === 'completed' ? 'info' : 'critical'">{{
					ai.status === 'completed' ? 'Review completed' : 'Partial review; no aggregate score'
				}}</span>
			</p>
			<p class="caption">
				{{ ai.assessedPrinciples }} of {{ ai.requestedPrinciples }} principles scored over a bounded sample.
				{{ ai.sampledDocuments }} supplied architecture documents. Model confidence is an estimate; quotes are
				mechanically checked, conclusions require human review.
			</p>
			<details class="disclosure">
				<summary>LLM scoring methodology and coverage</summary>
				<div class="disclosure-body">
					<p>{{ ai.formula }}</p>
					<ul>
						<li v-for="limit in ai.limitations" :key="limit">{{ limit }}</li>
					</ul>
					<p>Provider: {{ ai.baseUrl }} / Rubric {{ ai.rubricVersion }} / {{ ai.completedAt }}</p>
				</div>
			</details>
			<ul v-if="ai.errors.length" class="error">
				<li v-for="error in ai.errors" :key="error">{{ error }}</li>
			</ul>
		</div>
		<p v-else class="ai-policy-note">
			{{
				aiScanner && ['failed', 'timed_out', 'unavailable', 'unsupported'].includes(aiScanner.status)
					? `LLM review did not complete: ${aiScanner.message}`
					: aiScanner?.status === 'completed'
						? 'This audit contains advisory AI observations, without principle grades.'
						: 'LLM assessment was not requested for this audit. Enable a provider in New assessment to generate evidence-backed principle grades.'
			}}
		</p>
		<div class="principle-toolbar">
			<label for="principle-search"
				>Search principles<input
					id="principle-search"
					v-model="query"
					type="search"
					placeholder="DRY, coupling, boundaries…" /></label
			><label for="principle-domain"
				>Principle domain<select id="principle-domain" v-model="domain">
					<option value="">All domains</option>
					<option value="design">Software design</option>
					<option value="architecture">Architecture</option>
					<option value="systems">Systems thinking</option>
				</select></label
			><label for="principle-assessment"
				>Principle assessment<select id="principle-assessment" v-model="state">
					<option v-for="item in states" :key="item.value" :value="item.value">{{ item.label }}</option>
				</select></label
			>
		</div>
		<p class="caption" role="status">
			{{ filtered.length }} of {{ result.principles.length }} principle assessments / page {{ page }} of
			{{ pages }}
		</p>
		<div class="principle-rows">
			<details
				v-for="principle in visible"
				:key="principle.id"
				:open="expanded.has(principle.id)"
				class="principle-row"
				:class="`principle-${principle.state}`"
				@toggle="trackExpanded($event, principle.id)"
			>
				<summary>
					<PrincipleIllustration :family="principle.family" /><span class="principle-row-title"
						><strong
							>{{ principle.name }} <span class="principle-id">{{ principle.id }}</span></strong
						><span>{{ principle.description }}</span></span
					><span class="principle-row-status"
						><span v-if="principle.ai"
							><UiIcon
								:name="
									principle.ai.assessment === 'supported'
										? 'circleCheck'
										: principle.state === 'risk'
											? 'alert'
											: 'info'
								"
							/>LLM: {{ principle.ai.assessment.replaceAll('_', ' ')
							}}<strong v-if="principle.ai.score !== null">{{ principle.ai.score }}/100</strong></span
						><span v-else
							><UiIcon :name="principle.state === 'risk' ? 'alert' : 'info'" />{{
								principle.assessment.replaceAll('_', ' ')
							}}</span
						><small>{{
							principle.findings.length
								? `${principle.findings.length} static findings`
								: 'No linked static findings'
						}}</small></span
					><UiIcon name="chevron" />
				</summary>
				<div class="principle-detail">
					<figure class="principle-explainer">
						<PrincipleIllustration :family="principle.family" :animated="expanded.has(principle.id)" />
						<figcaption>
							<strong>Understanding {{ principle.name }}</strong>
							<p>{{ conceptExplanations[principle.family] }}</p>
							<small>Conceptual illustration. It does not depict this repository.</small>
						</figcaption>
					</figure>
					<div v-if="principle.ai" class="llm-assessment">
						<h4><UiIcon name="workflow" />LLM interpretation</h4>
						<p>{{ principle.ai.reasoning }}</p>
						<p><strong>Recommendation:</strong> {{ principle.ai.recommendation }}</p>
						<p class="caption">
							Estimated confidence {{ Math.round(principle.ai.confidence * 100) }}%. Assessment:
							{{ principle.ai.assessment.replaceAll('_', ' ') }}.
							{{
								principle.ai.score === null ? 'No score assigned.' : `Sample score ${principle.ai.score}/100.`
							}}
						</p>
						<div v-for="(evidence, index) in principle.ai.evidence" :key="index" class="principle-citation">
							<button class="text-button path" @click="$emit('drill', 'file', evidence.file)">
								{{ evidence.file }}:{{ evidence.line }}–{{ evidence.endLine }}
							</button>
							<pre>{{ evidence.quote }}</pre>
							<p class="caption">
								Quote matched to transmitted source lines. This verifies the citation, not the model's
								interpretation.
							</p>
						</div>
					</div>
					<div class="static-assessment">
						<h4>Static assessment: {{ principle.assessment.replaceAll('_', ' ') }}</h4>
						<p><strong>Method:</strong> {{ principle.methodology }}</p>
						<p><strong>Required evidence:</strong> {{ principle.requiredEvidence }}</p>
						<p><strong>False positives:</strong> {{ principle.falsePositives }}</p>
						<p><strong>Recommendation:</strong> {{ principle.recommendation }}</p>
						<p class="caption">{{ principle.scoreImpact }}</p>
						<div class="principle-linked-rules">
							<button
								v-for="rule in principle.rules.slice(0, 8)"
								:key="rule"
								class="secondary"
								@click="$emit('drill', 'ruleId', rule)"
							>
								Inspect rule {{ rule }}
							</button>
						</div>
					</div>
				</div>
			</details>
		</div>
		<p v-if="!filtered.length" class="muted">No principle assessments match these filters.</p>
		<div class="pagination">
			<button class="secondary" :disabled="page <= 1" @click="page--">Previous principles</button
			><span>Page {{ page }} / {{ pages }}</span
			><button class="secondary" :disabled="page >= pages" @click="page++">Next principles</button>
		</div>
	</div>
</template>
