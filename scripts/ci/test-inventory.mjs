/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { visualCases } from '../../tests/visual-cases.mjs';

const scenarios = { 'ui-functional.test.mjs:dashboard': 'tests/browser.mjs', 'ui-functional.test.mjs:modelReview': 'tests/browser-ai.mjs', 'distribution.test.mjs:distribution': 'tests/package.mjs', 'ci-report.test.mjs:failureDocuments': 'tests/ci-report-failure.mjs', 'snyk.test.mjs:legacySchemaResolver': 'tests/uri-resolver.mjs' };

/** Extract executable assertion statements without executing or importing test source. @param {import('typescript').Node} node @param {import('typescript').SourceFile} source @returns {string[]} */
const assertions = (node, source) => {
	const result = [];
	const printer = ts.createPrinter({ removeComments: true });

	/** Collect assertions inside loops and callbacks, retaining exact literal values. @param {import('typescript').Node} child @returns {void} */
	const inspect = (child) => {
		if (ts.isExpressionStatement(child) && /^(?:await\s+)?(?:expect|assert)[.(]/.test(child.getText(source))) {
			result.push(printer.printNode(ts.EmitHint.Unspecified, child, source).trim());
			return;
		}
		ts.forEachChild(child, inspect);
	};

	inspect(node);
	return [...new Set(result)];
};

/** Read all registered test titles, contracts and real assertion expressions from this checkout. @param {string} [root] @returns {Promise<object[]>} */
export const testInventory = async (root = process.cwd()) => {
	const files = (await readdir(resolve(root, 'tests'))).filter(/** Select only Jest source suites. @param {string} file @returns {boolean} */ (file) => /\.test\.(?:ts|mjs)$/.test(file)).sort();
	const cases = [];

	for (const name of files) {
		const file = `tests/${name}`;
		const source = ts.createSourceFile(file, await readFile(resolve(root, file), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
		const functions = new Map();
		const project = name.startsWith('cli') ? 'cli' : name === 'ui-functional.test.mjs' ? 'ui' : name === 'distribution.test.mjs' ? 'distribution' : 'backend';

		for (const statement of source.statements) {
			if (!ts.isVariableStatement(statement)) continue;
			for (const declaration of statement.declarationList.declarations) {
				if (ts.isIdentifier(declaration.name) && declaration.initializer && ts.isArrowFunction(declaration.initializer)) {
					const comment = statement.getFullText(source).match(/\/\*\*([\s\S]*?)\*\//)?.[1] ?? '';
					const purpose = comment.replace(/^\s*\*\s?/gm, '').split(/\s+@\w/)[0].trim();

					functions.set(declaration.name.text, { body: declaration.initializer, purpose });
				}
			}
		}

		for (const statement of source.statements) {
			if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) continue;
			const call = statement.expression;
			const title = call.arguments[0];
			const callback = call.arguments[1];

			if (!title || !ts.isStringLiteral(title) || !callback || !ts.isIdentifier(callback) || !functions.has(callback.text)) continue;
			const definition = functions.get(callback.text);
			const script = scenarios[`${name}:${callback.text}`];
			let checks = assertions(definition.body, source);
			let evidenceSource = file;

			if (script) {
				const scenario = ts.createSourceFile(script, await readFile(resolve(root, script), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);

				checks = assertions(scenario, scenario);
				evidenceSource = script;
			}
			const line = source.getLineAndCharacterOfPosition(statement.getStart(source)).line + 1;

			cases.push({ id: `${project}-${basename(name).replace(/\.test\..+$/, '')}-${callback.text}`, project, title: title.text, file, line, purpose: definition.purpose, evidenceSource, checks });
		}
	}
	return cases;
};

/** Generate the maintained source-backed inventory in TESTING.md; reject stale documentation in check mode. @returns {Promise<void>} */
const main = async () => {
	const inventory = await testInventory();
	const start = '<!-- test-inventory:start -->';
	const end = '<!-- test-inventory:end -->';
	const document = resolve('docs/TESTING.md');
	const current = await readFile(document, 'utf8');
	const sections = [start, '\n## Every registered test case\n', 'This inventory is extracted from the test source. Each case lists its stated contract and actual assertion expressions. Assertions inside loops run for each fixture/combination; this list is not a runtime assertion count. On an early failure, later assertions were not reached. Browser screenshots and manifests provide the visual checkpoints described below.\n'];

	for (const item of inventory) {
		sections.push(`### ${item.id}\n\n**${item.title}**\n\nProject: ${item.project}. Source: [${item.file}:${item.line}](../${item.file}).\n\n${item.purpose}\n`);
		if (item.evidenceSource !== item.file) sections.push(`Assertions run by the delegated scenario: [${item.evidenceSource}](../${item.evidenceSource}).\n`);
		sections.push('Actual checks:\n\n~~~typescript\n' + item.checks.join('\n') + '\n~~~\n');
	}
	sections.push('## Every required frontend screenshot\n\nEach checkpoint is captured only after its assertions. The manifest records viewport, theme, time, actual PNG dimensions and SHA-256. Hidden password fields are not masked over unrelated UI; visible credential fields are masked. Static screenshots do not prove motion, clipboard contents or download bytes, so captions identify the corresponding nonvisual checks.\n');
	for (const scenario of ['ui-dashboard', 'ui-model']) {
		sections.push(`### ${scenario} visual checkpoints\n\n| PNG / checkpoint | Feature | Verified behavior |\n| --- | --- | --- |`);
		for (const [id, feature] of Object.entries(visualCases(scenario))) sections.push(`| ${id}.png | ${feature.title} | ${feature.checks} |`);
		sections.push('');
	}
	sections.push(end);
	const generated = sections.join('\n');
	const updated = current.includes(start) ? current.slice(0, current.indexOf(start)) + generated + current.slice(current.indexOf(end) + end.length) : current.trimEnd() + '\n\n' + generated + '\n';

	if (process.argv.includes('--write')) await writeFile(document, updated);
	else if (current !== updated) throw new Error('TESTING.md inventory is stale. Run npm run docs:tests to update it.');
	process.stdout.write(`Test inventory: ${inventory.length} cases verified.\n`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
