/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { parse } from 'vue/compiler-sfc';

/** Extract Vue script blocks as text while preserving source lines; never compile or execute component code. */
export const analysisSource = (file: string, content: string): string => {
	if (!file.endsWith('.vue')) return content;
	const parsed = parse(content, { filename: file });
	const lines = content.split('\n');
	const extracted = new Array<string>(lines.length).fill('');

	if (parsed.errors.length) throw new Error(`Malformed Vue single-file component: ${file}`);
	for (const block of [parsed.descriptor.script, parsed.descriptor.scriptSetup]) {
		if (!block) continue;
		if (block.src) throw new Error(`External Vue script blocks require an explicit source file: ${file}`);
		if (block.lang && !['js', 'ts', 'jsx', 'tsx'].includes(block.lang)) throw new Error(`Unsupported Vue script language: ${file}`);
		for (const [index, line] of block.content.split('\n').entries()) extracted[block.loc.start.line - 1 + index] = line;
	}

	return extracted.join('\n');
};
