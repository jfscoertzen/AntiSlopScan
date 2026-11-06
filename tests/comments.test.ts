/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { expect, test } from 'vitest';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { analyzeRepository } from '../src/analysis/engine.js';
import { collectAiEvidence } from '../src/ai/evidence.js';
import { parseConfig } from '../src/config.js';
import { withoutComments } from '../src/analysis/comments.js';
import { runAudit } from '../src/orchestrator.js';
import { scannerCatalog } from '../src/scanners/catalog.js';
import type { AuditContext } from '../src/domain.js';

/** Comments cannot create duplicates, inflate module size or satisfy an implementation requirement. */
const commentAssessment = async (): Promise<void> => {
	const directory = await mkdtemp(join(tmpdir(), 'antislopscan-comments-'));
	const body = Array.from(
		{ length: 120 },
		/** Build repeated unstarred block-comment prose. */ (_, index) =>
			`Duplicated explanatory paragraph ${index}: this narrative is deliberately long enough for the old clone heuristic.`
	).join('\n');
	const content = `/*\n${body}\n*/\n// TODO: temporary workaround; AbortSignal supplies a timeout\nexport const request = () => fetch('/api', { /* signal: pretend */ method: 'GET' });\n`;
	const config = parseConfig({
		architecture: {
			maxModuleLines: 100,
			requirements: [
				{
					id: 'deadline',
					description: 'Requests need a deadline',
					files: ['*.ts'],
					capability: 'timeout'
				}
			]
		},
		ai: { maxSourceBytes: 4096, maxFiles: 2 }
	});
	const context: AuditContext = {
		config,
		snapshot: directory,
		workDirectory: directory,
		inventory: {
			files: ['a.ts', 'b.ts'].map(
				/** Describe actual fixture sources. */ (path) => ({
					path,
					language: 'typescript',
					bytes: Buffer.byteLength(content),
					lines: content.split('\n').length,
					hash: ''
				})
			),
			languages: ['typescript'],
			totalBytes: Buffer.byteLength(content) * 2,
			totalLines: content.split('\n').length * 2,
			visitedEntries: 2,
			excludedFiles: 0,
			skippedSymlinks: 0,
			binaryFiles: 0,
			dependencies: [],
			documents: []
		}
	};

	try {
		await writeFile(join(directory, 'a.ts'), content);
		await writeFile(join(directory, 'b.ts'), content);
		const analysis = await analyzeRepository(context);
		const rules = analysis.findings.map(
			/** Inspect canonical rule IDs. */ (finding) => finding.ruleId
		);

		expect(rules).not.toContain('design/duplication');
		expect(rules).not.toContain('architecture/module-size');
		expect(rules).not.toContain('slop/unfinished-comment');
		expect(rules).toContain('requirements/deadline');
		expect(rules).toContain('systems/fetch-timeout');
		const input = await collectAiEvidence(context);

		expect(input.samples).toHaveLength(2);
		for (const sample of input.samples) {
			expect(sample.content).not.toContain('Duplicated explanatory');
			expect(sample.content).not.toContain('TODO');
			expect(sample.content).not.toContain('signal: pretend');
			expect(sample.content).toContain("fetch('/api'");
			expect(sample.startLine).toBe(124);
		}
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
};

test(
	'code assessments ignore comments throughout files while retaining real implementation risks',
	commentAssessment
);

/** Preserve source literals and exact locations across compiler and lexical comment views. */
const literalContract = (): void => {
	const javascript =
		'/* REMOVE block\nunstarred REMOVE body */\nconst url="https://host/path#fragment"; // REMOVE trailing\nconst regex=/[/*]/;\nconst text=`literal // data ${1 /* REMOVE nested */}`;\nconst view=<div>// literal {/* REMOVE JSX */}<span title="/*literal*/" /></div>;\n';
	const fixtures = [
		[
			'code.tsx',
			javascript,
			['https://host/path#fragment', '/[/*]/', 'literal // data', '// literal', '/*literal*/']
		],
		[
			'code.vue',
			'<!-- REMOVE header -->\n<template><div title="<!-- literal -->"><!-- REMOVE template -->x</div></template>\n<script setup>const url="https://host"; /* REMOVE script */</script>\n<style>div { /* REMOVE style */ content:"/*literal*/"; }</style>',
			['<!-- literal -->', 'https://host', '/*literal*/']
		],
		[
			'code.py',
			'# REMOVE header\nurl="https://host/#fragment" # REMOVE trailing\nquery="""select \'#literal\'"""\n',
			['https://host/#fragment', '#literal']
		],
		[
			'code.rs',
			'/* REMOVE outer /* REMOVE nested */ REMOVE rest */\nlet raw=r##"/*literal*/ // data"##;\nfn borrow<\'a>(x: &\'a str) {} // REMOVE trailing',
			['/*literal*/ // data', "borrow<'a>"]
		],
		[
			'code.cpp',
			'const auto raw=R"tag(/*literal*/ " // data)tag"; /* REMOVE */',
			['/*literal*/ " // data']
		],
		['code.cs', 'var s=@"/*literal*/ "" // data"; // REMOVE', ['/*literal*/ "" // data']],
		['code.go', 's := `/*literal*/ // data` // REMOVE', ['/*literal*/ // data']],
		[
			'code.rb',
			'=begin\nREMOVE block\n=end\ns = "#literal" # REMOVE\npattern = /#literal/\nraw = %q{#literal}\ntext = <<~BODY\n#literal\nBODY\n# REMOVE\n',
			['#literal', '/#literal/', '%q{#literal}']
		],
		[
			'code.php',
			'<?php #[Attribute] class Sample {}\n$url="https://host/#fragment"; /* REMOVE */ # REMOVE\n',
			['https://host/#fragment', '#[Attribute]']
		]
	] as const;

	for (const [file, source, literals] of fixtures) {
		const code = withoutComments(file, source);

		expect(code, file).not.toContain('REMOVE');
		expect(code.length, file).toBe(source.length);
		expect(code.split('\n').length, file).toBe(source.split('\n').length);
		for (const literal of literals) expect(code, file).toContain(literal);
	}
};

/** Real duplicated implementation remains detectable across different intervening comments. */
const implementationClone = async (): Promise<void> => {
	const directory = await mkdtemp(join(tmpdir(), 'antislopscan-real-clone-'));
	const code = Array.from(
		{ length: 10 },
		/** Create substantial executable statements. */ (_, index) =>
			`export const sharedCalculation${index} = (input: number) => input * ${index + 1} + 100;`
	).join('\n');
	const config = parseConfig({});
	const context: AuditContext = {
		config,
		snapshot: directory,
		workDirectory: directory,
		inventory: {
			files: ['a.ts', 'b.ts'].map(
				/** Describe duplicate implementation files. */ (path) => ({
					path,
					language: 'typescript',
					bytes: code.length,
					lines: 12,
					hash: ''
				})
			),
			languages: ['typescript'],
			totalBytes: code.length * 2,
			totalLines: 24,
			visitedEntries: 2,
			excludedFiles: 0,
			skippedSymlinks: 0,
			binaryFiles: 0,
			dependencies: [],
			documents: []
		}
	};

	try {
		await writeFile(join(directory, 'a.ts'), `/* repeated documentation */\n${code}`);
		await writeFile(
			join(directory, 'b.ts'),
			`// independent documentation\n${code.replaceAll('\n', '\n/* Different intervening note */\n')}`
		);
		const result = await analyzeRepository(context);
		const duplicates = result.findings.filter(
			/** Select actual clone evidence. */ (finding) => finding.ruleId === 'design/duplication'
		);

		expect(duplicates).toHaveLength(1);
		expect(duplicates[0].line).toBe(2);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
};

test(
	'comment masking preserves code literals, JSX/templates, raw strings and original coordinates',
	literalContract
);
test('DRY still detects repeated code across differing comments', implementationClone);

/** Adding comments cannot change density scores; a comments-only repository cannot claim assessed quality. */
const scoreIsolation = async (): Promise<void> => {
	const directory = await mkdtemp(join(tmpdir(), 'antislopscan-comment-scores-'));
	const source = join(directory, 'source');
	const scanners: Record<string, { enabled: boolean }> = {};

	for (const scanner of scannerCatalog)
		if (!['systems', 'ai'].includes(scanner.id)) scanners[scanner.id] = { enabled: false };
	const config = parseConfig({ scanners, reports: { formats: ['json'] } });
	const code = 'export const execute = (value: string) => eval(value);\n';

	try {
		await mkdir(source);
		await writeFile(join(source, 'module.ts'), code);
		const first = await runAudit(config, { source, output: join(directory, 'first') });

		await writeFile(
			join(source, 'module.ts'),
			`/*\n${'Unstarred narrative repeated code should not count.\n'.repeat(120)}*/\n${code}`
		);
		const second = await runAudit(config, { source, output: join(directory, 'second') });

		expect(second.scores).toEqual(first.scores);
		expect(second.findings[0].line).toBe(123);
		await writeFile(join(source, 'module.ts'), '// TODO: placeholder workaround only\n');
		const empty = await runAudit(config, { source, output: join(directory, 'empty') });

		expect(empty.findings).toEqual([]);
		expect(empty.scores.overall).toBeNull();
		expect(empty.scores.coverage).toBe(0);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
};

test(
	'comments do not affect quality scores and comments-only inputs remain unassessed',
	scoreIsolation
);
