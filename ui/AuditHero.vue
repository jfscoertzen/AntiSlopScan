<!--
@author Stephan Coertzen (coertzen.jfs@gmail.com)
@license Apache-2.0
antislopscan is open-source software. See LICENSE.TXT for license information.
-->
<script setup lang="ts">
import { computed } from 'vue';
import type { AuditResult } from '../src/domain';
import ScoreGauge from './ScoreGauge.vue';
import UiIcon from './UiIcon.vue';
import NetworkBackdrop from './NetworkBackdrop.vue';
import MetricCard from './MetricCard.vue';
import { auditTimestamp } from './presentation';

const props = defineProps<{ result: AuditResult }>();
defineEmits<{ download: [format: string]; drill: [field: string, value: string] }>();
const criticalCount = computed(
	/** Count actual critical-classified findings without inferring confirmed vulnerabilities. */ () =>
		props.result.findings.filter(
			/** Match the canonical critical severity. */ (finding) => finding.severity === 'critical'
		).length
);
const completeScanners = computed(
	/** Count completed scanner executions independently of their findings. */ () =>
		props.result.scanners.filter(
			/** Match a successfully completed execution. */ (scanner) => scanner.status === 'completed'
		).length
);
const duration = computed(
	/** Display elapsed audit time from canonical timestamps. */ () =>
		Math.max(0, (Date.parse(props.result.completedAt) - Date.parse(props.result.startedAt)) / 1000)
);
</script>
<template>
	<section class="audit-hero" aria-labelledby="repository-title">
		<NetworkBackdrop />
		<div class="hero-main">
			<div class="hero-context">
				<p class="folio">
					<span class="context-icon"><UiIcon name="folder" /></span> Repository assessment
					<span class="snapshot-label">Current snapshot</span>
				</p>
				<h1 id="repository-title" tabindex="-1">{{ result.project.name }}</h1>
				<p class="repository-path">
					<UiIcon name="code" /><span>{{ result.project.source }}</span>
				</p>
				<div class="audit-meta">
					<span
						><UiIcon name="clock" /><time :datetime="result.completedAt">{{
							auditTimestamp(result.completedAt)
						}}</time></span
					><span>{{ duration.toFixed(1) }}s scan</span
					><span>{{ result.inventory.languages.join(' / ') }}</span>
				</div>
				<div class="gate-line">
					<span class="gate-badge" :class="result.ci.passed ? 'gate-pass' : 'gate-fail'"
						><UiIcon :name="result.ci.passed ? 'circleCheck' : 'circleX'" /> CI gate:
						{{ result.ci.passed ? 'PASS' : 'FAIL' }}</span
					><span class="caption">{{
						result.ci.passed
							? 'Configured quality gates passed'
							: 'Action required before the configured gate passes'
					}}</span>
				</div>
				<ul v-if="result.ci.reasons.length" class="gate-reasons">
					<li v-for="reason in result.ci.reasons" :key="reason">{{ reason }}</li>
				</ul>
				<div class="hero-actions">
					<button
						v-if="criticalCount"
						class="primary compact-button"
						@click="$emit('drill', 'severity', 'critical')"
					>
						<UiIcon name="scan" />Review critical findings<UiIcon name="chevron" />
					</button>
					<nav class="downloads" aria-label="Download audit reports">
						<button
							v-for="report in result.reports"
							:key="report.format"
							class="export-button"
							:disabled="report.status !== 'completed'"
							:title="report.message ?? `Download ${report.format.toUpperCase()} report`"
							@click="$emit('download', report.format)"
						>
							<UiIcon name="download" />{{ report.format.toUpperCase()
							}}<span v-if="report.status !== 'completed'"> unavailable</span>
						</button>
					</nav>
				</div>
				<p
					v-if="result.erosion.comparable && result.erosion.basis === 'historical_comparison'"
					class="baseline-note"
				>
					<UiIcon name="branch" /> Structural comparison with baseline
					{{ result.erosion.baselineId?.slice(0, 8) }} available in Architecture.
				</p>
			</div>
			<div class="hero-score">
				<ScoreGauge :score="result.scores.overall" />
				<h2>Overall quality</h2>
				<p>Higher is better. The CI gate is assessed separately.</p>
			</div>
		</div>
		<div class="hero-metrics">
			<MetricCard
				label="Tool execution coverage"
				:value="`${result.scores.coverage}%`"
				:description="`${completeScanners} scanners completed`"
				icon="activity"
			/>
			<MetricCard
				label="Evidence findings"
				:value="result.findings.length.toLocaleString()"
				:description="`${result.inventory.files.length.toLocaleString()} source files inspected`"
				icon="scan"
			/>
			<MetricCard
				label="Critical findings"
				:value="criticalCount.toLocaleString()"
				description="Detector flags requiring contextual review"
				icon="alert"
				:tone="criticalCount ? 'metric-danger' : ''"
			/>
			<MetricCard
				label="Source footprint"
				:value="result.inventory.totalLines.toLocaleString()"
				description="Source lines in the audit inventory"
				icon="layers"
			/>
		</div>
		<p class="art-caption">
			Illustrative topology artwork; measured dependency relationships are in Architecture.
		</p>
	</section>
</template>
