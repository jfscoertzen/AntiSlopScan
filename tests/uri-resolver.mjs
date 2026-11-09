/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const eslintRequire = createRequire(import.meta.resolve('eslint'));
const ajvRequire = createRequire(eslintRequire.resolve('ajv'));
const Ajv = eslintRequire('ajv');
const uri = ajvRequire('uri-js');
const validator = new Ajv({ allErrors: true });
const manifest = createRequire(import.meta.url)('../package.json');

assert.equal(ajvRequire('uri-js/package.json').name, 'fast-uri');
assert.equal(ajvRequire('uri-js/package.json').version, '3.1.9');
assert.deepEqual(Object.keys(manifest.overrides), ['eslint']);
assert.equal(manifest.overrides.eslint.ajv['uri-js'], 'npm:fast-uri@3.1.9');
validator.addSchema({ $id: 'https://example.invalid/child.json', type: 'integer', minimum: 1 });
const validate = validator.compile({ $id: 'https://example.invalid/root.json', type: 'object', required: ['quantity'], properties: { quantity: { $ref: 'child.json' } }, additionalProperties: false });

assert.equal(validate({ quantity: 2 }), true);
assert.equal(validate({ quantity: 0 }), false);
assert.equal(validate({ quantity: 'bad' }), false);
assert.equal(validate({}), false);
assert.equal(validate({ quantity: 2, extra: true }), false);
assert.equal(uri.resolve('https://example.invalid/base/', '../child.json'), 'https://example.invalid/child.json');
assert.doesNotThrow(/** Unicode line and paragraph separators must not cause the old resolver's infinite loop. @returns {void} */ () => {
	uri.resolve('https://example.invalid/base/', '\u2028/../child.json', { iri: true });
	uri.normalize('https://example.invalid/\u2029/../child.json', { iri: true });
});
process.stdout.write('URI resolver compatibility and bounded Unicode regression passed.');
