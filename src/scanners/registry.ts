/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { applicationRoot, runProcess, type ProcessOptions } from '../security/process.js';
import { executeAi } from '../ai.js';
import { createExternalAdapter, supportedFileCount } from './external.js';
import { scannerDefinition } from './catalog.js';
import type { EngineResult } from '../analysis/engine.js';
import type { ScannerAdapter } from '../domain.js';

/** Resolve every internal and external scanner through the same trusted adapter interface. */
export const createAdapter = (id: string, contextPath: string, options: ProcessOptions): ScannerAdapter => {
	if (!['systems', 'eslint', 'ai'].includes(id)) return createExternalAdapter(id, options);
	const definition = scannerDefinition(id);

	return {
		id, name: definition.name, version: definition.version,
		/** Check the application-owned worker without inspecting executable repository files. */
		async isAvailable() {
			await access(join(applicationRoot, 'dist/worker.js'));
			return true;
		},
		/** Select only inventories containing supported source-language data. */
		supports(context) { return supportedFileCount(id, context) > 0; },
		/** Execute isolated internal analysis or the explicitly enabled AI transport. */
		async execute(context) {
			if (id === 'ai') return executeAi(context, options.signal ?? AbortSignal.timeout(options.timeoutMs));
			const output = await runProcess('worker', [id, contextPath], context.workDirectory, options);

			if (output.exitCode !== 0) throw new Error('Analysis worker failed');
			const parsed: EngineResult = JSON.parse(output.stdout);

			if (!Array.isArray(parsed.findings) || !Number.isInteger(parsed.analyzedFiles)) throw new Error('Invalid worker result');
			const manifest = JSON.parse(await readFile(join(applicationRoot, 'package.json'), 'utf8'));

			return { id, name: definition.name, version: id === 'systems' ? manifest.version : definition.version, status: 'completed', durationMs: output.durationMs, findings: parsed.findings, analyzedFiles: parsed.analyzedFiles, ...(id === 'systems' ? { graph: parsed.graph } : {}) };
		},
		/** Return canonical findings while retaining graph transport separately from scoring. */
		normalize(result) { return result.findings; },
	};
};
