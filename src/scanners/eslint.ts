/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { Linter } from 'eslint';
import * as parser from '@typescript-eslint/parser';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { canonicalRule, makeFinding } from '../findings.js';
import { analysisSource } from '../analysis/source.js';
import type { AuditContext, Finding } from '../domain.js';

/** Lint source text with bundled rules; never search for repository configuration or plugins. */
export const executeEslint = async (context: AuditContext): Promise<{ findings: Finding[]; analyzedFiles: number }> => {
	const linter = new Linter({ configType: 'flat' });
	const findings: Finding[] = [];
	let analyzedFiles = 0;

	for (const file of context.inventory.files) {
		if (!['javascript', 'typescript'].includes(file.language)) continue;
		const content = await readFile(join(context.codeSnapshot ?? context.snapshot, file.path), 'utf8');
		const messages = linter.verify(analysisSource(file.path, content), {
			files: ['**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}'],
			languageOptions: { parser, ecmaVersion: 'latest', sourceType: /\.c[jt]s$/.test(file.path) ? 'commonjs' : 'module', parserOptions: { project: false, ecmaFeatures: { jsx: true } } },
			rules: {
				complexity: ['warn', context.config.architecture.maxComplexity], 'no-eval': 'error', 'no-implied-eval': 'error',
				'no-new-func': 'error', 'no-empty': ['error', { allowEmptyCatch: true }], 'no-async-promise-executor': 'error', 'no-unreachable': 'error',
				'no-constant-condition': 'warn', 'no-dupe-args': 'error', 'no-dupe-else-if': 'error', 'no-unsafe-finally': 'error',
				'no-promise-executor-return': 'error', 'no-unsafe-optional-chaining': 'error', 'no-self-assign': 'error',
				'valid-typeof': 'error', 'constructor-super': 'error', 'no-loss-of-precision': 'error',
			},
		}, { filename: file.path.endsWith('.vue') ? `${file.path}.ts` : file.path, allowInlineConfig: false });

		analyzedFiles += 1;
		for (const message of messages) {
			if (message.line < 1) throw new Error('ESLint did not apply the appliance configuration to a source file');
			const security = ['no-eval', 'no-implied-eval', 'no-new-func'].includes(message.ruleId ?? '');
			const heuristic = message.ruleId === 'complexity';

			findings.push(makeFinding({ ruleId: canonicalRule(message.ruleId ?? 'eslint/parse-error'), scanner: 'eslint', category: security ? 'security' : 'codeQuality', severity: security ? 'critical' : message.severity === 2 ? 'major' : 'minor', file: file.path, line: message.line, column: message.column, message: message.message, evidence: `${message.ruleId ?? 'parser'}: ${message.message}`, recommendation: security ? 'Use validated structured data instead of string evaluation.' : 'Resolve the reported syntax or rule violation and verify affected behavior.', principles: security ? ['CONTRACT'] : ['EXPLICIT'], confidence: heuristic ? 0.65 : 1, method: heuristic ? 'heuristic' : 'deterministic', assessment: heuristic ? 'potential_risk' : 'verified_violation' }));
		}
	}

	return { findings, analyzedFiles };
};
