/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import type { Category, Language } from '../domain.js';

export interface ScannerDefinition { id: string; name: string; version: string; languages: Language[]; categories: Category[]; unavailable?: string }
const js: Language[] = ['javascript', 'typescript'];
const all: Language[] = [...js, 'python', 'rust', 'go', 'java', 'cpp', 'csharp', 'ruby', 'php'];

export const scannerCatalog: ScannerDefinition[] = [
	{ id: 'systems', name: 'antislopscan architecture and systems engine', version: 'package', languages: all, categories: ['architecture', 'systemsThinking', 'codeQuality', 'maintainability', 'technicalDebt', 'slop', 'security'] },
	{ id: 'ai', name: 'Optional AI architecture review', version: 'configured model', languages: all, categories: ['systemsThinking'] },
	{ id: 'eslint', name: 'ESLint with appliance JS/TS policy', version: '10.10.0', languages: js, categories: ['codeQuality', 'security', 'maintainability'] },
	{ id: 'slopscore', name: 'SlopScore', version: '2.7.0', languages: all, categories: ['slop', 'security', 'codeQuality'] },
	{ id: 'oxlint', name: 'Oxlint', version: '1.78.0', languages: js, categories: ['codeQuality', 'maintainability'] },
	{ id: 'oxlintAntiSlop', name: 'Vendored Anti-Slop for Oxlint', version: '0.1.2@e8c4880471b23ab7f216fba7b27d173a6ef07d4c', languages: js, categories: ['slop', 'codeQuality'] },
	{ id: 'rustAntiSlop', name: 'AntiSlop Rust CLI', version: '0.3.0', languages: all, categories: ['slop', 'technicalDebt'] },
	{ id: 'jscpd', name: 'jscpd', version: '5.4.2', languages: all, categories: ['maintainability'] },
	{ id: 'dependencyCruiser', name: 'dependency-cruiser', version: '18.7.2', languages: js, categories: ['architecture'] },
	{ id: 'semgrep', name: 'Semgrep Community Edition', version: '1.183.0', languages: all, categories: ['security'] },
	{ id: 'gitleaks', name: 'Gitleaks', version: '8.30.1', languages: all, categories: ['security'] },
	{ id: 'ruff', name: 'Ruff', version: '0.17.3', languages: ['python'], categories: ['codeQuality', 'security'] },
	{ id: 'radon', name: 'Radon', version: '6.0.1', languages: ['python'], categories: ['maintainability'] },
	{ id: 'knip', name: 'Knip', version: 'evaluated 6.44.1', languages: js, categories: ['maintainability'], unavailable: 'Not bundled: automatic framework plugins can load executable project configuration. A reviewed data-only adapter is required.' },
	{ id: 'typescript', name: 'TypeScript compiler', version: '5.9.3', languages: ['typescript'], categories: ['codeQuality'], unavailable: 'Full type checking requires project dependencies and trusted compiler settings. Syntax analysis is provided by the independent AST engine; full compilation is not executed.' },
	{ id: 'clippy', name: 'Clippy', version: 'not bundled', languages: ['rust'], categories: ['codeQuality'], unavailable: 'Cargo may execute build.rs and procedural macros. Audited repository code execution is prohibited.' },
	{ id: 'pmd', name: 'PMD / CPD', version: 'not bundled', languages: ['java'], categories: ['codeQuality'], unavailable: 'Java runtime and reviewed appliance PMD ruleset are not bundled. Multi-language clone detection is separately available through jscpd.' },
	{ id: 'checkstyle', name: 'Checkstyle', version: 'not bundled', languages: ['java'], categories: ['codeQuality'], unavailable: 'Java runtime and trusted Checkstyle configuration are not bundled.' },
	{ id: 'clangTidy', name: 'clang-tidy', version: 'not bundled', languages: ['cpp'], categories: ['codeQuality'], unavailable: 'Requires a reviewed compilation database, headers, and compiler options; repository compiler plugins are not trusted.' },
	{ id: 'sonarqube', name: 'SonarQube external integration', version: 'not bundled', languages: all, categories: ['codeQuality'], unavailable: 'External server integration is not configured. No automatic network scanner is included.' },
];

/** Return a known scanner definition or reject extension by untrusted configuration. */
export const scannerDefinition = (id: string): ScannerDefinition => {
	for (const definition of scannerCatalog) { if (definition.id === id) return definition; }
	throw new Error(`Unknown scanner: ${id}`);
};
