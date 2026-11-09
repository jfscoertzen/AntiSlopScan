/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
const shared = {
	testEnvironment: '<rootDir>/tests/helpers/environment.cjs',
	transform: { '^.+\\.tsx?$': '<rootDir>/scripts/jest-transform.cjs' },
	extensionsToTreatAsEsm: ['.ts'],
	moduleNameMapper: { '^fastify$': '<rootDir>/tests/helpers/fastify.cjs', '^(\\.{1,2}/.*)\\.js$': '$1' }
};

export default {
	maxWorkers: 2,
	testTimeout: 120000,
	coverageProvider: 'v8',
	coverageReporters: ['text', 'json-summary', 'lcov'],
	collectCoverageFrom: [
		'src/scoring.ts', 'src/findings.ts', 'src/review.ts',
		'src/security/paths.ts', 'src/analysis/graph.ts'
	],
	coverageThreshold: { global: { lines: 80, statements: 80, functions: 80, branches: 70 } },
	projects: [
		{ ...shared, displayName: 'backend', testMatch: ['<rootDir>/tests/**/*.test.ts', '<rootDir>/tests/pipeline.test.mjs', '<rootDir>/tests/ci-report.test.mjs', '<rootDir>/tests/snyk.test.mjs'], testPathIgnorePatterns: ['/cli[^/]*\\.test\\.ts$'] },
		{ ...shared, displayName: 'cli', testMatch: ['<rootDir>/tests/cli*.test.ts'] },
		{ ...shared, displayName: 'ui', testMatch: ['<rootDir>/tests/ui-functional.test.mjs'] },
		{ ...shared, displayName: 'distribution', testMatch: ['<rootDir>/tests/distribution.test.mjs'] }
	]
};
