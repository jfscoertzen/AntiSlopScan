/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */

export const categories = ['slop', 'codeQuality', 'architecture', 'systemsThinking', 'security', 'maintainability', 'technicalDebt'] as const;
export type Category = typeof categories[number];
export type Severity = 'critical' | 'major' | 'minor' | 'info';
export type Assessment = 'verified_violation' | 'strong_evidence' | 'potential_risk' | 'informational' | 'not_assessable' | 'not_applicable';
export type Method = 'deterministic' | 'heuristic' | 'ai_assisted';
export type ScannerStatus = 'completed' | 'failed' | 'timed_out' | 'skipped' | 'unavailable' | 'unsupported';
export type Language = 'javascript' | 'typescript' | 'python' | 'rust' | 'go' | 'java' | 'cpp' | 'csharp' | 'ruby' | 'php';
export type Format = 'html' | 'pdf' | 'json' | 'sarif';

export interface Finding {
	id: string;
	ruleId: string;
	scanner: string;
	category: Category;
	severity: Severity;
	assessment: Assessment;
	method: Method;
	confidence: number;
	file: string;
	line: number;
	column: number;
	message: string;
	evidence: string;
	recommendation: string;
	principles: string[];
	fingerprint: string;
	sources: string[];
	snippet?: string;
}

export interface ScannerSettings {
	enabled: boolean;
	severity?: Severity;
	timeoutSeconds?: number;
	profile?: string;
	configMode?: 'appliance';
	threshold?: number;
}

export interface Config {
	version: '1.0';
	project: { name: string; source: string; type: string; languages: string[] };
	audit: {
		mode: 'full' | 'quick'; parallelScanners: number; timeoutSeconds: number;
		failOnScannerError: boolean; exclude: string[];
		maxFiles: number; maxFileBytes: number; maxRepositoryBytes: number;
		maxEntries: number; scannerMemoryMb: number; maxOutputBytes: number;
	};
	scanners: Record<string, ScannerSettings>;
	analysis: {
		codeQuality: boolean; architecture: boolean; systemsThinking: boolean; security: boolean;
		maintainability: boolean; technicalDebt: boolean; architecturalErosion: boolean;
	};
	architecture: {
		boundaries: { from: string; disallow: string[]; reason: string }[];
		requirements: { id: string; description: string; files: string[]; capability: 'timeout' | 'boundedQueue' | 'idempotency' }[];
		documents: string[];
		maxModuleLines: number; maxComplexity: number; maxFanOut: number;
	};
	rules: { exclude: string[]; severity: Record<string, Severity>; weights: Record<string, number> };
	scoring: {
		range: [number, number]; higherIsBetter: true; weights: Record<Category, number>;
		minimumOverallScore: number; minimumCategoryScore: number;
	};
	ai: {
		enabled: boolean; provider: 'openai-compatible' | 'ollama' | 'openai' | 'claude' | 'openrouter'; baseUrl: string; model: string;
		apiKeyEnv: string; allowSourceTransmission: boolean; timeoutSeconds: number;
		maxSourceBytes: number; mode: 'advisory' | 'architecture'; maxFiles: number;
		maxTokens: number; batchSize: number;
	};
	reports: {
		formats: Format[]; outputDirectory: string; includeSourceSnippets: boolean;
		includeDependencyGraphs: boolean; includeRecommendations: boolean; includeExecutiveSummary: boolean;
	};
	ci: {
		enabled: boolean; failBelowScore: number; failOnCritical: boolean;
		failOnNewHighSeverityFindings: boolean; baseline?: string; minimumCoverage: number;
		exitCodes: { quality: number; scanner: number; configuration: number };
	};
}

export interface SourceFile { path: string; language: Language; bytes: number; lines: number; hash: string }
export interface Inventory {
	files: SourceFile[]; languages: Language[]; totalBytes: number; totalLines: number;
	visitedEntries: number; excludedFiles: number; skippedSymlinks: number; binaryFiles: number;
	documents: { path: string; content: string }[];
	dependencies: string[];
}

export interface AuditContext {
	snapshot: string;
	codeSnapshot?: string;
	codeLines?: number;
	workDirectory: string;
	config: Config;
	inventory: Inventory;
	staticEvidence?: { graph: DependencyGraph; findings: Finding[] };
}

export interface ScannerResult {
	id: string; name: string; version: string; status: ScannerStatus; durationMs: number;
	findings: Finding[]; message?: string; analyzedFiles: number;
	graph?: DependencyGraph;
	aiArchitecture?: AiArchitectureReview;
}

export interface AiEvidence { file: string; line: number; endLine: number; quote: string }
export interface AiPrincipleReview {
	principleId: string; assessment: 'supported' | 'potential_risk' | 'violation' | 'not_assessable' | 'not_applicable';
	score: number | null; confidence: number; reasoning: string; recommendation: string; evidence: AiEvidence[];
}
export interface AiArchitectureReview {
	status: 'completed' | 'partial'; provider: Config['ai']['provider']; model: string; baseUrl: string;
	rubricVersion: '1.0'; completedAt: string; score: number | null; assessedPrinciples: number;
	requestedPrinciples: number; sampledFiles: number; totalFiles: number; sampledBytes: number;
	totalSourceBytes: number; sampledDocuments: number; formula: string; limitations: string[];
	principles: AiPrincipleReview[]; errors: string[];
}

export interface ScannerAdapter {
	id: string;
	name: string;
	version: string;
	/** Check the appliance-owned installation without invoking repository code. */
	isAvailable(): Promise<boolean>;
	/** Decide whether the inventory contains supported inputs. */
	supports(context: AuditContext): boolean;
	/** Execute with bounded resources; reject malformed output and execution failures. */
	execute(context: AuditContext): Promise<ScannerResult>;
	/** Return canonical findings from a validated result. */
	normalize(result: ScannerResult): Finding[];
}

export interface GraphNode { file: string; fanIn: number; fanOut: number; lines: number; complexity: number }
export interface GraphEdge { from: string; to: string; line: number; typeOnly: boolean }
export interface DependencyGraph { nodes: GraphNode[]; edges: GraphEdge[]; cycles: string[][]; unresolvedImports: number }
export interface Principle {
	id: string; name: string; description: string; languages: string[];
	methodology: string; requiredEvidence: string; severity: Severity; confidence: number;
	scoreImpact: string; recommendation: string; falsePositives: string;
	assessment: Assessment; findings: string[];
}

export interface Erosion {
	basis: 'current_structural_risk' | 'historical_comparison'; score: number | null;
	baselineId?: string; comparable: boolean; explanation: string;
	measurements: Record<string, number>;
	deltas: Record<string, number>;
}

export interface Scores {
	overall: number | null;
	categories: Record<Category, number | null>;
	coverage: number;
	confidence: number | null;
	formula: string;
	penalties: Record<Category, number>;
}

export interface AuditResult {
	schemaVersion: '1.0'; applianceVersion: string; id: string; startedAt: string; completedAt: string;
	project: { name: string; source: string; identity: string };
	configurationHash: string;
	inventory: Inventory; scanners: ScannerResult[]; findings: Finding[];
	graph: DependencyGraph; principles: Principle[]; erosion: Erosion; scores: Scores;
	ci: { passed: boolean; exitCode: number; reasons: string[]; newHighSeverity: number | null };
	reports: { format: Format; status: 'completed' | 'failed'; file?: string; message?: string }[];
	limitations: string[];
	aiArchitecture?: AiArchitectureReview;
}
