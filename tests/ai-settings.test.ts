/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { expect, test } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfig, parseConfig } from '../src/config.js';
import { aiCommandOptions } from '../src/ai-settings.js';

/** Verify environment, trusted JSON and explicit CLI precedence without automatic repository dotenv loading. */
const settingsContract = async (): Promise<void> => {
	const directory = await mkdtemp(join(tmpdir(), 'antislopscan-ai-settings-'));
	const keys = [
		'ANTISLOPSCAN_AI_ENABLED',
		'ANTISLOPSCAN_AI_ALLOW_SOURCE_TRANSMISSION',
		'ANTISLOPSCAN_AI_MODEL',
		'ANTISLOPSCAN_AI_MODE'
	];
	const original = new Map(
		keys.map(
			/** Preserve the process's original settings for deterministic teardown. */ (key) => [
				key,
				process.env[key]
			]
		)
	);

	try {
		process.env.ANTISLOPSCAN_AI_ENABLED = 'false';
		process.env.ANTISLOPSCAN_AI_ALLOW_SOURCE_TRANSMISSION = 'true';
		process.env.ANTISLOPSCAN_AI_MODEL = 'deployment-model';
		process.env.ANTISLOPSCAN_AI_MODE = 'architecture';
		const path = join(directory, 'operator.json');

		await writeFile(path, JSON.stringify({ ai: { model: 'file-model', enabled: false } }));
		expect((await loadConfig()).ai.model).toBe('deployment-model');
		expect((await loadConfig(path)).ai.model).toBe('file-model');
		const explicit = aiCommandOptions({
			ai: true,
			'ai-provider': 'ollama',
			'ai-base-url': 'http://localhost:11434',
			'ai-model': 'cli-model',
			'ai-max-source-bytes': '4096'
		});
		const final = await loadConfig(path, 'portable', explicit);

		expect(final.ai.enabled).toBe(true);
		expect(final.ai.model).toBe('cli-model');
		expect(final.ai.maxSourceBytes).toBe(4096);
		expect(final.ai.mode).toBe('architecture');
		expect(parseConfig({ ai: { provider: 'openai' } }).ai.baseUrl).toBe('https://api.openai.com/v1');
		expect(parseConfig({ ai: { provider: 'claude' } }).ai.apiKeyEnv).toBe('ANTHROPIC_API_KEY');
		expect(parseConfig({ project: { name: 'cloud' }, ai: { provider: 'ollama', baseUrl: 'http://local.invalid:11434' }, projects: { cloud: { ai: { provider: 'openai' } } } }).ai.baseUrl).toBe('https://api.openai.com/v1');
		expect((await loadConfig(path, 'full', aiCommandOptions({ 'ai-provider': 'openrouter' }))).ai.baseUrl).toBe('https://openrouter.ai/api/v1');
		expect((await loadConfig(path, 'full', aiCommandOptions({ 'no-ai': true }))).ai.enabled).toBe(false);
		expect(
			/** Reject ambiguous contradictory command flags. */ () => aiCommandOptions({ ai: true, 'no-ai': true })
		).toThrow('cannot be combined');
		process.env.ANTISLOPSCAN_AI_ENABLED = 'yes';
		await expect(loadConfig()).rejects.toThrow('true or false');
	} finally {
		for (const key of keys) {
			const value = original.get(key);

			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
		await rm(directory, { recursive: true, force: true });
	}
};

test('AI settings layer explicit CLI over trusted JSON over deployment environment', settingsContract);
