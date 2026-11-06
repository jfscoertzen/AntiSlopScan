<!--
@author Stephan Coertzen (coertzen.jfs@gmail.com)
@license Apache-2.0
antislopscan is open-source software. See LICENSE.TXT for license information.
-->
<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { filterEvidence, groupEvidence, referencesFor } from '../src/review';
import type { EvidenceFilters } from '../src/review';
import type { AuditResult, Finding } from '../src/domain';
import { categoryPresentation, severityIcons } from './presentation';
import UiIcon from './UiIcon.vue';

const props = defineProps<{
	result: AuditResult;
	drill?: { field: string; value: string; serial: number };
}>();
const defaults: EvidenceFilters = {
	query: '',
	severity: '',
	category: '',
	ruleId: '',
	file: '',
	scanner: '',
	assessment: '',
	method: '',
	sort: 'severity',
	minimumConfidence: 0
};
const filters = reactive<EvidenceFilters>({ ...defaults });
const page = ref(1);
const pageSize = 50;
const copyNotice = ref('');
const advanced = ref<HTMLDetailsElement>();
const findings = computed(
	/** Derive the exact filtered selection before pagination or export. */ () =>
		filterEvidence(props.result.findings, filters)
);
const pages = computed(
	/** Keep an empty result on one navigable page. */ () =>
		Math.max(1, Math.ceil(findings.value.length / pageSize))
);
const visible = computed(
	/** Mount only one page of detail elements for large repositories. */ () =>
		findings.value.slice((page.value - 1) * pageSize, page.value * pageSize)
);
const rules = computed(
	/** Supply exact rule identifiers from the current audit. */ () =>
		groupEvidence(props.result.findings, 'ruleId')
);
const files = computed(
	/** Supply exact file paths from the current audit. */ () => groupEvidence(props.result.findings, 'file')
);
const missingFileFilter = computed(
	/** Keep a graph-selected file visible even when it has no findings in the current audit. */ () =>
		Boolean(
			filters.file &&
				!files.value.some(
					/** Match files represented by evidence groups. */ (item) => item.key === filters.file
				)
		)
);

/** Clear all evidence constraints and return to severity order. */
const reset = (): void => {
	Object.assign(filters, defaults);
	page.value = 1;
	copyNotice.value = '';
};

/** Reset pagination when any filter or underlying canonical result changes. */
const firstPage = (): void => {
	page.value = 1;
};

/** Apply an exact dashboard slice with fresh filters and expose advanced constraints when selected. */
const applyDrill = (): void => {
	if (!props.drill) return;
	reset();
	if (['severity', 'category', 'ruleId', 'file', 'scanner'].includes(props.drill.field))
		Object.assign(filters, { [props.drill.field]: props.drill.value });
	if (['ruleId', 'file', 'scanner'].includes(props.drill.field) && advanced.value) {
		advanced.value.open = true;
	}
};

/** Download the complete filtered canonical selection as data without executing any source text. */
const exportSelection = (): void => {
	const blob = new Blob(
		[JSON.stringify({ auditId: props.result.id, filters, findings: findings.value }, null, 2)],
		{ type: 'application/json' }
	);
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');

	anchor.href = url;
	anchor.download = 'antislopscan-filtered-findings.json';
	anchor.click();
	URL.revokeObjectURL(url);
};

/** Copy the selected finding as plain text; expose denied clipboard access without losing evidence. */
const copyEvidence = async (finding: Finding): Promise<void> => {
	const text = `${finding.file}:${finding.line}\n${finding.ruleId}: ${finding.message}\n${finding.evidence}${finding.snippet ? `\n\n${finding.snippet}` : ''}\n\nRecommendation: ${finding.recommendation}`;

	try {
		await navigator.clipboard.writeText(text);
		copyNotice.value = `Copied evidence for ${finding.file}:${finding.line}.`;
	} catch {
		copyNotice.value = 'Clipboard access is unavailable. Select and copy the evidence text below.';
	}
};

watch(filters, firstPage);
watch(/** Observe a different completed audit. */ () => props.result.id, reset);
watch(/** Observe each dashboard click, including a repeated slice. */ () => props.drill, applyDrill);
</script>

<template>
	<section id="findings" class="evidence" aria-labelledby="findings-title" tabindex="-1">
		<div class="section-heading">
			<div>
				<p class="folio">Investigation workspace</p>
				<h2 id="findings-title">Findings</h2>
			</div>
			<button class="secondary" @click="exportSelection">
				<UiIcon name="download" />Export filtered JSON
			</button>
		</div>
		<div class="filters">
			<div>
				<label for="evidence-search">Search evidence</label
				><input
					id="evidence-search"
					v-model="filters.query"
					type="search"
					placeholder="Rule, file, or evidence"
				/>
			</div>
			<div>
				<label for="severity-filter">Severity</label
				><select id="severity-filter" v-model="filters.severity">
					<option value="">All severities</option>
					<option>critical</option>
					<option>major</option>
					<option>minor</option>
					<option>info</option>
				</select>
			</div>
			<div>
				<label for="category-filter">Category</label
				><select id="category-filter" v-model="filters.category">
					<option value="">All categories</option>
					<option v-for="(_score, name) in result.scores.categories" :key="name">{{ name }}</option>
				</select>
			</div>
		</div>
		<details ref="advanced" class="advanced">
			<summary>Advanced filters</summary>
			<div class="advanced-filters">
				<label for="rule-filter"
					>Rule<select id="rule-filter" v-model="filters.ruleId">
						<option value="">All rules</option>
						<option v-for="item in rules" :key="item.key" :value="item.key">
							{{ item.key }} ({{ item.count }})
						</option>
					</select></label
				>
				<label for="file-filter"
					>File<select id="file-filter" v-model="filters.file">
						<option value="">All files</option>
						<option v-if="missingFileFilter" :value="filters.file">{{ filters.file }} (0 findings)</option>
						<option v-for="item in files" :key="item.key" :value="item.key">
							{{ item.key }} ({{ item.count }})
						</option>
					</select></label
				>
				<label for="scanner-filter"
					>Scanner<select id="scanner-filter" v-model="filters.scanner">
						<option value="">All scanners</option>
						<option v-for="scanner in result.scanners" :key="scanner.id" :value="scanner.id">
							{{ scanner.name }}
						</option>
					</select></label
				>
				<label for="assessment-filter"
					>Assessment<select id="assessment-filter" v-model="filters.assessment">
						<option value="">All assessments</option>
						<option value="verified_violation">Verified violation</option>
						<option value="strong_evidence">Strong evidence</option>
						<option value="potential_risk">Potential risk</option>
						<option value="informational">Informational observation</option>
					</select></label
				>
				<label for="method-filter"
					>Detection method<select id="method-filter" v-model="filters.method">
						<option value="">All methods</option>
						<option value="deterministic">Deterministic</option>
						<option value="heuristic">Heuristic</option>
						<option value="ai_assisted">AI assisted</option>
					</select></label
				>
				<label for="confidence-filter"
					>Minimum confidence (%)<input
						id="confidence-filter"
						v-model.number="filters.minimumConfidence"
						type="number"
						min="0"
						max="100"
						step="1"
				/></label>
			</div>
		</details>
		<div class="inline filter-actions">
			<label for="sort-filter"
				>Sort evidence<select id="sort-filter" v-model="filters.sort">
					<option value="severity">Severity first</option>
					<option value="file">File and line</option>
					<option value="confidence">Confidence first</option>
				</select></label
			><button class="secondary" @click="reset">Reset filters</button>
		</div>
		<p role="status" class="muted">
			{{ findings.length.toLocaleString() }} matching findings / page {{ page }} of {{ pages }} / up to
			{{ pageSize }} per page
		</p>
		<p v-if="!findings.length">
			No findings match these filters. Check scanner coverage before interpreting an empty result.
		</p>
		<p v-if="copyNotice" role="status" class="copy-notice">{{ copyNotice }}</p>
		<details v-for="finding in visible" :id="`finding-${finding.id}`" :key="finding.id" class="finding">
			<summary>
				<span :class="`finding-symbol ${finding.severity}`"
					><UiIcon :name="severityIcons[finding.severity]" /></span
				><span class="finding-summary"
					><span class="classification"
						><strong :class="finding.severity">{{ finding.severity }}</strong
						><span>{{ categoryPresentation[finding.category].label }}</span
						><span>{{ finding.assessment.replaceAll('_', ' ') }}</span></span
					>
					<h3>{{ finding.message }}</h3>
					<span class="location"
						>{{ finding.file }}:{{ finding.line }} <span>/ {{ finding.ruleId }}</span></span
					></span
				><UiIcon name="chevron" />
			</summary>
			<div class="finding-body">
				<div class="evidence-heading">
					<h4><UiIcon name="code" />Evidence</h4>
					<button class="secondary" @click="copyEvidence(finding)">
						<UiIcon name="copy" />Copy evidence
					</button>
				</div>
				<p>{{ finding.evidence }}</p>
				<pre v-if="finding.snippet">{{ finding.snippet }}</pre>
				<div class="recommendation">
					<h4><UiIcon name="wrench" />Recommendation</h4>
					<p>{{ finding.recommendation }}</p>
				</div>
				<dl class="metadata">
					<div>
						<dt>Detection</dt>
						<dd>{{ finding.method }} / {{ Math.round(finding.confidence * 100) }}% confidence</dd>
					</div>
					<div>
						<dt>Provenance</dt>
						<dd>{{ finding.sources.join(', ') }}</dd>
					</div>
					<div>
						<dt>Principles</dt>
						<dd>{{ finding.principles.join(', ') || 'No principle mapping' }}</dd>
					</div>
					<div>
						<dt>Fingerprint</dt>
						<dd class="path">{{ finding.fingerprint }}</dd>
					</div>
				</dl>
				<h4>Issue references</h4>
				<ul v-if="referencesFor(finding).length" class="references">
					<li v-for="reference in referencesFor(finding)" :key="reference.url">
						<a :href="reference.url" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">{{
							reference.title
						}}</a>
					</li>
				</ul>
				<p v-else class="muted">
					No curated online reference for this rule. Use the evidence and remediation above.
				</p>
				<p class="caption">
					References open external documentation when clicked. Detector confidence is an estimate, not a
					calibrated probability.
				</p>
			</div>
		</details>
		<div class="pagination">
			<button class="secondary" :disabled="page <= 1" @click="page--">Previous findings</button
			><span>Page {{ page }} / {{ pages }}</span
			><button class="secondary" :disabled="page >= pages" @click="page++">Next findings</button>
		</div>
	</section>
</template>
