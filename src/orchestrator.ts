/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { chmod, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { configurationHash } from './config.js';
import { createSnapshot, matchesAny, readSource } from './security/snapshot.js';
import { createCodeSnapshot } from './security/code-snapshot.js';
import { isInside } from './security/paths.js';
import { applicationRoot, ProcessFailure, type ProcessOptions } from './security/process.js';
import { deduplicate, redact } from './findings.js';
import { categoryEnabled, calculateScores, evaluateCi } from './scoring.js';
import { assessPrinciples } from './analysis/policies.js';
import { measureErosion } from './analysis/erosion.js';
import { createAdapter } from './scanners/registry.js';
import { scannerCatalog } from './scanners/catalog.js';
import { generateReports } from './reports/index.js';
import { assertAuditResult } from './result-schema.js';
import { log } from './logging.js';
import type { AuditContext, AuditResult, Config, DependencyGraph, Finding, ScannerResult, AiArchitectureReview } from './domain.js';

export interface AuditOptions { source?: string; output?: string; id?: string; baseline?: AuditResult; signal?: AbortSignal }

/** Run a complete bounded audit, preserve independent failures, publish reports, and always remove source snapshots. */
export const runAudit = async (config: Config, options: AuditOptions = {}): Promise<AuditResult> => {
	const startedAt = new Date().toISOString();
	const source = await realpath(options.source ?? config.project.source);
	const requestedOutput = resolve(options.output ?? config.reports.outputDirectory);
	const workDirectory = await mkdtemp(join(tmpdir(), 'antislopscan-'));
	const deadline = AbortSignal.any([AbortSignal.timeout(config.audit.timeoutSeconds * 1000), ...(options.signal ? [options.signal] : [])]);

	try {
		if (isInside(source, requestedOutput)) throw new Error('Report output must be outside the audited repository');
		await mkdir(requestedOutput, { recursive: true, mode: 0o700 });
		const output = await realpath(requestedOutput);

		if (isInside(source, output)) throw new Error('Report output resolves inside the audited repository');
		const snapshot = join(workDirectory, 'source');
		const inventory = await createSnapshot(source, snapshot, config, deadline);
		const context: AuditContext = { snapshot, workDirectory, config, inventory };
		const contextPath = join(workDirectory, 'context.json');

		await createCodeSnapshot(context, deadline);
		await writeFile(contextPath, JSON.stringify(context), { mode: 0o600, flag: 'wx' });
		const execution = await executeScanners(context, contextPath, deadline);
		const findings = await applyFindingPolicy(execution.scanners, context);
		const packageJson = JSON.parse(await readFile(join(applicationRoot, 'package.json'), 'utf8'));
		const result: AuditResult = {
			schemaVersion: '1.0', applianceVersion: packageJson.version, id: options.id ?? randomUUID(), startedAt,
			completedAt: new Date().toISOString(), project: { name: config.project.name, source, identity: createHash('sha256').update(`${config.project.name}\0${source}`).digest('hex') },
			configurationHash: configurationHash(config, packageJson.version), inventory, scanners: execution.scanners, findings,
			graph: execution.graph, principles: assessPrinciples(findings.filter(/** Keep static principle conclusions independent of model interpretations. */ (finding) => finding.method !== 'ai_assisted'), execution.graph.nodes.length > 0),
			...(execution.aiArchitecture ? { aiArchitecture: execution.aiArchitecture } : {}),
			erosion: { basis: 'current_structural_risk', score: null, comparable: false, explanation: '', measurements: {}, deltas: {} },
			scores: calculateScores(findings, execution.scanners, config, context.codeLines ?? inventory.totalLines),
			ci: { passed: false, exitCode: config.ci.exitCodes.scanner, reasons: [], newHighSeverity: null }, reports: [],
			limitations: [
				'Scores describe supported static evidence, not a security certification or proof of AI authorship.',
				'Code checks and LLM source evidence exclude comments. Density scores use nonblank comment-masked code lines; inventory line counts/hashes describe original files. Comment-only credentials are outside this code-only scan policy.',
				'Graph coverage is JS/TS relative imports; dynamic imports, external packages, aliases, and runtime calls may remain unresolved.',
				'Only recognized source-language files are copied. Package scripts, repository configuration, dependencies, VCS internals, .codex/.agents settings, .aws credentials, .npm-cache, symlinks, binary files, and other files are excluded. Secret scanning therefore covers source files only.',
				'The bounded clone heuristic samples at most 250,000 windows. Use jscpd for broader clone analysis.',
				'Git churn, co-change, defect correlations, full type checking, and semantic architecture drift are not implemented; no claims are inferred for them.',
				'CLI subprocesses do not independently restrict network access. Run the one-shot container with --network none or the internal Compose network to enforce scanner egress isolation.',
				'Node heap limits and Linux CPU/output/open-file limits supplement container memory/PID limits; they are not a per-scanner native-memory sandbox.',
			],
		};

		let baseline = options.baseline;

		if (!baseline && config.ci.baseline) {
			const raw: unknown = JSON.parse(await readFile(config.ci.baseline, 'utf8'));

			assertAuditResult(raw);
			baseline = raw;
		}
		result.erosion = config.analysis.architecturalErosion ? measureErosion(result, baseline) : { ...result.erosion, explanation: 'Architectural erosion assessment was disabled by configuration.' };
		if (baseline && (baseline.project.identity !== result.project.identity || baseline.configurationHash !== result.configurationHash)) throw new Error('Baseline project or analysis policy does not match this audit');
		result.ci = evaluateCi(result, config, baseline);
		assertAuditResult(result);
		await generateReports(result, config, output, baseline);
		log('info', 'audit_completed', { auditId: result.id, findings: findings.length, coverage: result.scores.coverage, exitCode: result.ci.exitCode });
		return result;
	} finally {
		await removeSnapshot(workDirectory);
	}
};


/** Schedule scanner work with bounded concurrency and retain statuses for every registered tool. */
const executeScanners = async (context: AuditContext, contextPath: string, signal: AbortSignal): Promise<{ scanners: ScannerResult[]; graph: DependencyGraph; aiArchitecture?: AiArchitectureReview }> => {
	const scanners: ScannerResult[] = [];
	const graph: DependencyGraph = { nodes: [], edges: [], cycles: [], unresolvedImports: 0 };
	const pending = scannerCatalog.filter(/** Defer optional semantic review until static evidence is complete. */ (definition) => definition.id !== 'ai');
	let aiArchitecture: AiArchitectureReview | undefined;

	/** Drain independent jobs; each failure is converted into a scanner result at this boundary. */
	const drain = async (): Promise<void> => {
		while (pending.length) {
			const definition = pending.shift()!;
			const id = definition.id;
			const started = performance.now();
			const result: ScannerResult = { id, name: definition.name, version: definition.version, status: 'skipped', durationMs: 0, findings: [], analyzedFiles: 0 };
			const settings = context.config.scanners[id];

			if (id === 'ai' ? !context.config.ai.enabled : id !== 'systems' && !settings?.enabled) { result.message = 'Disabled by configuration'; scanners.push(result); continue; }
			if (context.config.audit.mode === 'quick' && !['systems', 'eslint', 'slopscore', 'oxlintAntiSlop', 'rustAntiSlop', 'ai'].includes(id)) { result.message = 'Not selected in quick mode'; scanners.push(result); continue; }
			let supported = false;

			for (const language of context.inventory.languages) { if (definition.languages.includes(language)) supported = true; }
			if (!supported) { result.status = 'unsupported'; result.message = 'No supported source files in this inventory'; scanners.push(result); continue; }
			if (signal.aborted) { result.status = 'timed_out'; result.message = 'Audit deadline exceeded before execution'; scanners.push(result); continue; }

			const processOptions: ProcessOptions = { timeoutMs: (settings?.timeoutSeconds ?? 120) * 1000, maxOutputBytes: context.config.audit.maxOutputBytes, memoryMb: context.config.audit.scannerMemoryMb, signal };

			try {
				const adapter = createAdapter(id, contextPath, processOptions);

				if (!adapter.supports(context)) { result.status = 'unsupported'; result.message = 'Adapter has no supported input files'; }
				else if (!await adapter.isAvailable()) { result.status = 'unavailable'; result.message = definition.unavailable ?? 'Pinned scanner binary or assets are not installed'; }
				else {
					Object.assign(result, await adapter.execute(context));
					result.findings = adapter.normalize(result);
					if (result.graph) { Object.assign(graph, result.graph); delete result.graph; }
					if (result.aiArchitecture) { aiArchitecture = result.aiArchitecture; delete result.aiArchitecture; }
				}
			} catch (error) {
				result.status = signal.aborted || error instanceof ProcessFailure && error.status === 'timed_out' ? 'timed_out' : 'failed';
				result.findings = [];
				result.message = result.status === 'timed_out' ? 'Scanner or audit deadline exceeded' : error instanceof SyntaxError ? 'Scanner returned malformed JSON' : 'Scanner execution failed; verify its pinned installation, resource limits and appliance configuration';
				log('warn', 'scanner_failed', { scanner: id, status: result.status });
			}

			result.durationMs = Math.round(performance.now() - started);
			scanners.push(result);
		}
	};

	const workers: Promise<void>[] = [];

	for (let index = 0; index < context.config.audit.parallelScanners; index += 1) workers.push(drain());
	await Promise.all(workers);
	context.staticEvidence = { graph, findings: scanners.flatMap(/** Supply actual completed static evidence to semantic review. */ (scanner) => scanner.status === 'completed' ? scanner.findings : []) };
	pending.push(scannerCatalog.find(/** Resolve the registered optional AI adapter. */ (definition) => definition.id === 'ai')!);
	await drain();
	scanners.sort(compareScanners);
	return { scanners, graph, aiArchitecture };
};


/** Apply operator rule/category policy and consume completed findings; reject unlisted paths or unsafe snippet reads, attaching bounded redacted source only when requested. */
export const applyFindingPolicy = async (scanners: ScannerResult[], context: AuditContext): Promise<Finding[]> => {
	const findings: Finding[] = [];
	const sourceLines = new Map<string, string[]>();
	const inventoryPaths = new Set(context.inventory.files.map(/** Restrict evidence to the original source inventory. */ (file) => file.path));

	for (const scanner of scanners) {
		if (scanner.status !== 'completed') continue;
		for (const finding of scanner.findings) {
			if (!categoryEnabled(finding.category, context.config) || matchesAny(finding.ruleId, context.config.rules.exclude)) continue;
			if (!inventoryPaths.has(finding.file)) throw new Error('Scanner finding references a file outside the source inventory');
			finding.severity = context.config.rules.severity[finding.ruleId] ?? context.config.scanners[scanner.id]?.severity ?? finding.severity;
			if (context.config.reports.includeSourceSnippets && finding.category !== 'security') {
				if (!sourceLines.has(finding.file)) {
					const content = await readSource(context.snapshot, finding.file, context.config.audit.maxFileBytes);

					if (content === null) throw new Error('Scanner evidence references non-text source');
					sourceLines.set(finding.file, content.split('\n'));
				}
				finding.snippet = redact(sourceLines.get(finding.file)!.slice(Math.max(0, finding.line - 2), finding.line + 1).join('\n')).slice(0, 1200);
			}
			findings.push(finding);
		}
		scanner.findings = [];
	}

	return deduplicate(findings);
};


/** Preserve deterministic scanner ordering independent of execution completion order. */
const compareScanners = (left: ScannerResult, right: ScannerResult): number => left.id.localeCompare(right.id, 'en');


/** Remove read-only snapshot directories and all temporary source data; propagate cleanup failure. */
const removeSnapshot = async (workDirectory: string): Promise<void> => {
	for (const name of ['source', 'code']) {
		try { await chmod(join(workDirectory, name), 0o700); }
		catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
	}
	await rm(workDirectory, { recursive: true, force: true });
};
