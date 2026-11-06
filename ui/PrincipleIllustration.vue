<!--
@author Stephan Coertzen (coertzen.jfs@gmail.com)
@license Apache-2.0
antislopscan is open-source software. See LICENSE.TXT for license information.
-->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import type { IllustrationFamily } from './principles';
import { backgroundMotion } from './theme';
import consolidationPoster from '../assets/branding/principles/consolidation-poster.png';
import consolidationGif from '../assets/branding/principles/consolidation.gif';
import boundariesPoster from '../assets/branding/principles/boundaries-poster.png';
import boundariesGif from '../assets/branding/principles/boundaries.gif';
import contractsPoster from '../assets/branding/principles/contracts-poster.png';
import contractsGif from '../assets/branding/principles/contracts.gif';
import flowsPoster from '../assets/branding/principles/flows-poster.png';
import flowsGif from '../assets/branding/principles/flows.gif';

const props = defineProps<{ family: IllustrationFamily; animated?: boolean }>();
const assets = {
	consolidation: { poster: consolidationPoster, gif: consolidationGif },
	boundaries: { poster: boundariesPoster, gif: boundariesGif },
	contracts: { poster: contractsPoster, gif: contractsGif },
	flows: { poster: flowsPoster, gif: flowsGif }
};
const preference = matchMedia('(prefers-reduced-motion: reduce)');
const reduced = ref(preference.matches);
const visible = ref(!document.hidden);
const playing = computed(
	/** Animate only an expanded, visible, user-enabled explanation. */ () =>
		Boolean(props.animated && backgroundMotion.value && !reduced.value && visible.value)
);
const source = computed(
	/** Swap to a still poster whenever motion is paused or unnecessary. */ () =>
		assets[props.family][playing.value ? 'gif' : 'poster']
);

/** Follow live OS reduced-motion changes. */
const syncMotion = (): void => {
	reduced.value = preference.matches;
};

/** Pause GIF decoding in hidden tabs by switching to the static poster. */
const syncVisibility = (): void => {
	visible.value = !document.hidden;
};

/** Own listeners for the illustration's mounted lifetime. */
const listen = (): void => {
	preference.addEventListener('change', syncMotion);
	document.addEventListener('visibilitychange', syncVisibility);
};

/** Release listeners when pagination or audit selection removes the illustration. */
const cleanup = (): void => {
	preference.removeEventListener('change', syncMotion);
	document.removeEventListener('visibilitychange', syncVisibility);
};

onMounted(listen);
onUnmounted(cleanup);
</script>
<template>
	<img
		class="principle-illustration"
		:src="source"
		alt=""
		width="256"
		height="256"
		loading="lazy"
		:data-animated="playing"
	/>
</template>
