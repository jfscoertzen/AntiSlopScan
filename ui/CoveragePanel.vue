<!--
@author Stephan Coertzen (coertzen.jfs@gmail.com)
@license Apache-2.0
antislopscan is open-source software. See LICENSE.TXT for license information.
-->
<script setup lang="ts">
import { computed } from 'vue';
import { categories, type AuditResult } from '../src/domain';
import { categoryPresentation } from './presentation';
import UiIcon from './UiIcon.vue';

const props = defineProps<{ result: AuditResult }>();
defineEmits<{ drill: [field: string, value: string] }>();
const scores = computed(
	/** Present exact scores and penalty contributions without recalculation. */ () =>
		categories.map(
			/** Describe one canonical category. */ (key) => ({
				key,
				label: categoryPresentation[key].label,
				score: props.result.scores.categories[key],
				penalty: props.result.scores.penalties[key]
			})
		)
);
const completed = computed(
	/** Count executions separately from findings or CI status. */ () =>
		props.result.scanners.filter(
			/** Match completed executions. */ (scanner) => scanner.status === 'completed'
		).length
);
</script>
<template>
	<section id="coverage" class="content-section" aria-labelledby="coverage-title">
		<div class="section-heading">
			<div>
				<p class="folio">Execution transparency</p>
				<h2 id="coverage-title">Scores and scanner coverage</h2>
			</div>
			<span class="coverage-value"><UiIcon name="activity" />{{ result.scores.coverage }}% coverage</span>
		</div>
		<p class="section-description">
			{{ completed }} of {{ result.scanners.length }} scanner executions completed. Coverage uses applicable
			tools; completion describes execution, not a clean result.
		</p>
		<div class="panel scroll">
			<table class="scanner-table">
				<thead>
					<tr>
						<th>Scanner / version</th>
						<th>Execution status</th>
						<th>Files</th>
						<th>Duration</th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="scanner in result.scanners" :key="scanner.id">
						<td>
							<button class="text-button" @click="$emit('drill', 'scanner', scanner.id)">
								{{ scanner.name }}</button
							><small>{{ scanner.version }}</small>
							<p v-if="scanner.message" class="scanner-message">{{ scanner.message }}</p>
						</td>
						<td>
							<span class="execution-status" :class="`status-${scanner.status}`"
								><UiIcon
									:name="
										scanner.status === 'completed'
											? 'circleCheck'
											: scanner.status === 'failed' || scanner.status === 'timed_out'
												? 'circleX'
												: 'info'
									"
								/>{{ scanner.status.replaceAll('_', ' ') }}</span
							>
						</td>
						<td>{{ scanner.analyzedFiles.toLocaleString() }}</td>
						<td>{{ (scanner.durationMs / 1000).toFixed(1) }}s</td>
					</tr>
				</tbody>
			</table>
		</div>
		<details class="disclosure">
			<summary>Scoring methodology</summary>
			<div class="disclosure-body">
				<p>{{ result.scores.formula }}</p>
				<p>
					Mean detector confidence: {{ result.scores.confidence ?? 'not assessed' }}%. Confidence is an
					estimate, not a calibrated probability.
				</p>
				<div class="scroll">
					<table>
						<thead>
							<tr>
								<th>Category</th>
								<th>Quality score / 100</th>
								<th>Penalty</th>
							</tr>
						</thead>
						<tbody>
							<tr v-for="item in scores" :key="item.key">
								<td>{{ item.label }}</td>
								<td>{{ item.score ?? 'Not assessed' }}</td>
								<td>{{ item.penalty }}</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		</details>
	</section>
</template>
