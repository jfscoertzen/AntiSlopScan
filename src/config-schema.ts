/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { categories } from './domain.js';

/** Construct a bounded integer schema with an appliance default. */
const integer = (minimum: number, maximum: number, defaultValue: number) => ({ type: 'integer', minimum, maximum, default: defaultValue });


/** Construct a boolean schema with a default value. */
const boolean = (defaultValue: boolean) => ({ type: 'boolean', default: defaultValue });


/** Construct an exact object schema; unknown options are always rejected. */
const object = (properties: Record<string, unknown>) => ({ type: 'object', additionalProperties: false, default: {}, properties });

const stringList = { type: 'array', maxItems: 500, items: { type: 'string', minLength: 1, maxLength: 1000 }, uniqueItems: true, default: [] };
const severity = { enum: ['critical', 'major', 'minor', 'info'] };
const scannerBase = { enabled: boolean(true), severity, timeoutSeconds: integer(1, 3600, 120) };
const scanners: Record<string, unknown> = {};

for (const id of ['slopscore', 'eslint', 'oxlint', 'oxlintAntiSlop', 'rustAntiSlop', 'jscpd', 'knip', 'dependencyCruiser', 'semgrep', 'gitleaks', 'typescript', 'radon', 'ruff', 'clippy', 'pmd', 'checkstyle', 'clangTidy', 'sonarqube']) {
	const properties: Record<string, unknown> = { ...scannerBase };

	if (id === 'eslint') properties.configMode = { const: 'appliance', default: 'appliance' };
	if (id === 'oxlintAntiSlop') properties.profile = { enum: ['generic', 'effect'], default: 'generic' };
	if (id === 'rustAntiSlop') properties.profile = { const: 'antislop-standard', default: 'antislop-standard' };
	if (id === 'jscpd') properties.threshold = integer(0, 100, 5);
	if (['knip', 'typescript', 'clippy', 'pmd', 'checkstyle', 'clangTidy', 'sonarqube'].includes(id)) properties.enabled = boolean(false);

	scanners[id] = object(properties);
}

const weightProperties: Record<string, unknown> = {};
const defaultWeights = [20, 15, 20, 20, 10, 10, 5];

for (const [index, category] of categories.entries()) weightProperties[category] = integer(0, 1000, defaultWeights[index]);

const settings = {
	version: { const: '1.0', default: '1.0' },
	project: object({ name: { type: 'string', minLength: 1, maxLength: 200, default: 'Repository' }, source: { type: 'string', minLength: 1, maxLength: 4096, default: '/workspace' }, type: { enum: ['auto', 'application', 'library', 'service'], default: 'auto' }, languages: { ...stringList, default: ['auto'], items: { enum: ['auto', 'javascript', 'typescript', 'python', 'rust', 'go', 'java', 'cpp', 'csharp', 'ruby', 'php'] } } }),
	audit: object({ mode: { enum: ['full', 'quick'], default: 'full' }, parallelScanners: integer(1, 8, 4), timeoutSeconds: integer(1, 7200, 600), failOnScannerError: boolean(true), exclude: { ...stringList, default: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**', '**/vendor/**', '**/artifacts/**', '**/*.min.js'] }, maxFiles: integer(1, 50000, 10000), maxFileBytes: integer(1024, 10485760, 1048576), maxRepositoryBytes: integer(1024, 1073741824, 104857600), maxEntries: integer(1, 200000, 100000), scannerMemoryMb: integer(128, 2048, 512), maxOutputBytes: integer(1024, 52428800, 10485760) }),
	scanners: object(scanners),
	analysis: object({ codeQuality: boolean(true), architecture: boolean(true), systemsThinking: boolean(true), security: boolean(true), maintainability: boolean(true), technicalDebt: boolean(true), architecturalErosion: boolean(true) }),
	architecture: object({
		boundaries: { type: 'array', default: [], maxItems: 100, items: { ...object({ from: { type: 'string', minLength: 1, maxLength: 500 }, disallow: stringList, reason: { type: 'string', minLength: 1, maxLength: 1000 } }), required: ['from', 'disallow', 'reason'] } },
		requirements: { type: 'array', default: [], maxItems: 100, items: { ...object({ id: { type: 'string', pattern: '^[A-Za-z0-9_.-]+$', maxLength: 100 }, description: { type: 'string', minLength: 1, maxLength: 2000 }, files: stringList, capability: { enum: ['timeout', 'boundedQueue', 'idempotency'] } }), required: ['id', 'description', 'files', 'capability'] } },
		documents: stringList, maxModuleLines: integer(100, 5000, 500), maxComplexity: integer(2, 100, 20), maxFanOut: integer(2, 100, 15),
	}),
	rules: object({ exclude: stringList, severity: { type: 'object', default: {}, maxProperties: 500, additionalProperties: severity }, weights: { type: 'object', default: {}, maxProperties: 500, additionalProperties: { type: 'number', minimum: 0, maximum: 10 } } }),
	scoring: object({ range: { type: 'array', minItems: 2, maxItems: 2, items: [{ const: 0 }, { const: 100 }], default: [0, 100] }, higherIsBetter: { const: true, default: true }, weights: object(weightProperties), minimumOverallScore: integer(0, 100, 75), minimumCategoryScore: integer(0, 100, 60) }),
	ai: object({ enabled: boolean(false), provider: { enum: ['openai-compatible', 'ollama', 'openai', 'claude', 'openrouter'], default: 'openai-compatible' }, baseUrl: { type: 'string', minLength: 1, maxLength: 2048, default: 'http://host.docker.internal:11434/v1' }, model: { type: 'string', minLength: 1, maxLength: 200, default: 'configured-model' }, apiKeyEnv: { type: 'string', pattern: '^[A-Z_][A-Z0-9_]*$', default: 'AUDIT_AI_API_KEY' }, allowSourceTransmission: boolean(false), timeoutSeconds: integer(1, 300, 60), maxSourceBytes: integer(1024, 262144, 32768), mode: { enum: ['advisory', 'architecture'], default: 'advisory' }, maxFiles: integer(1, 100, 24), maxTokens: integer(256, 32768, 8192), batchSize: integer(1, 14, 14) }),
	reports: object({ formats: { type: 'array', minItems: 1, maxItems: 4, uniqueItems: true, items: { enum: ['html', 'pdf', 'json', 'sarif'] }, default: ['html', 'pdf', 'json', 'sarif'] }, outputDirectory: { type: 'string', minLength: 1, maxLength: 4096, default: '/reports' }, includeSourceSnippets: boolean(false), includeDependencyGraphs: boolean(true), includeRecommendations: boolean(true), includeExecutiveSummary: boolean(true) }),
	ci: object({ enabled: boolean(true), failBelowScore: integer(0, 100, 75), failOnCritical: boolean(true), failOnNewHighSeverityFindings: boolean(false), baseline: { type: 'string', minLength: 1, maxLength: 4096 }, minimumCoverage: integer(0, 100, 80), exitCodes: object({ quality: integer(1, 125, 1), scanner: integer(1, 125, 2), configuration: integer(1, 125, 3) }) }),
};

export const configSchema = {
	$schema: 'http://json-schema.org/draft-07/schema#',
	$id: 'https://antislopscan.local/schemas/audit-config.schema.json',
	title: 'antislopscan audit configuration',
	...object({ ...settings, $schema: { type: 'string' }, projects: { type: 'object', maxProperties: 100, additionalProperties: object(settings) } }),
};
