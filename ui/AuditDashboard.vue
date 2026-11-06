<!--
@author Stephan Coertzen (coertzen.jfs@gmail.com)
@license Apache-2.0
antislopscan is open-source software. See LICENSE.TXT for license information.
-->
<script setup lang="ts">
import { computed } from 'vue';
import { groupEvidence, severityOrder } from '../src/review';
import { categories, type AuditResult } from '../src/domain';
import { categoryPresentation, severityIcons } from './presentation';
import UiIcon from './UiIcon.vue';

const props = defineProps<{ result: AuditResult }>();
const emit = defineEmits<{ drill: [field: string, value: string] }>();
const rules = computed(
	/** Rank the complete canonical finding set by rule volume. */ () =>
		groupEvidence(props.result.findings, 'ruleId').slice(0, 8)
);
const files = computed(
	/** Rank source files by complete finding volume. */ () =>
		groupEvidence(props.result.findings, 'file').slice(0, 8)
);
const categoryScores = computed(
	/** Present unchanged canonical scores with explanatory metadata. */ () =>
		categories.map(
			/** Describe one canonical category. */ (key) => ({
				key,
				score: props.result.scores.categories[key],
				...categoryPresentation[key]
			})
		)
);
const severities = computed(
	/** Calculate exact counts and proportional arc geometry from all findings. */ () => {
		let offset = 0;

		return severityOrder.map(
			/** Position consecutive severity arcs without altering counts. */ (key) => {
				const count = props.result.findings.filter(
					/** Match this canonical severity. */ (finding) => finding.severity === key
				).length;
				const fraction = (count / Math.max(1, props.result.findings.length)) * 100;
				const item = { key, count, fraction, offset };

				offset += fraction;
				return item;
			}
		);
	}
);

/** Open an exact evidence slice requested from a dashboard summary. */
const drill = (field: string, value: string): void => emit('drill', field, value);
</script>
<template>
	<section id="dashboard" class="dashboard content-section" aria-labelledby="dashboard-title">
		<div class="section-heading">
			<div>
				<p class="folio">Intelligence overview</p>
				<h2 id="dashboard-title">Where to look first</h2>
			</div>
			<span class="caption">Select a metric to investigate its evidence</span>
		</div>
		<div class="dashboard-grid">
			<div class="panel severity-panel">
				<div class="panel-heading">
					<h3><UiIcon name="scan" />Findings by severity</h3>
					<span class="caption">All detectors</span>
				</div>
				<div class="severity-layout">
					<div class="severity-chart" aria-hidden="true">
						<svg viewBox="0 0 200 200">
							<circle class="chart-track" cx="100" cy="100" r="77" fill="none" stroke-width="17" />
							<circle
								v-for="item in severities"
								:key="item.key"
								:class="`severity-arc ${item.key}`"
								cx="100"
								cy="100"
								r="77"
								fill="none"
								stroke-width="17"
								pathLength="100"
								:stroke-dasharray="`${item.fraction} ${100 - item.fraction}`"
								:stroke-dashoffset="-item.offset"
								transform="rotate(-90 100 100)"
							/>
						</svg>
						<div>
							<strong>{{ result.findings.length.toLocaleString() }}</strong
							><span>findings</span>
						</div>
					</div>
					<div class="severity-legend">
						<button
							v-for="item in severities"
							:key="item.key"
							class="severity-row"
							@click="drill('severity', item.key)"
						>
							<span :class="`severity-name ${item.key}`"
								><UiIcon :name="severityIcons[item.key]" />{{ item.key }}</span
							><strong>{{ item.count.toLocaleString() }}</strong
							><span class="caption">{{ item.fraction.toFixed(1) }}%</span>
						</button>
					</div>
				</div>
				<p class="caption panel-note">
					Severity is a detector classification. Security findings require contextual review.
				</p>
			</div>
			<div class="panel category-panel">
				<div class="panel-heading">
					<h3><UiIcon name="gauge" />Quality by category</h3>
					<span class="caption">Higher is better</span>
				</div>
				<button
					v-for="item in categoryScores"
					:key="item.key"
					class="score-row"
					:title="item.description"
					@click="drill('category', item.key)"
				>
					<UiIcon :name="item.icon" /><span>{{ item.label }}</span
					><svg class="score-track" viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true">
						<rect width="100" height="6" rx="3" />
						<rect class="score-fill" :width="item.score ?? 0" height="6" rx="3" /></svg
					><strong>{{ item.score ?? 'N/A' }}</strong>
				</button>
				<p class="caption panel-note">
					Unassessed categories have no score. Thresholds remain in the audit configuration.
				</p>
			</div>
			<div class="panel">
				<div class="panel-heading">
					<h3><UiIcon name="layers" />Most frequent rules</h3>
					<span class="caption">Top {{ rules.length }}</span>
				</div>
				<p v-if="!rules.length" class="muted">No findings to group.</p>
				<ol class="rank-list">
					<li v-for="(item, index) in rules" :key="item.key">
						<button class="rank-button" @click="drill('ruleId', item.key)">
							<span class="rank-index">{{ String(index + 1).padStart(2, '0') }}</span
							><span class="rank-label"
								>{{ item.key }}<small>{{ item.highSeverity.toLocaleString() }} critical / major</small></span
							><strong>{{ item.count.toLocaleString() }}</strong
							><UiIcon name="chevron" />
						</button>
					</li>
				</ol>
			</div>
			<div class="panel">
				<div class="panel-heading">
					<h3><UiIcon name="file" />Files with most findings</h3>
					<span class="caption">Top {{ files.length }}</span>
				</div>
				<p v-if="!files.length" class="muted">No files with findings.</p>
				<ol class="rank-list">
					<li v-for="(item, index) in files" :key="item.key">
						<button class="rank-button" @click="drill('file', item.key)">
							<span class="rank-index">{{ String(index + 1).padStart(2, '0') }}</span
							><span class="rank-label path"
								>{{ item.key }}<small>{{ item.highSeverity.toLocaleString() }} critical / major</small></span
							><strong>{{ item.count.toLocaleString() }}</strong
							><UiIcon name="chevron" />
						</button>
					</li>
				</ol>
			</div>
		</div>
		<p class="caption">
			Counts include heuristic and informational observations. Repeated low-severity rules can dominate
			volume; inspect the evidence before prioritizing work.
		</p>
	</section>
</template>
