/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
const ts = require('typescript');

module.exports = {
	/** Emit ESM and inline source maps using the already pinned compiler; test type checking runs separately. */
	process(sourceText, sourcePath) {
		const result = ts.transpileModule(sourceText, {
			fileName: sourcePath,
			compilerOptions: {
				target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext,
				inlineSourceMap: true, inlineSources: true, esModuleInterop: true
			}
		});

		return { code: result.outputText };
	}
};
