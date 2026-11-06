/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { configSchema } from '../dist/config-schema.js';
import { resultSchema } from '../dist/result-schema.js';

await mkdir(new URL('../schemas/', import.meta.url), { recursive: true });
await writeFile(new URL('../schemas/audit-config.schema.json', import.meta.url), `${JSON.stringify(configSchema, null, 2)}\n`);
await writeFile(new URL('../schemas/audit-result.schema.json', import.meta.url), `${JSON.stringify(resultSchema, null, 2)}\n`);
