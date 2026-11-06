<!--
@author Stephan Coertzen (coertzen.jfs@gmail.com)
@license Apache-2.0
antislopscan is open-source software. See LICENSE.TXT for license information.
-->
<script setup lang="ts">
defineProps<{ score: number | null; label?: string }>();
</script>
<template>
	<div
		class="score-gauge"
		role="img"
		:aria-label="`${label ?? 'Overall quality'}: ${score === null ? 'not assessed' : `${score} out of 100, higher is better`}`"
	>
		<svg viewBox="0 0 220 220" aria-hidden="true">
			<circle class="gauge-halo" cx="110" cy="110" r="104" />
			<circle class="gauge-track" cx="110" cy="110" r="91" />
			<circle
				class="gauge-value"
				cx="110"
				cy="110"
				r="91"
				pathLength="100"
				:stroke-dasharray="`${score ?? 0} 100`"
				transform="rotate(-90 110 110)"
			/>
		</svg>
		<div class="gauge-reading">
			<strong>{{ score ?? 'N/A' }}</strong
			><span>{{ score === null ? 'Not assessed' : '/ 100' }}</span>
		</div>
	</div>
</template>
