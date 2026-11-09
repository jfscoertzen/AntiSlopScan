/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { expect, test } from '@jest/globals';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseConfig } from '../src/config.js';
import { createSnapshot } from '../src/security/snapshot.js';
import { createExternalAdapter } from '../src/scanners/external.js';

/** Verify SlopScore findings survive outputs larger than an OS pipe buffer without truncation or source execution. */
const largeOutputContract = async (): Promise<void> => {
	const directory = await mkdtemp(join(tmpdir(), 'antislopscan-slopscore-'));
	const source = join(directory, 'repository');
	const snapshot = join(directory, 'snapshot');
	const config = parseConfig({});

	try {
		await mkdir(source);
		await writeFile(join(source, 'bad.js'), 'eval(userInput);\n'.repeat(1000));
		const inventory = await createSnapshot(source, snapshot, config);
		const adapter = createExternalAdapter('slopscore', { timeoutMs: 30000, maxOutputBytes: 10485760, memoryMb: 512 });
		const result = await adapter.execute({ snapshot, workDirectory: directory, config, inventory });

		expect(result.status).toBe('completed');
		expect(result.analyzedFiles).toBe(1);
		expect(result.findings.length).toBeGreaterThan(500);
		expect(result.findings[0].file).toBe('bad.js');
		const limited = createExternalAdapter('slopscore', { timeoutMs: 30000, maxOutputBytes: 1024, memoryMb: 512 });

		await expect(limited.execute({ snapshot, workDirectory: directory, config, inventory })).rejects.toThrow('Scanner report exceeds output limit');
	} finally {
		try {
			await chmod(snapshot, 0o700);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
		}
		await rm(directory, { recursive: true, force: true });
	}
};

test('SlopScore preserves large JSON reports', largeOutputContract);
