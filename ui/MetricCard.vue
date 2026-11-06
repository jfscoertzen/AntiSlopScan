<!--
@author Stephan Coertzen (coertzen.jfs@gmail.com)
@license Apache-2.0
antislopscan is open-source software. See LICENSE.TXT for license information.
-->
<script setup lang="ts">
import UiIcon from './UiIcon.vue';
import type { IconName } from './icons';
defineProps<{ label: string; value: string | number; description: string; icon: IconName; tone?: string }>();
</script>
<template>
	<div class="metric-card" :class="tone">
		<div class="metric-top">
			<span>{{ label }}</span
			><span class="metric-icon"><UiIcon :name="icon" /></span>
		</div>
		<strong>{{ value }}</strong>
		<p>{{ description }}</p>
	</div>
</template>
