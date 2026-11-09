/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import ts from 'typescript';
import { extname } from 'node:path';
import { parse } from 'vue/compiler-sfc';

interface Range {
	pos: number;
	end: number;
}
interface TemplateNode {
	type: number;
	loc: { start: { offset: number }; end: { offset: number } };
	children?: TemplateNode[];
}

/** Order source spans for a linear exclusion pass. */
const compareRanges = (left: Range, right: Range): number => left.pos - right.pos;

/** Read compiler-recognized JS/TS comments, excluding comment-like text in strings, regexes, templates and JSX. */
const javascriptComments = (file: string, source: string): Range[] => {
	const kind = /\.[cm]?ts$/.test(file) ? ts.ScriptKind.TS : ts.ScriptKind.TSX;
	const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
	const pending = [tree as ts.Node];
	const comments = new Map<number, Range>();
	const literals: Range[] = [];

	while (pending.length) {
		const node = pending.pop()!;
		const literal =
			node.kind === ts.SyntaxKind.JsxText ||
			ts.isStringLiteralLike(node) ||
			node.kind === ts.SyntaxKind.RegularExpressionLiteral ||
			(node.kind >= ts.SyntaxKind.FirstTemplateToken &&
				node.kind <= ts.SyntaxKind.LastTemplateToken);

		if (literal)
			literals.push({
				pos: node.kind === ts.SyntaxKind.JsxText ? node.pos : node.getStart(tree),
				end: node.end
			});
		for (const range of [
			...(ts.getLeadingCommentRanges(source, node.pos) ?? []),
			...(ts.getTrailingCommentRanges(source, node.end) ?? [])
		])
			comments.set(range.pos, range);
		pending.push(...node.getChildren(tree));
	}
	const protectedRanges = literals.sort(compareRanges);
	const ranges: Range[] = [];
	let cursor = 0;

	for (const comment of [...comments.values()].sort(compareRanges)) {
		while (cursor < protectedRanges.length && protectedRanges[cursor].end <= comment.pos)
			cursor += 1;
		if (
			protectedRanges[cursor] &&
			protectedRanges[cursor].pos <= comment.pos &&
			comment.pos < protectedRanges[cursor].end
		)
			continue;
		ranges.push(comment);
	}
	if (source.startsWith('#!'))
		ranges.push({ pos: 0, end: source.indexOf('\n') < 0 ? source.length : source.indexOf('\n') });
	return ranges;
};

/** Skip a quoted literal without interpreting its contents as comments; retain literal values as executable data. */
const literalEnd = (source: string, index: number, extension: string): number => {
	if (!['"', "'", '`', 'r', 'b', 'R', '@', '/', '%', '<'].includes(source[index])) return index;
	const prefix = source.slice(index, index + 300);
	const rust = extension === '.rs' ? /^(?:br|r)(#{0,255})"/.exec(prefix) : null;
	const cpp = /\.(?:c|cc|cpp|h|hpp)$/.test(extension)
		? /^R"([^\s()\\]{0,16})\(/.exec(prefix)
		: null;
	const raw = rust
		? { opening: rust[0], closing: `"${rust[1]}` }
		: cpp
			? { opening: cpp[0], closing: `)${cpp[1]}"` }
			: null;

	if (raw) {
		const end = source.indexOf(raw.closing, index + raw.opening.length);

		return end < 0 ? source.length : end + raw.closing.length;
	}
	if (extension === '.rb' || extension === '.php') {
		const heredoc = (
			extension === '.php'
				? /^<<<[ \t]*(?:"(\w+)"|'(\w+)'|(\w+))/
				: /^<<[-~]?(?:"(\w+)"|'(\w+)'|(\w+))/
		).exec(prefix);

		if (heredoc) {
			const delimiter = heredoc[1] ?? heredoc[2] ?? heredoc[3];
			let cursor = source.indexOf('\n', index);

			while (cursor >= 0 && cursor < source.length) {
				const end = source.indexOf('\n', cursor + 1);
				const line = source.slice(cursor + 1, end < 0 ? source.length : end).trim();

				if (line === delimiter || line === `${delimiter};`) return end < 0 ? source.length : end;
				cursor = end;
			}
			return source.length;
		}
	}
	if (extension === '.rb') {
		const percent = /^%(?:[qQrwWx])?([({\[\/|])/.exec(prefix);
		const regex =
			source[index] === '/' &&
			/(?:^|[=(:,!~?;])\s*$/.test(source.slice(Math.max(0, index - 100), index));

		if (percent || regex) {
			const opening = percent?.[1] ?? '/';
			const closing =
				({ '(': ')', '{': '}', '[': ']' } as Record<string, string>)[opening] ?? opening;
			let depth = 1;
			let cursor = index + (percent?.[0].length ?? 1);

			while (cursor < source.length) {
				if (source[cursor] === '\\') {
					cursor += 2;
					continue;
				}
				if (opening !== closing && source[cursor] === opening) depth += 1;
				if (source[cursor] === closing && --depth === 0) return cursor + 1;
				cursor += 1;
			}
			return source.length;
		}
	}
	const verbatim = extension === '.cs' && source.startsWith('@"', index);
	const quote = verbatim ? '"' : source[index];

	if (!['"', "'", '`'].includes(quote)) return index;
	if (extension === '.rs' && quote === "'" && !/^'(?:\\.|[^'\\\r\n])'/.test(prefix)) return index;
	const triple = quote !== '`' && source.startsWith(quote.repeat(3), index);
	const closing = triple ? quote.repeat(3) : quote;
	let cursor = index + (verbatim ? 2 : closing.length);

	while (cursor < source.length) {
		if (!verbatim && !(quote === '`' && extension === '.go') && source[cursor] === '\\') {
			cursor += 2;
			continue;
		}
		if (verbatim && source.startsWith('""', cursor)) {
			cursor += 2;
			continue;
		}
		if (source.startsWith(closing, cursor)) return cursor + closing.length;
		cursor += 1;
	}
	return source.length;
};

/** Identify hash/C-family comment spans, preserving quoted/triple/raw literals and nested Rust block comments. */
const lexicalComments = (source: string, extension: string): Range[] => {
	const ranges: Range[] = [];
	const hash = ['.py', '.rb', '.php'].includes(extension);
	const slash = !['.py', '.rb', '.css'].includes(extension);
	let index = 0;

	while (index < source.length) {
		if (
			extension === '.rb' &&
			(index === 0 || source[index - 1] === '\n') &&
			/^=begin(?:\s|$)/.test(source.slice(index, index + 8))
		) {
			const closing = /^=end(?:[ \t].*)?\r?$/gm;

			closing.lastIndex = index + 6;
			const match = closing.exec(source);
			const end = match ? match.index + match[0].length : source.length;

			ranges.push({ pos: index, end });
			index = end;
			continue;
		}
		const end = literalEnd(source, index, extension);

		if (end > index) {
			index = end;
			continue;
		}
		if (
			(hash &&
				source[index] === '#' &&
				!(extension === '.php' && source.startsWith('#[', index))) ||
			(slash && source.startsWith('//', index))
		) {
			const newline = source.indexOf('\n', index);
			const end = newline < 0 ? source.length : newline;

			ranges.push({ pos: index, end });
			index = end;
			continue;
		}
		if (!['.py', '.rb'].includes(extension) && source.startsWith('/*', index)) {
			const start = index;
			let depth = 1;

			index += 2;
			while (index < source.length && depth > 0) {
				if (extension === '.rs' && source.startsWith('/*', index)) {
					depth += 1;
					index += 2;
				} else if (source.startsWith('*/', index)) {
					depth -= 1;
					index += 2;
				} else index += 1;
			}
			ranges.push({ pos: start, end: index });
			continue;
		}
		index += 1;
	}
	return ranges;
};

/** Parse Vue comment locations in both runtime modes, retaining AST comment spans without compiling or executing repository code. */
const vueComments = (file: string, source: string): Range[] => {
	const { descriptor, errors } = parse(source, { filename: file, templateParseOptions: { comments: true } });
	const ranges: Range[] = [];
	const blocks = [
		descriptor.template,
		descriptor.script,
		descriptor.scriptSetup,
		...descriptor.styles,
		...descriptor.customBlocks
	];

	if (errors.length) throw new Error(`Malformed Vue single-file component: ${file}`);
	for (const script of [descriptor.script, descriptor.scriptSetup]) {
		if (!script) continue;
		for (const range of javascriptComments(`${file}.${script.lang ?? 'js'}`, script.content))
			ranges.push({
				pos: script.loc.start.offset + range.pos,
				end: script.loc.start.offset + range.end
			});
	}
	for (const style of descriptor.styles) {
		for (const range of lexicalComments(style.content, '.css'))
			ranges.push({
				pos: style.loc.start.offset + range.pos,
				end: style.loc.start.offset + range.end
			});
	}
	const pending: TemplateNode[] = descriptor.template?.ast
		? [descriptor.template.ast as TemplateNode]
		: [];

	while (pending.length) {
		const node = pending.pop()!;

		if (node.type === 3) ranges.push({ pos: node.loc.start.offset, end: node.loc.end.offset });
		pending.push(...(node.children ?? []));
	}
	for (const match of source.matchAll(/<!--[\s\S]*?-->/g)) {
		if (
			blocks.some(
				/** Avoid treating quoted script/template/style content as a top-level HTML comment. */ (
					block
				) => block && match.index >= block.loc.start.offset && match.index < block.loc.end.offset
			)
		)
			continue;
		ranges.push({ pos: match.index, end: match.index + match[0].length });
	}
	return ranges;
};

/** Mask source comments with spaces, preserving UTF-16 columns/newlines and all noncomment source data. */
export const withoutComments = (file: string, source: string): string => {
	const extension = extname(file).toLowerCase();
	const ranges =
		extension === '.vue'
			? vueComments(file, source)
			: /\.[cm]?[jt]sx?$/.test(file)
				? javascriptComments(file, source)
				: lexicalComments(source, extension);
	const output = source.split('');

	for (const range of ranges) {
		for (let index = range.pos; index < range.end; index += 1) {
			if (output[index] !== '\r' && output[index] !== '\n') output[index] = ' ';
		}
	}
	return output.join('');
};
