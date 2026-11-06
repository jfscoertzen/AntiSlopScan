/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { assertAuditResult } from './result-schema.js';
import type { AuditResult } from './domain.js';

// Vite 5 predates node:sqlite in its builtin-module table; bypass its module resolver.
const { DatabaseSync } = process.getBuiltinModule('node:sqlite') as typeof import('node:sqlite');

export interface AuditJob { id: string; project: string; status: 'queued' | 'running' | 'completed' | 'failed'; createdAt: string; completedAt: string | null; score: number | null; error: string | null }

/** Own one SQLite connection for the appliance lifetime; history queries are indexed and bounded. */
export class History {
	private readonly database: InstanceType<typeof DatabaseSync>;

	/** Open/migrate appliance-owned storage; mark work interrupted by a previous process as failed. */
	constructor(path: string) {
		this.database = new DatabaseSync(path);
		this.database.exec(`
			PRAGMA journal_mode=WAL;
			PRAGMA busy_timeout=5000;
			CREATE TABLE IF NOT EXISTS audits (
				id TEXT PRIMARY KEY, project TEXT NOT NULL, status TEXT NOT NULL,
				createdAt TEXT NOT NULL, completedAt TEXT, score REAL, error TEXT, result TEXT
			);
			CREATE INDEX IF NOT EXISTS audits_created ON audits(createdAt DESC);
			CREATE INDEX IF NOT EXISTS audits_project_created ON audits(project, createdAt DESC);
			CREATE INDEX IF NOT EXISTS audits_status ON audits(status);
			PRAGMA user_version=1;
		`);
		this.database.prepare("UPDATE audits SET status='failed', error='Audit interrupted by appliance restart' WHERE status IN ('queued','running')").run();
	}


	/** Persist a newly accepted job before asynchronous work starts; reject duplicate IDs. */
	create(id: string, project: string): void {
		this.database.prepare('INSERT INTO audits(id,project,status,createdAt) VALUES(?,?,?,?)').run(id, project, 'queued', new Date().toISOString());
	}


	/** Mark a queued audit as running. */
	start(id: string): void {
		this.database.prepare("UPDATE audits SET status='running' WHERE id=? AND status='queued'").run(id);
	}


	/** Store a validated canonical result and its final gate outcome atomically in one row. */
	complete(result: AuditResult): void {
		assertAuditResult(result);
		this.database.prepare("UPDATE audits SET status='completed', completedAt=?, score=?, result=?, error=NULL WHERE id=?").run(result.completedAt, result.scores.overall, JSON.stringify(result), result.id);
	}


	/** Record a safe job-boundary failure without storing source or internal stack traces. */
	fail(id: string, message: string): void {
		this.database.prepare("UPDATE audits SET status='failed', completedAt=?, error=? WHERE id=?").run(new Date().toISOString(), message, id);
	}


	/** Return a page of summaries; never select the potentially large result column. */
	list(limit = 25, offset = 0): AuditJob[] {
		if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) throw new Error('Invalid history pagination');
		return this.database.prepare('SELECT id,project,status,createdAt,completedAt,score,error FROM audits ORDER BY createdAt DESC,id DESC LIMIT ? OFFSET ?').all(limit, offset) as unknown as AuditJob[];
	}


	/** Read one job summary by its bound identifier. */
	get(id: string): AuditJob | undefined {
		return this.database.prepare('SELECT id,project,status,createdAt,completedAt,score,error FROM audits WHERE id=?').get(id) as unknown as AuditJob | undefined;
	}


	/** Deserialize and validate one completed audit for review or baseline comparison. */
	result(id: string): AuditResult | undefined {
		const row = this.database.prepare("SELECT result FROM audits WHERE id=? AND status='completed'").get(id);

		if (!row) return undefined;
		const result: unknown = JSON.parse(String(row.result));

		assertAuditResult(result);
		return result;
	}


	/** Remove oldest completed/failed records beyond retention and return their IDs for artifact cleanup. */
	prune(retain: number): string[] {
		if (!Number.isInteger(retain) || retain < 1) throw new Error('History retention must be positive');
		const rows = this.database.prepare("SELECT id FROM audits WHERE status IN ('completed','failed') ORDER BY createdAt DESC,id DESC LIMIT -1 OFFSET ?").all(retain);
		const ids: string[] = [];
		const remove = this.database.prepare('DELETE FROM audits WHERE id=?');

		this.database.exec('BEGIN IMMEDIATE');
		try {
			for (const row of rows) { const id = String(row.id); remove.run(id); ids.push(id); }
			this.database.exec('COMMIT');
		} catch (error) {
			this.database.exec('ROLLBACK');
			throw error;
		}

		return ids;
	}


	/** Close the owning connection after all work and HTTP requests have drained. */
	close(): void { this.database.close(); }
}
