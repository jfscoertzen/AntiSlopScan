/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { access, cp, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { applicationRoot, nativeAvailable, runProcess, type NativeScanner, type ProcessOptions } from '../security/process.js';
import { javascriptInstallation, type JavaScriptScanner } from '../security/installation.js';
import { fromSarif, fromSlopScore, array, record, sourcePath, string } from './normalize.js';
import { makeFinding } from '../findings.js';
import { scannerDefinition } from './catalog.js';
import type { AuditContext, Finding, ScannerAdapter, ScannerResult } from '../domain.js';

const jsPackages: Record<string, JavaScriptScanner> = { slopscore: 'slopscore', oxlint: 'oxlint', oxlintAntiSlop: 'oxlint', jscpd: 'jscpd', dependencyCruiser: 'dependencyCruiser' };
const genericRules = ['no-chained-type-assertions', 'no-conditional-empty-object-spread', 'no-known-value-widening', 'no-module-mocking', 'no-object-parameters', 'no-reflect-apply', 'no-reflect-get', 'no-runtime-typeof', 'no-unsafe-dictionary-type', 'no-shape-in-symbol-names', 'no-unknown-parameters', 'no-unknown-returns', 'no-unknown-type-aliases', 'no-widen-then-assert'];

/** Execute one external adapter using only fixed binaries and generated appliance configuration. */
const executeExternal = async (id: string, context: AuditContext, options: ProcessOptions): Promise<{ findings: Finding[]; analyzedFiles: number; durationMs: number }> => {
	const scratch = join(context.workDirectory, id);

	await mkdir(scratch, { recursive: true, mode: 0o700 });
	let args: string[] = [];
	let binary = id as Parameters<typeof runProcess>[0];
	let reportPath: string | undefined;
	let cwd = scratch;

	if (id === 'slopscore') {
		reportPath = join(scratch, 'slopscore.json');
		args = ['scan', context.snapshot, '--json', '--out', reportPath, '--fail-on', 'never', '--preset', context.config.project.type === 'library' ? 'library' : 'backend'];
	} else if (id === 'oxlint' || id === 'oxlintAntiSlop') {
		binary = 'oxlint';
		const rules: Record<string, string> = {};
		const jsPlugins: { name: string; specifier: string }[] = [];

		if (id === 'oxlintAntiSlop') {
			jsPlugins.push({ name: 'anti-slop', specifier: join(applicationRoot, 'dist/vendor/anti-slop/index.js') });
			for (const rule of genericRules) rules[`anti-slop/${rule}`] = 'warn';
			if (context.config.scanners[id].profile === 'effect') {
				if (!context.inventory.dependencies.includes('effect')) throw new Error('Effect profile requires a declared effect dependency');
				jsPlugins.push({ name: 'anti-slop-effect', specifier: join(applicationRoot, 'dist/vendor/anti-slop/effect/index.js') });
				rules['anti-slop-effect/no-service-constructor-imports'] = 'warn';
			}
		}

		const config = join(scratch, 'oxlint.json');

		await writeFile(config, JSON.stringify({ categories: id === 'oxlintAntiSlop' ? { correctness: 'off' } : { correctness: 'warn', suspicious: 'warn' }, jsPlugins, rules }));
		args = ['--config', config, '--disable-nested-config', '--no-ignore', '--threads', '1', '--format', 'sarif', context.snapshot];
	} else if (id === 'rustAntiSlop') {
		const profiles = join(scratch, '.antislop/profiles');

		await cp(join(applicationRoot, 'tools/vendor/antislop-profiles'), profiles, { recursive: true });
		args = ['--format', 'sarif', '--profile', join(profiles, 'antislop-standard.toml'), '--no-filename-check', '--max-size', String(Math.ceil(context.config.audit.maxFileBytes / 1024)), context.snapshot];
	} else if (id === 'jscpd') {
		const config = join(scratch, 'jscpd.json');

		await writeFile(config, '{}');
		args = [context.snapshot, '--config', config, '--reporters', 'sarif,json', '--output', scratch, '--workers', '1', '--no-gitignore', '--skip-comments', '--silent', '--min-tokens', '50', '--min-lines', '6', '--threshold', String(context.config.scanners[id].threshold ?? 5), '--max-size', String(context.config.audit.maxFileBytes)];
		reportPath = join(scratch, 'jscpd-report.sarif');
	} else if (id === 'dependencyCruiser') {
		const config = join(scratch, 'dependency-cruiser.json');

		await writeFile(config, JSON.stringify({ forbidden: [{ name: 'no-circular', severity: 'error', from: {}, to: { circular: true } }], options: { doNotFollow: { path: 'node_modules' }, tsPreCompilationDeps: true } }));
		cwd = context.snapshot;
		args = ['--config', config, '--output-type', 'json', '.'];
	} else if (id === 'semgrep') args = ['scan', '--config', join(applicationRoot, 'config/semgrep.json'), '--sarif', '--metrics', 'off', '--disable-version-check', '--no-git-ignore', '--jobs', '1', '--max-memory', String(context.config.audit.scannerMemoryMb), context.snapshot];
	else if (id === 'gitleaks') args = ['dir', context.snapshot, '--config', join(applicationRoot, 'config/gitleaks.toml'), '--report-format', 'sarif', '--report-path', '-', '--redact=100', '--no-banner', '--no-color', '--ignore-gitleaks-allow', '--gitleaks-ignore-path', scratch];
	else if (id === 'ruff') args = ['check', '--isolated', '--no-cache', '--output-format', 'json', '--select', 'E4,E7,E9,F,B,S', context.snapshot];
	else if (id === 'radon') args = ['cc', '--json', context.snapshot];
	else throw new Error('No executable adapter registered');

	const output = await runProcess(binary, args, cwd, options);

	if (![0, 1].includes(output.exitCode)) throw new Error(`Scanner exited with failure code ${output.exitCode}`);
	if (reportPath && (await stat(reportPath)).size > options.maxOutputBytes) {
		throw new Error('Scanner report exceeds output limit');
	}
	const raw: unknown = JSON.parse(reportPath ? await readFile(reportPath, 'utf8') : output.stdout);
	const expectedFiles = supportedFileCount(id, context);
	let findings: Finding[];
	let analyzedFiles = expectedFiles;

	if (id === 'slopscore') {
		const normalized = fromSlopScore(raw, context);

		findings = normalized.findings;
		analyzedFiles = normalized.analyzedFiles;
	} else if (id === 'dependencyCruiser') {
		const normalized = fromDependencyCruiser(raw, context);

		findings = normalized.findings;
		analyzedFiles = normalized.analyzedFiles;
	} else if (id === 'ruff') findings = fromRuff(raw, context);
	else if (id === 'radon') findings = fromRadon(raw, context);
	else findings = fromSarif(raw, id, context);
	if (id === 'jscpd') {
		const statistics = record(record(JSON.parse(await readFile(join(scratch, 'jscpd-report.json'), 'utf8'))).statistics);
		const sources = record(statistics.total).sources;

		if (typeof sources !== 'number' || !Number.isInteger(sources) || sources < 0) throw new Error('jscpd omitted its analyzed-source count');
		analyzedFiles = sources;
	}

	return { findings, analyzedFiles, durationMs: output.durationMs };
};


/** Normalize dependency-cruiser cycle evidence from its documented JSON result. */
const fromDependencyCruiser = (input: unknown, context: AuditContext): { findings: Finding[]; analyzedFiles: number } => {
	const result = record(input);
	const modules = array(result.modules);
	const summary = record(result.summary);
	const findings: Finding[] = [];

	for (const raw of array(summary.violations)) {
		const violation = record(raw);
		const file = sourcePath(context, violation.from);

		findings.push(makeFinding({ ruleId: 'architecture/cycle', scanner: 'dependencyCruiser', category: 'architecture', severity: 'major', file, message: 'dependency-cruiser detected a circular dependency', evidence: `${file} imports ${string(violation.to)} within a dependency cycle`, recommendation: 'Extract shared contracts or redirect dependencies through a permitted boundary.', principles: ['CYCLES', 'COUPLING'] }));
	}

	return { findings, analyzedFiles: modules.length };
};


/** Normalize Ruff JSON; isolated mode prevents pyproject configuration discovery. */
const fromRuff = (input: unknown, context: AuditContext): Finding[] => {
	const findings: Finding[] = [];

	for (const raw of array(input)) {
		const item = record(raw);
		const location = record(item.location);
		const code = string(item.code);

		findings.push(makeFinding({ ruleId: `ruff/${code}`, scanner: 'ruff', category: code.startsWith('S') ? 'security' : 'codeQuality', severity: 'major', file: sourcePath(context, item.filename), line: Number(location.row), column: Number(location.column), message: string(item.message), evidence: `Ruff ${code}: ${string(item.message)}`, recommendation: 'Review the Ruff rule and verify the correction with Python tests.', confidence: 0.9, assessment: 'strong_evidence' }));
	}

	return findings;
};


/** Normalize Radon complexity blocks; error entries are scanner failures, never clean files. */
const fromRadon = (input: unknown, context: AuditContext): Finding[] => {
	const findings: Finding[] = [];

	for (const [path, rawBlocks] of Object.entries(record(input))) {
		for (const raw of array(rawBlocks)) {
			const block = record(raw);
			const complexity = Number(block.complexity);

			if (!Number.isFinite(complexity)) throw new Error('Invalid Radon complexity result');
			if (complexity <= context.config.architecture.maxComplexity) continue;
			findings.push(makeFinding({ ruleId: 'design/complexity', scanner: 'radon', category: 'maintainability', severity: 'major', file: sourcePath(context, path), line: Number(block.lineno), message: 'Python block exceeds configured cyclomatic complexity', evidence: `Cyclomatic complexity ${complexity}`, recommendation: 'Separate independent decisions and cover boundary paths with tests.', principles: ['KISS'], method: 'heuristic', confidence: 0.9, assessment: 'potential_risk' }));
		}
	}

	return findings;
};


/** Count applicable inventory files rather than claiming every language was scanned. */
export const supportedFileCount = (id: string, context: AuditContext): number => {
	if (context.codeLines === 0) return 0;
	const definition = scannerDefinition(id);
	let count = 0;

	for (const file of context.inventory.files) { if (definition.languages.includes(file.language)) count += 1; }
	return count;
};


/** Create a trusted adapter from the compiled registry; config cannot supply executable paths. */
export const createExternalAdapter = (id: string, options: ProcessOptions): ScannerAdapter => {
	const definition = scannerDefinition(id);

	return {
		id, name: definition.name, version: definition.version,
		/** Check fixed installation files, including vendored profile/plugin assets. */
		async isAvailable() {
			if (definition.unavailable) return false;
			try {
				if (jsPackages[id]) {
					const installed = await javascriptInstallation(jsPackages[id]);
					const expected = id === 'oxlintAntiSlop' ? '1.78.0' : definition.version;

					if (!installed) return false;
					if (installed.version !== expected) throw new Error(`Installed ${id} version differs from the pinned adapter contract`);
					if (id === 'oxlintAntiSlop') await access(join(applicationRoot, 'dist/vendor/anti-slop/index.js'));
					return true;
				}
				return await nativeAvailable(id as NativeScanner);
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
				throw error;
			}
		},
		/** Select this adapter only for inventory languages it supports. */
		supports(context) { return supportedFileCount(id, context) > 0; },
		/** Execute the pinned scanner and return a truthful canonical result. */
		async execute(context) {
			const output = await executeExternal(id, context.codeSnapshot ? { ...context, snapshot: context.codeSnapshot } : context, options);

			return { id, name: definition.name, version: definition.version, status: 'completed', ...output, message: context.codeSnapshot ? `Comments excluded from scanner input.${id === 'slopscore' ? ' Physical-line size rule 055 is replaced by the core code-line module metric.' : ''}` : undefined };
		},
		/** Expose already normalized findings without modifying sibling results. */
		normalize(result: ScannerResult) { return result.findings; },
	};
};
