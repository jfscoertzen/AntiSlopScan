/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { record, array, string } from '../scanners/normalize.js';
import type { Config } from '../domain.js';

const MAX_RESPONSE_BYTES = 524288;

/** Execute a bounded provider-native request; never retry, redirect, log credentials, or invoke tools from source. */
export const requestAi = async (
	settings: Config['ai'],
	system: string,
	input: unknown,
	signal: AbortSignal,
	schema?: Record<string, unknown>
): Promise<unknown> => {
	const base = settings.baseUrl.replace(/\/$/, '');
	const key = process.env[settings.apiKeyEnv];
	const headers: Record<string, string> = { 'content-type': 'application/json' };
	const user = JSON.stringify(input);
	let endpoint: string;
	let body: Record<string, unknown>;

	if (['openai', 'claude', 'openrouter'].includes(settings.provider) && !key)
		throw new Error('AI credential environment variable is not set');
	if (settings.provider === 'ollama') {
		endpoint = `${base.replace(/\/v1$/, '')}/api/chat`;
		body = {
			model: settings.model,
			stream: false,
			think: false,
			format: schema ?? 'json',
			options: { temperature: 0, num_predict: settings.maxTokens, num_ctx: 32768 },
			messages: [
				{ role: 'system', content: system },
				{ role: 'user', content: user }
			]
		};
		if (key) headers.authorization = `Bearer ${key}`;
	} else if (settings.provider === 'claude') {
		endpoint = `${base}/messages`;
		headers['x-api-key'] = key!;
		headers['anthropic-version'] = '2026-10-21';
		body = {
			model: settings.model,
			max_tokens: settings.maxTokens,
			system,
			messages: [{ role: 'user', content: user }]
		};
	} else {
		endpoint = `${base}/chat/completions`;
		if (key) headers.authorization = `Bearer ${key}`;
		body = {
			model: settings.model,
			messages: [
				{ role: 'system', content: system },
				{ role: 'user', content: user }
			],
			...(settings.provider === 'openai'
				? { max_completion_tokens: settings.maxTokens }
				: { max_tokens: settings.maxTokens }),
			...(['openai', 'openrouter'].includes(settings.provider)
				? { response_format: { type: 'json_object' } }
				: {})
		};
	}
	const response = await fetch(endpoint, {
		method: 'POST',
		headers,
		body: JSON.stringify(body),
		redirect: 'error',
		signal: AbortSignal.any([signal, AbortSignal.timeout(settings.timeoutSeconds * 1000)])
	});

	if (!response.ok || !response.body) {
		await response.body?.cancel();
		throw new Error(`AI provider returned HTTP ${response.status}`);
	}
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;

	try {
		while (true) {
			const chunk = await reader.read();

			if (chunk.done) break;
			size += chunk.value.length;
			if (size > MAX_RESPONSE_BYTES) {
				await reader.cancel();
				throw new Error('AI response exceeded the response bound');
			}
			chunks.push(chunk.value);
		}
	} finally {
		reader.releaseLock();
	}
	const envelope = record(JSON.parse(Buffer.concat(chunks).toString('utf8')));
	let content: string;

	if (settings.provider === 'ollama') {
		if (envelope.done === false || envelope.done_reason === 'length')
			throw new Error('AI response was truncated');
		content = string(record(envelope.message).content);
	} else if (settings.provider === 'claude') {
		if (envelope.stop_reason === 'max_tokens') throw new Error('AI response was truncated');
		content = array(envelope.content)
			.map(
				/** Read only text blocks, excluding reasoning or tool requests. */ (block) => {
					const item = record(block);
					return item.type === 'text' ? string(item.text) : '';
				}
			)
			.join('');
	} else {
		const choice = record(array(envelope.choices)[0]);

		if (choice.finish_reason === 'length') throw new Error('AI response was truncated');
		content = string(record(choice.message).content);
	}
	return JSON.parse(content.trim().replace(/^\x60\x60\x60(?:json)?\s*\n([\s\S]*?)\n\x60\x60\x60$/i, '$1'));
};
