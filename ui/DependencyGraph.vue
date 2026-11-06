<!--
@author Stephan Coertzen (coertzen.jfs@gmail.com)
@license Apache-2.0
antislopscan is open-source software. See LICENSE.TXT for license information.
-->
<script setup lang="ts">
import { computed, ref } from 'vue';
import type { DependencyGraph } from '../src/domain';
import { layoutDependencies } from './graph-layout';
import UiIcon from './UiIcon.vue';

const props = defineProps<{ graph: DependencyGraph }>();
defineEmits<{ inspect: [file: string] }>();
const query = ref('');
const runtimeOnly = ref(false);
const selectedFile = ref('');
const display = computed(
	/** Bound and arrange only actual relationships matching the display controls. */ () =>
		layoutDependencies(props.graph, { query: query.value, runtimeOnly: runtimeOnly.value })
);
const selected = computed(
	/** Retain a visible selection or use the highest-connectivity displayed module. */ () =>
		display.value.nodes.find(
			/** Match the current selection. */ (node) => node.file === selectedFile.value
		) ?? display.value.nodes[0]
);
const relationships = computed(
	/** Show the selected module's actual imports and dependents, bounded for readable inspection. */ () =>
		props.graph.edges
			.filter(
				/** Match incident canonical edges under the current kind filter. */ (edge) =>
					(!runtimeOnly.value || !edge.typeOnly) &&
					(edge.from === selected.value?.file || edge.to === selected.value?.file)
			)
			.slice(0, 16)
);

/** Select a real module without interpreting its layout position as an architectural layer. */
const selectModule = (file: string): void => {
	selectedFile.value = file;
};
</script>
<template>
	<div class="panel dependency-panel">
		<div class="panel-heading">
			<h3><UiIcon name="network" />Dependency explorer</h3>
			<span class="caption">Measured static imports</span>
		</div>
		<div class="graph-controls">
			<label for="graph-search"
				>Find a module<input
					id="graph-search"
					v-model="query"
					type="search"
					placeholder="File path and its direct neighbors" /></label
			><label class="checkbox-control"
				><input v-model="runtimeOnly" type="checkbox" />Runtime imports only</label
			>
		</div>
		<div v-if="!graph.nodes.length || !graph.edges.length" class="graph-empty">
			<UiIcon name="network" />
			<h4>No dependency relationships to visualize</h4>
			<p>
				Resolved module relationships are unavailable in this audit. Source findings and principle assessments
				remain available below.
			</p>
		</div>
		<template v-else>
			<p class="caption graph-count" role="status">
				Showing {{ display.nodes.length }} of {{ display.matchingNodes }} matching modules and
				{{ display.edges.length }} of {{ display.matchingEdges }} matching relationships. Up to 32 modules and
				100 edges are drawn.
			</p>
			<div v-if="display.nodes.length" class="dependency-workspace">
				<div class="graph-canvas">
					<svg
						viewBox="0 0 1000 620"
						aria-label="Resolved dependency map; select a module to inspect its connections"
						role="group"
					>
						<defs>
							<marker
								id="dependency-arrow"
								viewBox="0 0 10 10"
								refX="17"
								refY="5"
								markerWidth="5"
								markerHeight="5"
								orient="auto-start-reverse"
							>
								<path d="M 0 0 L 10 5 L 0 10 z" />
							</marker>
						</defs>
						<ellipse class="graph-orbit" cx="500" cy="310" rx="341" ry="235" />
						<ellipse class="graph-orbit inner" cx="500" cy="310" rx="138" ry="95" />
						<g class="graph-edges">
							<path
								v-for="(edge, index) in display.edges"
								:key="index"
								:d="edge.path"
								:class="{
									connected: edge.from === selected?.file || edge.to === selected?.file,
									'type-edge': edge.typeOnly
								}"
								marker-end="url(#dependency-arrow)"
							>
								<title>{{ edge.from }} → {{ edge.to }} ({{ edge.typeOnly ? 'type' : 'runtime' }})</title>
							</path>
						</g>
						<a
							v-for="(node, index) in display.nodes"
							:key="node.file"
							href="#module-inspector"
							class="graph-node"
							:class="{ 'node-selected': node.file === selected?.file }"
							:aria-label="`Inspect module ${node.file}, ${node.fanIn} incoming and ${node.fanOut} outgoing imports`"
							@click.prevent="selectModule(node.file)"
						>
							<title>{{ node.file }}</title>
							<circle class="node-target" :cx="node.x" :cy="node.y" r="21" />
							<circle class="node-halo" :cx="node.x" :cy="node.y" :r="node.radius + 8" />
							<circle class="node-core" :cx="node.x" :cy="node.y" :r="node.radius" />
							<text
								v-if="index < 5 || node.file === selected?.file"
								:x="node.x"
								:y="node.y + node.radius + 24"
								text-anchor="middle"
							>
								{{ node.label }}
							</text>
						</a>
					</svg>
					<p class="caption graph-legend">
						<span class="legend-line"></span>Runtime import
						<span class="legend-line type-line"></span>Type-only import
					</p>
				</div>
				<div id="module-inspector" class="module-inspector" tabindex="-1">
					<p class="folio">Module inspector</p>
					<label for="module-select"
						>Selected module<select
							id="module-select"
							:value="selected?.file"
							@change="selectModule(($event.target as HTMLSelectElement).value)"
						>
							<option v-for="node in display.nodes" :key="node.file" :value="node.file">
								{{ node.file }}
							</option>
						</select></label
					><template v-if="selected"
						><h4 class="path">{{ selected.file }}</h4>
						<dl class="node-measures">
							<div>
								<dt>Fan-in</dt>
								<dd>{{ selected.fanIn }}</dd>
							</div>
							<div>
								<dt>Fan-out</dt>
								<dd>{{ selected.fanOut }}</dd>
							</div>
							<div>
								<dt>Complexity</dt>
								<dd>{{ selected.complexity }}</dd>
							</div>
							<div>
								<dt>Lines</dt>
								<dd>{{ selected.lines.toLocaleString() }}</dd>
							</div>
						</dl>
						<button class="secondary" @click="$emit('inspect', selected.file)">
							<UiIcon name="scan" />Inspect file findings
						</button>
						<h4>Direct relationships</h4>
						<ul class="neighbor-list">
							<li v-for="(edge, index) in relationships" :key="index">
								<span
									>{{ edge.from === selected.file ? 'Imports' : 'Imported by' }} /
									{{ edge.typeOnly ? 'type' : 'runtime' }}</span
								><code>{{ edge.from === selected.file ? edge.to : edge.from }}</code>
							</li>
						</ul>
						<p v-if="!relationships.length" class="caption">No resolved relationships under this filter.</p>
						<p v-else class="caption">Up to 16 incident relationships shown.</p></template
					>
				</div>
			</div>
			<p v-else class="graph-empty">No modules match this path. Try a shorter search.</p>
		</template>
		<p class="caption panel-note">
			Node size reflects connectivity. Radial placement organizes the view; it does not establish layers or
			causality. Arrows run from importer to dependency. Static imports do not prove feedback loops.
		</p>
	</div>
</template>
