/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import ts from 'typescript';
import { posix } from 'node:path';
import { makeFinding } from '../findings.js';
import type { Config, Finding, GraphEdge, GraphNode } from '../domain.js';

export interface AstAnalysis { findings: Finding[]; node: GraphNode; imports: { specifier: string; line: number; typeOnly: boolean }[] }

/** Estimate cyclomatic complexity of one callable, excluding nested callables. */
const complexityOf = (root: ts.Node): number => {
	let complexity = 1;
	const pending = [...root.getChildren()];

	while (pending.length) {
		const node = pending.pop()!;

		if (ts.isFunctionLike(node)) continue;
		if (ts.isIfStatement(node) || ts.isConditionalExpression(node) || ts.isCaseClause(node) || ts.isCatchClause(node) || ts.isForStatement(node) || ts.isForInStatement(node) || ts.isForOfStatement(node) || ts.isWhileStatement(node) || ts.isDoStatement(node)) complexity += 1;
		if (ts.isBinaryExpression(node) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind)) complexity += 1;
		pending.push(...node.getChildren());
	}

	return complexity;
};


/** Check whether a callable is explicitly async. */
const isAsync = (node: ts.Node): boolean => ts.canHaveModifiers(node) && Boolean(ts.getModifiers(node)?.some(isAsyncModifier));


/** Identify the async modifier in compiler syntax. */
const isAsyncModifier = (modifier: ts.Modifier): boolean => modifier.kind === ts.SyntaxKind.AsyncKeyword;


/** Find the nearest enclosing callable without assuming the module executes asynchronously. */
const enclosingCallable = (node: ts.Node): ts.Node | undefined => {
	let parent = node.parent;

	while (parent) {
		if (ts.isFunctionLike(parent)) return parent;
		parent = parent.parent;
	}

	return undefined;
};


/** Recognize declaration-wide and inline type-only imports/exports before building runtime edges. */
const typeOnlyDeclaration = (node: ts.ImportDeclaration | ts.ExportDeclaration): boolean => {
	if (ts.isExportDeclaration(node)) {
		if (node.isTypeOnly) return true;
		return Boolean(node.exportClause && ts.isNamedExports(node.exportClause) && node.exportClause.elements.length > 0 && node.exportClause.elements.every(typeOnlySpecifier));
	}
	if (node.importClause?.isTypeOnly) return true;
	const bindings = node.importClause?.namedBindings;

	return !node.importClause?.name && Boolean(bindings && ts.isNamedImports(bindings) && bindings.elements.length > 0 && bindings.elements.every(typeOnlySpecifier));
};


/** Identify an explicit inline type specifier in a named import or export list. */
const typeOnlySpecifier = (specifier: ts.ImportSpecifier | ts.ExportSpecifier): boolean => specifier.isTypeOnly;


/** Analyze JS/TS syntax without type resolution, importing modules, or evaluating project configuration. */
export const analyzeAst = (file: string, content: string, config: Config): AstAnalysis => {
	const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : file.endsWith('.js') || file.endsWith('.mjs') || file.endsWith('.cjs') ? ts.ScriptKind.JS : ts.ScriptKind.TS);
	const findings: Finding[] = [];
	const imports: AstAnalysis['imports'] = [];
	const pending: ts.Node[] = [source];
	const lines = content.split('\n');
	let maximumComplexity = 0;

	/** Add an AST-backed finding at the exact node location with an explicit detection contract. */
	const add = (node: ts.Node, ruleId: string, category: Finding['category'], message: string, recommendation: string, principles: string[], heuristic = false, severity: Finding['severity'] = 'major'): void => {
		const location = source.getLineAndCharacterOfPosition(node.getStart(source));

		findings.push(makeFinding({ ruleId, category, file, line: location.line + 1, column: location.character + 1, message, evidence: `${message}; syntax at ${file}: ${lines[location.line]?.trim().slice(0, 180) ?? ''}`, recommendation, principles, severity, method: heuristic ? 'heuristic' : 'deterministic', confidence: heuristic ? 0.65 : 1, assessment: heuristic ? 'potential_risk' : 'verified_violation' }));
	};

	while (pending.length) {
		const node = pending.pop()!;

		if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
			if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) imports.push({ specifier: node.moduleSpecifier.text, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, typeOnly: typeOnlyDeclaration(node) });
		}

		if (ts.isFunctionLike(node) && 'body' in node && node.body) {
			const complexity = complexityOf(node.body as ts.Node);

			maximumComplexity = Math.max(maximumComplexity, complexity);
			if (complexity > config.architecture.maxComplexity) add(node, 'design/complexity', 'codeQuality', `Callable complexity ${complexity} exceeds configured limit ${config.architecture.maxComplexity}`, 'Separate independent decisions and test boundary paths before extracting responsibilities.', ['KISS', 'SRP'], true);
		}

		if (ts.isCatchClause(node) && node.block.statements.length === 0) add(node, 'errors/empty-catch', 'codeQuality', 'Catch block discards every failure', 'Handle the failure at its owning boundary or rethrow with useful context.', ['CONTRACT', 'EXPLICIT']);
		if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'Promise' && node.arguments?.[0] && isAsync(node.arguments[0])) add(node, 'async/promise-executor', 'codeQuality', 'Async Promise executor can lose rejected operations', 'Use an async function or a synchronous Promise executor that connects every rejection.', ['EXPLICIT', 'DYNAMIC']);
		if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'Function') add(node, 'security/dynamic-evaluation', 'security', 'Dynamic Function construction executes strings as code', 'Use structured parsing or an allowlisted operation map.', ['CONTRACT'], false, 'critical');

		if (ts.isCallExpression(node)) {
			const expression = node.expression;
			const argument = node.arguments[0];

			if (ts.isIdentifier(expression) && expression.text === 'eval') add(node, 'security/dynamic-evaluation', 'security', 'Direct eval call executes strings as code', 'Replace dynamic evaluation with validated structured data.', ['CONTRACT'], false, 'critical');
			if (ts.isIdentifier(expression) && ['require', 'import'].includes(expression.text) && argument && ts.isStringLiteral(argument)) imports.push({ specifier: argument.text, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, typeOnly: false });
			if (expression.kind === ts.SyntaxKind.ImportKeyword && argument && ts.isStringLiteral(argument)) imports.push({ specifier: argument.text, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, typeOnly: false });
			if (ts.isPropertyAccessExpression(expression) && expression.name.text === 'forEach' && argument && isAsync(argument)) add(node, 'async/unawaited-for-each', 'codeQuality', 'forEach does not await an async callback', 'Use an awaited loop or a bounded concurrent worker pool.', ['EXPLICIT', 'DYNAMIC']);
			if (ts.isIdentifier(expression) && expression.text === 'fetch' && (!node.arguments[1] || (ts.isObjectLiteralExpression(node.arguments[1]) && !/\bsignal\s*[:,]/.test(node.arguments[1].getText(source)) && !node.arguments[1].properties.some(ts.isSpreadAssignment)))) add(node, 'systems/fetch-timeout', 'systemsThinking', 'Direct fetch has no visible cancellation signal', 'Verify caller cancellation; supply a bounded AbortSignal where the operation needs a deadline.', ['DELAYS', 'FAULT_ISOLATION'], true);
			if (ts.isPropertyAccessExpression(expression) && expression.name.text === 'all' && expression.expression.getText(source) === 'Promise' && argument && ts.isCallExpression(argument) && ts.isPropertyAccessExpression(argument.expression) && argument.expression.name.text === 'map') add(node, 'systems/unbounded-fanout', 'systemsThinking', 'Promise.all maps a collection without a visible concurrency bound', 'Establish a maximum input size or process a bounded number of operations concurrently.', ['NONLINEARITY', 'STOCKS', 'LOCAL_GLOBAL'], true);
			if (ts.isPropertyAccessExpression(expression) && /^(readFileSync|writeFileSync|execSync|spawnSync|readdirSync)$/.test(expression.name.text)) {
				const owner = enclosingCallable(node);

				if (owner && isAsync(owner)) add(node, 'systems/blocking-async', 'systemsThinking', 'Synchronous I/O occurs inside an async callable', 'Use asynchronous I/O where this callable serves concurrent work; verify whether startup-only blocking is intentional.', ['DELAYS', 'LOCAL_GLOBAL'], true);
			}
		}

		pending.push(...node.getChildren(source));
	}

	return { findings, imports, node: { file, fanIn: 0, fanOut: 0, lines: lines.length, complexity: maximumComplexity } };
};


/** Resolve relative imports against the audited inventory only; unresolved aliases remain coverage limitations. */
export const resolveImports = (file: string, imports: AstAnalysis['imports'], files: Set<string>): { edges: GraphEdge[]; unresolved: number } => {
	const edges: GraphEdge[] = [];
	let unresolved = 0;

	for (const dependency of imports) {
		if (!dependency.specifier.startsWith('.')) { if (!dependency.specifier.startsWith('node:')) unresolved += 1; continue; }
		const base = posix.normalize(posix.join(posix.dirname(file), dependency.specifier));
		const withoutExtension = base.replace(/\.[cm]?jsx?$/, '');
		const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.jsx`, `${base}.mjs`, `${base}.cjs`, `${base}.mts`, `${base}.cts`, `${base}/index.ts`, `${base}/index.js`, `${withoutExtension}.ts`, `${withoutExtension}.tsx`, `${withoutExtension}.mts`, `${withoutExtension}.cts`];
		let target: string | undefined;

		for (const candidate of candidates) {
			if (files.has(candidate)) { target = candidate; break; }
		}

		if (!target) { unresolved += 1; continue; }
		edges.push({ from: file, to: target, line: dependency.line, typeOnly: dependency.typeOnly });
	}

	return { edges, unresolved };
};
