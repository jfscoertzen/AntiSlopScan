/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { test } from '@jest/globals';
import { runScenario } from './helpers/scenario.mjs';

/** Exercise a real audit, evidence investigation, exports and accessible responsive controls with Playwright. @returns {Promise<void>} */
const dashboard = async () => runScenario('tests/browser.mjs', 'ui-dashboard', 'Browser verification passed:');

/** Exercise consent, provider failures, sampled model evidence and principle navigation against a local fixture provider. @returns {Promise<void>} */
const modelReview = async () => runScenario('tests/browser-ai.mjs', 'ui-model', 'LLM browser verification passed:');

test('Playwright: authenticated assessment, history, findings, reports and responsive appearance', dashboard, 240000);
test('Playwright: controlled LLM review, source consent, principles and reduced motion', modelReview, 240000);
