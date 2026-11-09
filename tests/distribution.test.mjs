/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { test } from '@jest/globals';
import { runScenario } from './helpers/scenario.mjs';

/** Verify global/local offline installs, actual scanners and the packaged GUI in disposable prefixes. @returns {Promise<void>} */
const distribution = async () => runScenario('tests/package.mjs', 'distribution', 'Packaged GUI, profile defaults and clean server shutdown passed.');

test('release tarball installs offline and executes CLI scanners and GUI', distribution, 240000);
