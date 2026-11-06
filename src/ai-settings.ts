/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { environmentSetting } from './environment.js';
import type { Config } from './domain.js';

const providerDefaults: Record<Config['ai']['provider'], { baseUrl: string; apiKeyEnv: string }> = {
	ollama: { baseUrl: 'http://host.docker.internal:11434', apiKeyEnv: 'AUDIT_AI_API_KEY' },
	openai: { baseUrl: 'https://api.openai.com/v1', apiKeyEnv: 'OPENAI_API_KEY' },
	claude: { baseUrl: 'https://api.anthropic.com/v1', apiKeyEnv: 'ANTHROPIC_API_KEY' },
	openrouter: { baseUrl: 'https://openrouter.ai/api/v1', apiKeyEnv: 'OPENROUTER_API_KEY' },
	'openai-compatible': { baseUrl: 'http://host.docker.internal:11434/v1', apiKeyEnv: 'AUDIT_AI_API_KEY' }
};


/** Apply endpoint/key-variable presets within each explicit provider layer, preserving deliberate overrides. */
export const aiWithProviderDefaults = (settings: Partial<Config['ai']>): Partial<Config['ai']> => {
	const preset = settings.provider && Object.hasOwn(providerDefaults, settings.provider) ? providerDefaults[settings.provider] : {};

	return { ...preset, ...settings };
};

/** Read only named deployment AI settings; keys remain environment references, never configuration values. */
export const aiEnvironment = (): Partial<Config['ai']> => {
	const result: Record<string, unknown> = {};
	const fields = {
		ENABLED: 'enabled',
		PROVIDER: 'provider',
		BASE_URL: 'baseUrl',
		MODEL: 'model',
		API_KEY_ENV: 'apiKeyEnv',
		ALLOW_SOURCE_TRANSMISSION: 'allowSourceTransmission',
		TIMEOUT_SECONDS: 'timeoutSeconds',
		MAX_SOURCE_BYTES: 'maxSourceBytes',
		MODE: 'mode',
		MAX_FILES: 'maxFiles',
		MAX_TOKENS: 'maxTokens',
		BATCH_SIZE: 'batchSize'
	};

	for (const [suffix, field] of Object.entries(fields)) {
		const value = environmentSetting(`AI_${suffix}`);

		if (value === undefined || value === '') continue;
		if (['enabled', 'allowSourceTransmission'].includes(field)) {
			if (!['true', 'false'].includes(value)) throw new Error(`AI_${suffix} must be true or false`);
			result[field] = value === 'true';
		} else if (['timeoutSeconds', 'maxSourceBytes', 'maxFiles', 'maxTokens', 'batchSize'].includes(field)) {
			result[field] = Number(value);
		} else result[field] = value;
	}
	return result as Partial<Config['ai']>;
};

/** Translate explicit CLI flags after file/environment settings; JSON Schema validates the final values. */
export const aiCommandOptions = (
	values: Record<string, string | boolean | undefined>
): Partial<Config['ai']> => {
	const result: Record<string, unknown> = {};
	const fields = {
		'ai-provider': 'provider',
		'ai-base-url': 'baseUrl',
		'ai-model': 'model',
		'ai-api-key-env': 'apiKeyEnv',
		'ai-mode': 'mode',
		'ai-max-source-bytes': 'maxSourceBytes',
		'ai-timeout-seconds': 'timeoutSeconds'
	};

	if (values.ai && values['no-ai']) throw new Error('--ai and --no-ai cannot be combined');
	if (values.ai) Object.assign(result, { enabled: true, mode: 'architecture' });
	if (values['no-ai']) result.enabled = false;
	if (values['allow-source-transmission']) result.allowSourceTransmission = true;
	for (const [flag, field] of Object.entries(fields)) {
		if (values[flag] !== undefined)
			result[field] = ['maxSourceBytes', 'timeoutSeconds'].includes(field)
				? Number(values[flag])
				: values[flag];
	}
	return result as Partial<Config['ai']>;
};
