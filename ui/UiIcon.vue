<!--
@author Stephan Coertzen (coertzen.jfs@gmail.com)
@license Apache-2.0
antislopscan is open-source software. See LICENSE.TXT for license information.
-->
<script setup lang="ts">
import { iconPaths, type IconName } from './icons';
defineProps<{ name: IconName }>();
</script>
<template>
	<svg
		class="icon"
		width="20"
		height="20"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="1.7"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
		focusable="false"
	>
		<path v-for="(path, index) in iconPaths[name]" :key="index" :d="path" />
	</svg>
</template>
