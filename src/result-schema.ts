/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { Ajv } from 'ajv';
import { categories, type AuditResult } from './domain.js';
import { aiPrincipleSchema } from './ai/assessment.js';

const text = { type: 'string', maxLength: 20000 };
const nonnegative = { type: 'number', minimum: 0 };
const score = { type: ['number', 'null'], minimum: 0, maximum: 100 };
const strings = { type: 'array', items: text };
const finding = {
	type: 'object', additionalProperties: false,
	required: ['id', 'ruleId', 'scanner', 'category', 'severity', 'assessment', 'method', 'confidence', 'file', 'line', 'column', 'message', 'evidence', 'recommendation', 'principles', 'fingerprint', 'sources'],
	properties: {
		id: text, ruleId: text, scanner: text, category: { enum: categories }, severity: { enum: ['critical', 'major', 'minor', 'info'] },
		assessment: { enum: ['verified_violation', 'strong_evidence', 'potential_risk', 'informational', 'not_assessable', 'not_applicable'] }, method: { enum: ['deterministic', 'heuristic', 'ai_assisted'] },
		confidence: { type: 'number', minimum: 0, maximum: 1 }, file: { type: 'string', minLength: 1, maxLength: 4096, pattern: '^(?!/)(?!.*(?:^|/)\\.\\.(?:/|$)).+$' },
		line: { type: 'integer', minimum: 1 }, column: { type: 'integer', minimum: 1 }, message: text, evidence: text, recommendation: text, principles: strings, sources: strings, fingerprint: { type: 'string', pattern: '^[a-f0-9]{64}$' }, snippet: text,
	},
};

export const resultSchema = {
	$schema: 'http://json-schema.org/draft-07/schema#', $id: 'https://antislopscan.local/schemas/audit-result.schema.json', title: 'antislopscan canonical audit result',
	type: 'object', additionalProperties: false,
	required: ['schemaVersion', 'applianceVersion', 'id', 'startedAt', 'completedAt', 'project', 'configurationHash', 'inventory', 'scanners', 'findings', 'graph', 'principles', 'erosion', 'scores', 'ci', 'reports', 'limitations'],
	properties: {
		schemaVersion: { const: '1.0' }, applianceVersion: text, id: text, startedAt: text, completedAt: text,
		project: { type: 'object', required: ['name', 'source', 'identity'], properties: { name: text, source: text, identity: text } }, configurationHash: { type: 'string', pattern: '^[a-f0-9]{64}$' },
		inventory: { type: 'object', required: ['files', 'languages', 'totalBytes', 'totalLines', 'dependencies', 'documents'], properties: { files: { type: 'array', maxItems: 50000, items: { type: 'object', required: ['path', 'language', 'bytes', 'lines', 'hash'], properties: { path: text, language: text, bytes: nonnegative, lines: nonnegative, hash: text } } }, languages: strings, dependencies: strings, documents: { type: 'array' }, totalBytes: nonnegative, totalLines: nonnegative } },
		scanners: { type: 'array', maxItems: 30, items: { type: 'object', additionalProperties: false, required: ['id', 'name', 'version', 'status', 'durationMs', 'findings', 'analyzedFiles'], properties: { id: text, name: text, version: text, status: { enum: ['completed', 'failed', 'timed_out', 'skipped', 'unavailable', 'unsupported'] }, durationMs: nonnegative, analyzedFiles: nonnegative, findings: { type: 'array', items: finding }, message: text } } },
		findings: { type: 'array', maxItems: 100000, items: finding },
		aiArchitecture: { type: 'object', additionalProperties: false, required: ['status', 'provider', 'model', 'baseUrl', 'rubricVersion', 'completedAt', 'score', 'assessedPrinciples', 'requestedPrinciples', 'sampledFiles', 'totalFiles', 'sampledBytes', 'totalSourceBytes', 'sampledDocuments', 'formula', 'limitations', 'principles', 'errors'], properties: { status: { enum: ['completed', 'partial'] }, provider: { enum: ['ollama', 'openai', 'claude', 'openrouter', 'openai-compatible'] }, model: text, baseUrl: text, rubricVersion: { const: '1.0' }, completedAt: text, score, assessedPrinciples: nonnegative, requestedPrinciples: nonnegative, sampledFiles: nonnegative, totalFiles: nonnegative, sampledBytes: nonnegative, totalSourceBytes: nonnegative, sampledDocuments: nonnegative, formula: text, limitations: strings, principles: { type: 'array', maxItems: 100, items: aiPrincipleSchema }, errors: strings } },
		graph: { type: 'object', required: ['nodes', 'edges', 'cycles', 'unresolvedImports'], properties: { nodes: { type: 'array', items: { type: 'object', required: ['file', 'fanIn', 'fanOut', 'lines', 'complexity'], properties: { file: text, fanIn: nonnegative, fanOut: nonnegative, lines: nonnegative, complexity: nonnegative } } }, edges: { type: 'array', items: { type: 'object', required: ['from', 'to', 'line', 'typeOnly'], properties: { from: text, to: text, line: nonnegative, typeOnly: { type: 'boolean' } } } }, cycles: { type: 'array', items: strings }, unresolvedImports: nonnegative } },
		principles: { type: 'array', items: { type: 'object', required: ['id', 'name', 'description', 'languages', 'methodology', 'requiredEvidence', 'severity', 'confidence', 'scoreImpact', 'recommendation', 'falsePositives', 'assessment', 'findings'], properties: { id: text, name: text, description: text, languages: strings, methodology: text, requiredEvidence: text, severity: text, confidence: { type: 'number', minimum: 0, maximum: 1 }, scoreImpact: text, recommendation: text, falsePositives: text, assessment: text, findings: strings } } },
		erosion: { type: 'object', required: ['basis', 'score', 'comparable', 'explanation', 'measurements', 'deltas'], properties: { basis: { enum: ['current_structural_risk', 'historical_comparison'] }, score, comparable: { type: 'boolean' }, baselineId: text, explanation: text, measurements: { type: 'object', additionalProperties: { type: 'number' } }, deltas: { type: 'object', additionalProperties: { type: 'number' } } } },
		scores: { type: 'object', required: ['overall', 'categories', 'coverage', 'confidence', 'formula', 'penalties'], properties: { overall: score, categories: { type: 'object', required: categories, additionalProperties: score }, coverage: score, confidence: score, formula: text, penalties: { type: 'object', required: categories, additionalProperties: nonnegative } } },
		ci: { type: 'object', required: ['passed', 'exitCode', 'reasons', 'newHighSeverity'], properties: { passed: { type: 'boolean' }, exitCode: { type: 'integer', minimum: 0, maximum: 125 }, reasons: strings, newHighSeverity: { type: ['integer', 'null'], minimum: 0 } } },
		reports: { type: 'array', items: { type: 'object', required: ['format', 'status'], properties: { format: { enum: ['html', 'pdf', 'json', 'sarif'] }, status: { enum: ['completed', 'failed'] }, file: text, message: text } } }, limitations: strings,
	},
};

const validator = new Ajv({ allErrors: true, strict: false }).compile(resultSchema);

/** Validate canonical JSON before publishing or using a baseline; reject malformed data with useful schema context. */
export function assertAuditResult(input: unknown): asserts input is AuditResult {
	if (!validator(input)) throw new Error(`Invalid audit result: ${new Ajv().errorsText(validator.errors)}`);
}
