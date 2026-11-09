/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
const { TestEnvironment } = require('jest-environment-node');
const fastify = require('fastify');

/** Keep the real Fastify dependency on Node's loader until Jest supports require(ESM) on the pinned Node 22 runtime. */
module.exports = class ApplicationEnvironment extends TestEnvironment {
	/** Expose the unmodified framework, retaining Jest instrumentation for application modules. @returns {Promise<void>} */
	async setup() {
		await super.setup();
		this.global.antislopscanFastify = fastify;
	}
};
