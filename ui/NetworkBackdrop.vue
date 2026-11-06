<!--
@author Stephan Coertzen (coertzen.jfs@gmail.com)
@license Apache-2.0
antislopscan is open-source software. See LICENSE.TXT for license information.
-->
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import topology from '../assets/branding/intelligence/topology-background.png';
import { backgroundMotion } from './theme';

const visible = ref(!document.hidden);

/** Pause nonessential flow when the document is hidden; no animation drives measured data. */
const syncVisibility = (): void => {
	visible.value = !document.hidden;
};

/** Attach the single visibility listener for this hero's lifetime. */
const listen = (): void => document.addEventListener('visibilitychange', syncVisibility);

/** Release the hero listener when the selected view is removed. */
const cleanup = (): void => document.removeEventListener('visibilitychange', syncVisibility);

onMounted(listen);
onUnmounted(cleanup);
</script>
<template>
	<div class="network-art" :class="{ 'is-paused': !backgroundMotion || !visible }" aria-hidden="true">
		<img :src="topology" alt="" width="1774" height="887" fetchpriority="high" />
		<svg viewBox="0 0 1000 420" focusable="false">
			<path class="flow-line" d="M200 350C420 340 370 80 650 160S850 320 990 90" />
			<path class="flow-line second" d="M340 390C440 170 590 340 720 170S860 200 1000 240" />
			<path class="flow-line third" d="M150 160C450 70 380 290 620 250S850 120 990 350" />
		</svg>
	</div>
</template>
