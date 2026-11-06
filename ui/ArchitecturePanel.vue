<!--
@author Stephan Coertzen (coertzen.jfs@gmail.com)
@license Apache-2.0
antislopscan is open-source software. See LICENSE.TXT for license information.
-->
<script setup lang="ts">
import { computed, ref } from 'vue';
import type { AuditResult } from '../src/domain';
import { groupEvidence } from '../src/review';
import DependencyGraph from './DependencyGraph.vue';
import UiIcon from './UiIcon.vue';
import PrinciplesPanel from './PrinciplesPanel.vue';

const props = defineProps<{ result: AuditResult }>();
const emit = defineEmits<{ drill: [field: string, value: string] }>();
const edgeQuery = ref('');
const architectureRules = computed(
	/** Group only canonical architectural and systems findings. */ () =>
		groupEvidence(
			props.result.findings.filter(
				/** Select the relevant evidence categories. */ (finding) =>
					finding.category === 'architecture' || finding.category === 'systemsThinking'
			),
			'ruleId'
		).slice(0, 8)
);
const hotspots = computed(
	/** Rank actual graph nodes by connectivity, then complexity. */ () =>
		[...props.result.graph.nodes]
			.sort(
				/** Prioritize high-impact modules without inferring defects. */ (left, right) =>
					right.fanIn + right.fanOut - (left.fanIn + left.fanOut) || right.complexity - left.complexity
			)
			.slice(0, 12)
);
const edges = computed(
	/** Bound the visible relationship table while retaining exact full counts in the report. */ () =>
		props.result.graph.edges
			.filter(
				/** Match either side of a static dependency relationship. */ (edge) =>
					`${edge.from} ${edge.to}`.toLowerCase().includes(edgeQuery.value.toLowerCase())
			)
			.slice(0, 100)
);

/** Open findings for a measured graph node. */
const inspectFile = (file: string): void => emit('drill', 'file', file);


/** Forward an exact principle evidence slice without changing its field or value. */
const inspectPrinciple = (field: string, value: string): void => emit('drill', field, value);
</script>

<template>
	<section id="architecture" class="content-section">
		<div class="section-heading">
			<div>
				<p class="folio">
					Connected systems / {{ result.graph.nodes.length }} modules /
					{{ result.graph.edges.length }} imports
				</p>
				<h2>Architecture and systems evidence</h2>
			</div>
			<UiIcon name="network" />
		</div>
		<PrinciplesPanel :result="result" @drill="inspectPrinciple" />
		<div class="structural-outcome">
			<strong>{{ result.erosion.score ?? 'N/A' }}<small>/100</small></strong>
			<div>
				<h3>
					{{
						result.erosion.basis === 'historical_comparison'
							? 'Architectural erosion comparison'
							: 'Current structural risk'
					}}
				</h3>
				<p>{{ result.erosion.explanation }}</p>
			</div>
		</div>
		<details class="disclosure">
			<summary>Structural measurements and deltas</summary>
			<pre>{{
				JSON.stringify({ measurements: result.erosion.measurements, deltas: result.erosion.deltas }, null, 2)
			}}</pre>
		</details>
		<DependencyGraph :graph="result.graph" @inspect="inspectFile" />
		<div v-if="architectureRules.length" class="architecture-rules">
			<h3>Architecture and systems finding groups</h3>
			<div class="rule-groups">
				<button
					v-for="item in architectureRules"
					:key="item.key"
					class="secondary"
					@click="$emit('drill', 'ruleId', item.key)"
				>
					<UiIcon name="workflow" /><span>{{ item.key }}</span
					><strong>{{ item.count }}</strong>
				</button>
			</div>
		</div>
		<h3>Connected modules to review</h3>
		<p class="caption">
			Connectivity is a change-impact indicator. A highly connected module is not automatically defective.
			Select a file to inspect its findings.
		</p>
		<div class="scroll">
			<table>
				<thead>
					<tr>
						<th>Module</th>
						<th>Fan-in</th>
						<th>Fan-out</th>
						<th>Complexity</th>
						<th>Lines</th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="node in hotspots" :key="node.file">
						<td>
							<button class="text-button path" @click="inspectFile(node.file)">{{ node.file }}</button>
						</td>
						<td>{{ node.fanIn }}</td>
						<td>{{ node.fanOut }}</td>
						<td>{{ node.complexity }}</td>
						<td>{{ node.lines }}</td>
					</tr>
				</tbody>
			</table>
			<p v-if="!hotspots.length">No JS/TS graph nodes were assessed.</p>
		</div>
		<details>
			<summary>Runtime dependency cycles ({{ result.graph.cycles.length }})</summary>
			<ul>
				<li v-for="(cycle, index) in result.graph.cycles" :key="index" class="path">
					{{ cycle.join(' → ') }}
				</li>
			</ul>
			<p v-if="!result.graph.cycles.length">
				No resolved runtime cycles were found. Unresolved imports remain outside this conclusion.
			</p>
		</details>
		<details>
			<summary>Resolved dependency relationships ({{ result.graph.edges.length }})</summary>
			<p>
				Imports describe static structure. They do not establish causal or feedback loops. Showing up to 100
				matching edges; the JSON report retains all relationships.
			</p>
			<label for="edge-search"
				>Filter dependency relationships<input
					id="edge-search"
					v-model="edgeQuery"
					type="search"
					placeholder="Importer or dependency path"
			/></label>
			<div class="scroll">
				<table>
					<thead>
						<tr>
							<th>Importer</th>
							<th>Dependency</th>
							<th>Kind</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="(edge, index) in edges" :key="index">
							<td>{{ edge.from }}:{{ edge.line }}</td>
							<td>{{ edge.to }}</td>
							<td>{{ edge.typeOnly ? 'type' : 'runtime' }}</td>
						</tr>
					</tbody>
				</table>
			</div>
		</details>
	</section>
</template>
