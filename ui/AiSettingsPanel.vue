<!--
@author Stephan Coertzen (coertzen.jfs@gmail.com)
@license Apache-2.0
antislopscan is open-source software. See LICENSE.TXT for license information.
-->
<script setup lang="ts">
import { computed, ref } from 'vue';
import UiIcon from './UiIcon.vue';
import type { Config } from '../src/domain';

export interface AiPolicy {
	allowed: boolean;
	provider?: string;
	baseUrl?: string;
	apiKeyEnv?: string;
}
const props = defineProps<{ configuration: string; policy?: AiPolicy }>();
const emit = defineEmits<{ 'update:configuration': [value: string] }>();
const error = ref('');
const parsed = computed(
	/** Read canonical editor JSON without replacing malformed user input. */ () => {
		try {
			const value = JSON.parse(props.configuration);
			return value && typeof value === 'object' && !Array.isArray(value)
				? (value as { ai?: Partial<Config['ai']> })
				: undefined;
		} catch {
			return undefined;
		}
	}
);
const ai = computed(
	/** Present the same AI settings that will be submitted in the audit JSON. */ () => parsed.value?.ai ?? {}
);

/** Update one JSON setting, preserving every other user-provided field and reporting invalid editor content. */
const update = (field: string, value: string | number | boolean): void => {
	if (!parsed.value) {
		error.value = 'Fix the JSON configuration before editing provider settings.';
		return;
	}
	const next = { ...parsed.value, ai: { ...ai.value, [field]: value } };

	error.value = '';
	emit('update:configuration', JSON.stringify(next, null, 2));
};

/** Extract typed values from labeled native controls. */
const change = (event: Event, field: string, numeric = false): void => {
	const input = event.target as HTMLInputElement;

	update(field, input.type === 'checkbox' ? input.checked : numeric ? Number(input.value) : input.value);
};
</script>
<template>
	<details class="ai-settings disclosure">
		<summary>
			<UiIcon name="workflow" /> LLM architecture assessment
			<span class="caption">{{ ai.enabled ? 'Enabled' : 'Optional' }}</span>
		</summary>
		<div class="disclosure-body">
			<p class="caption">
				Score evidence-backed principles with a separately labeled LLM score. Static scores and CI thresholds
				remain independent.
			</p>
			<p v-if="!policy?.allowed" class="ai-policy-note">
				The appliance operator must enable an approved provider with CLI or environment settings before source
				can be sent. See the LLM setup documentation.
			</p>
			<label class="checkbox-control"
				><input
					type="checkbox"
					:checked="ai.enabled ?? false"
					:disabled="!policy?.allowed || !parsed"
					@change="change($event, 'enabled')"
				/>Enable LLM architecture assessment</label
			>
			<div class="ai-settings-grid">
				<label for="ai-provider"
					>LLM provider<select
						id="ai-provider"
						:value="ai.provider ?? 'openai-compatible'"
						:disabled="!parsed || Boolean(policy?.provider)"
						@change="change($event, 'provider')"
					>
						<option value="ollama">Ollama</option>
						<option value="openai">OpenAI</option>
						<option value="claude">Claude (Anthropic)</option>
						<option value="openrouter">OpenRouter</option>
						<option value="openai-compatible">OpenAI-compatible</option>
					</select></label
				>
				<label for="ai-model"
					>LLM model<input
						id="ai-model"
						:value="ai.model"
						:disabled="!parsed"
						placeholder="Provider model identifier"
						@change="change($event, 'model')"
				/></label>
				<label for="ai-url"
					>LLM base URL<input
						id="ai-url"
						:value="ai.baseUrl"
						:readonly="Boolean(policy?.baseUrl)"
						:disabled="!parsed"
						@change="change($event, 'baseUrl')"
				/></label>
				<label for="ai-key-env"
					>API key environment variable<input
						id="ai-key-env"
						:value="ai.apiKeyEnv"
						:readonly="Boolean(policy?.apiKeyEnv)"
						:disabled="!parsed"
						@change="change($event, 'apiKeyEnv')"
				/></label>
				<label for="ai-mode"
					>LLM review mode<select
						id="ai-mode"
						:value="ai.mode ?? 'architecture'"
						:disabled="!parsed"
						@change="change($event, 'mode')"
					>
						<option value="architecture">Principle assessment and scoring</option>
						<option value="advisory">Advisory observations only</option>
					</select></label
				>
				<label for="ai-budget"
					>Maximum source sample bytes<input
						id="ai-budget"
						:value="ai.maxSourceBytes ?? 32768"
						type="number"
						min="1024"
						max="262144"
						:disabled="!parsed"
						@change="change($event, 'maxSourceBytes', true)"
				/></label>
				<label for="ai-file-budget"
					>Maximum sampled files<input
						id="ai-file-budget"
						:value="ai.maxFiles ?? 24"
						type="number"
						min="1"
						max="100"
						:disabled="!parsed"
						@change="change($event, 'maxFiles', true)"
				/></label>
				<label for="ai-timeout"
					>Provider timeout per batch (seconds)<input
						id="ai-timeout"
						:value="ai.timeoutSeconds ?? 60"
						type="number"
						min="1"
						max="300"
						:disabled="!parsed"
						@change="change($event, 'timeoutSeconds', true)"
				/></label>
			</div>
			<label class="checkbox-control source-consent"
				><input
					type="checkbox"
					:checked="ai.allowSourceTransmission ?? false"
					:disabled="!parsed"
					@change="change($event, 'allowSourceTransmission')"
				/>Allow sending redacted source samples to this provider</label
			>
			<p class="caption">
				Provider, endpoint and credential variable are pinned by the operator. API keys stay in server
				environment variables. Sampling limits and model choice can be adjusted for each audit. Disabling AI
				keeps core analysis available offline.
			</p>
			<p v-if="!parsed || error" class="error" role="alert">
				{{ error || 'Fix the JSON configuration before editing provider settings.' }}
			</p>
		</div>
	</details>
</template>
