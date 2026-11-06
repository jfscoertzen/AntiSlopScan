/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Ajv } from 'ajv';
import { configSchema } from './config-schema.js';
import { scannerCatalog } from './scanners/catalog.js';
import type { Config } from './domain.js';
import { aiEnvironment, aiWithProviderDefaults } from './ai-settings.js';

export type AuditProfile = 'full' | 'portable';
const portablePolicy = {
	scanners: { rustAntiSlop: { enabled: false }, semgrep: { enabled: false }, gitleaks: { enabled: false }, radon: { enabled: false }, ruff: { enabled: false } },
	reports: { formats: ['html', 'json', 'sarif'] },
};

const strictValidator = new Ajv({ allErrors: true, strict: false }).compile(configSchema);
const defaultValidator = new Ajv({ allErrors: true, strict: false, useDefaults: true }).compile(configSchema);

/** Return true for a plain configuration object; arrays and null are excluded. */
const isObject = (input: unknown): input is Record<string, unknown> => input !== null && typeof input === 'object' && !Array.isArray(input);


/** Reject prototype keys at every depth before merging untrusted JSON. */
const checkKeys = (input: unknown, depth = 0): void => {
	if (depth > 30) throw new Error('Configuration nesting exceeds 30 levels');
	if (input === null || typeof input !== 'object') return;

	for (const [key, value] of Object.entries(input)) {
		if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error(`Forbidden configuration key: ${key}`);
		checkKeys(value, depth + 1);
	}
};


/** Merge validated configuration objects; arrays and scalar values replace defaults. */
export const mergeConfig = (base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> => {
	const result = structuredClone(base);

	for (const [key, value] of Object.entries(override)) {
		result[key] = isObject(value) && isObject(result[key]) ? mergeConfig(result[key], value) : structuredClone(value);
	}

	return result;
};


/** Validate JSON, layer the selected profile before explicit settings/project overrides, and populate defaults; reject unsupported options. */
export const parseConfig = (input: unknown, profile: AuditProfile = 'full'): Config => {
	checkKeys(input);
	if (!strictValidator(input)) throw new Error(`Invalid configuration: ${new Ajv().errorsText(strictValidator.errors)}`);

	const supplied = structuredClone(input) as Record<string, unknown>;
	const original = profile === 'portable' ? mergeConfig(portablePolicy, supplied) : supplied;
	const project = isObject(original.project) ? original.project : {};
	const projects = isObject(original.projects) ? original.projects : {};
	const override = typeof project.name === 'string' ? projects[project.name] : undefined;
	if (isObject(original.ai)) original.ai = aiWithProviderDefaults(original.ai as Partial<Config['ai']>);
	if (isObject(override) && isObject(override.ai)) override.ai = aiWithProviderDefaults(override.ai as Partial<Config['ai']>);
	const merged = isObject(override) ? mergeConfig(original, override) : original;

	delete merged.projects;
	delete merged.$schema;
	if (isObject(merged.ai)) merged.ai = aiWithProviderDefaults(merged.ai as Partial<Config['ai']>);
	if (!defaultValidator(merged)) throw new Error(`Invalid effective configuration: ${new Ajv().errorsText(defaultValidator.errors)}`);

	const config = merged as unknown as Config;
	const totalWeight = Object.values(config.scoring.weights).reduce(sumNumbers, 0);

	if (totalWeight <= 0) throw new Error('At least one scoring weight must be positive');
	if (config.ai.enabled && !config.ai.allowSourceTransmission) throw new Error('AI requires explicit allowSourceTransmission=true');
	if (config.ai.enabled) {
		if (config.ai.model === 'configured-model') throw new Error('AI model must be explicitly configured');
		const url = new URL(config.ai.baseUrl);

		if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('AI baseUrl must be an HTTP(S) URL without credentials, query, or fragment');
	}

	if (new Set(Object.values(config.ci.exitCodes)).size !== 3) throw new Error('CI exit codes must be distinct');
	return config;
};


/** Sum configuration weights without introducing mutable accumulator state. */
const sumNumbers = (total: number, value: number): number => total + value;


/** Layer deployment AI defaults, trusted JSON capped at 1 MiB, and explicit CLI overrides; validate before use. */
export const loadConfig = async (path?: string, profile: AuditProfile = 'full', aiOverrides: Partial<Config['ai']> = {}): Promise<Config> => {
	let supplied: Record<string, unknown> = {};
	if (path) {
		const content = await readFile(path, 'utf8');

		if (Buffer.byteLength(content) > 1048576) throw new Error('Configuration exceeds 1 MiB');
		supplied = JSON.parse(content);
	}
	checkKeys(supplied);
	if (!strictValidator(supplied)) throw new Error('Invalid supplied JSON configuration');
	if (isObject(supplied.ai)) supplied.ai = aiWithProviderDefaults(supplied.ai as Partial<Config['ai']>);
	const merged = mergeConfig({ ai: aiWithProviderDefaults(aiEnvironment()) }, supplied);

	return parseConfig(mergeConfig(merged, { ai: aiWithProviderDefaults(aiOverrides) }), profile);
};


/** Hash the analysis policy, excluding presentation, paths, and CI thresholds for baseline compatibility. */
export const configurationHash = (config: Config, applianceVersion: string): string => {
	const tools: Record<string, string> = {};

	for (const scanner of scannerCatalog) tools[scanner.id] = scanner.version;
	const policy = { version: config.version, applianceVersion, commentPolicy: 'code-only-v1', mode: config.audit.mode, projectType: config.project.type, scanners: config.scanners, analysis: config.analysis, architecture: config.architecture, rules: config.rules, scoring: config.scoring.weights, languages: config.project.languages, exclude: config.audit.exclude, tools };

	return createHash('sha256').update(JSON.stringify(policy)).digest('hex');
};
