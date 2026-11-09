/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { expect, test } from '@jest/globals';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runAudit } from '../src/orchestrator.js';
import { parseConfig } from '../src/config.js';
import { scannerCatalog } from '../src/scanners/catalog.js';
import { renderHtml, renderPdfAppendix } from '../src/reports/html.js';
import { renderSarif } from '../src/reports/sarif.js';

/** Presentation preserves canonical evidence, separates static/model scores, escapes content and embeds offline artwork. */
const reportContract = async (): Promise<void> => {
	const directory = await mkdtemp(join(tmpdir(), 'antislopscan-report-design-'));
	const source = join(directory, 'source');
	const scanners: Record<string, { enabled: boolean }> = {};

	for (const scanner of scannerCatalog)
		if (!['systems', 'ai'].includes(scanner.id)) scanners[scanner.id] = { enabled: false };
	const config = parseConfig({
		scanners,
		project: { name: '<img src=x onerror=alert(1)>' },
		reports: { formats: ['json'] }
	});

	try {
		await mkdir(source);
		await writeFile(
			join(source, 'module.ts'),
			'export const execute = (input: string) => eval(input);\n'
		);
		const result = await runAudit(config, { source, output: join(directory, 'reports') });

		result.aiArchitecture = {
			status: 'completed',
			provider: 'ollama',
			model: 'controlled-test-model',
			baseUrl: 'http://localhost:11434',
			rubricVersion: '1.0',
			completedAt: result.completedAt,
			score: 52,
			assessedPrinciples: 1,
			requestedPrinciples: 56,
			sampledFiles: 1,
			totalFiles: 1,
			sampledBytes: 66,
			totalSourceBytes: 66,
			sampledDocuments: 0,
			formula: 'Controlled test rubric; separate from deterministic quality.',
			limitations: ['Bounded test evidence.'],
			errors: [],
			principles: [
				{
					principleId: 'DRY',
					assessment: 'potential_risk',
					score: 52,
					confidence: 0.7,
					reasoning: '<script>untrusted interpretation</script>',
					recommendation: 'Review implementation context.',
					evidence: [
						{
							file: 'module.ts',
							line: 1,
							endLine: 1,
							quote: 'export const execute = (input: string) => eval(input);'
						}
					]
				},
				{
					principleId: 'UNMAPPED_TEST',
					assessment: 'not_assessable',
					score: null,
					confidence: 0,
					reasoning: 'Unmapped historical assessment must remain visible.',
					recommendation: 'Review catalog compatibility.',
					evidence: []
				}
			]
		};
		const before = structuredClone(result);
		const sarif = renderSarif(result);
		const html = await renderHtml(result, config);
		const appendix = await renderPdfAppendix(result, config, result.findings, 0);

		expect(html).toContain('class="report-cover"');
		expect(html).toContain('class="score-gauge"');
		expect(html).toContain('id="report-accent"');
		expect(html).toContain('id="concept-boundaries"');
		expect(html).toContain('id="concept-consolidation"');
		expect(html).toContain('id="concept-contracts"');
		expect(html).toContain('id="concept-flows"');
		expect(html).toContain('Unmapped historical assessment must remain visible.');
		expect(html).toContain('LLM interpretation');
		expect(html).toContain('Static assessment');
		expect(html).toContain('&lt;script&gt;untrusted interpretation&lt;/script&gt;');
		expect(html).not.toContain('<script>untrusted interpretation</script>');
		expect(html).toContain('data:image/png;base64,');
		expect(html).not.toContain('<img src=x');
		for (const finding of result.findings) {
			expect(html).toContain(finding.fingerprint);
			expect(appendix).toContain(finding.fingerprint);
		}
		expect(appendix).not.toContain('class="report-cover"');
		expect(result).toEqual(before);
		expect(renderSarif(result)).toEqual(sarif);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
};

test(
	'publication styling preserves all evidence and machine contracts with safe offline branding',
	reportContract
);
