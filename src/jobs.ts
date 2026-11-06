/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { History } from './history.js';
import { runAudit } from './orchestrator.js';
import { log } from './logging.js';
import { redact } from './findings.js';
import type { AuditResult, Config } from './domain.js';

interface JobInput { id: string; source: string; config: Config; baseline?: AuditResult }

/** Own a bounded single-audit queue so subprocess concurrency cannot grow with incoming HTTP traffic. */
export class AuditQueue {
	private readonly pending: JobInput[] = [];
	private active: Promise<void> | undefined;
	private closing = false;
	private readonly abort = new AbortController();

	/** Bind the queue to appliance-owned persistence and a fixed artifact root. */
	constructor(private readonly history: History, private readonly reportRoot: string, private readonly retention: number, private readonly capacity = 5) {}


	/** Accept and persist a bounded job; return its UUID or reject overload/shutdown. */
	submit(source: string, config: Config, baseline?: AuditResult): string {
		if (this.closing) throw new Error('Appliance is shutting down');
		if (this.pending.length + (this.active ? 1 : 0) >= this.capacity) throw new Error('Audit queue is full');
		const id = randomUUID();

		this.history.create(id, config.project.name);
		this.pending.push({ id, source, config, baseline });
		this.start();
		return id;
	}


	/** Start one owned drain promise and attach the queue's operational error boundary. */
	private start(): void {
		if (this.active || this.closing) return;
		this.active = this.drain().catch(this.failed).finally(this.finished);
	}


	/** Process accepted jobs in order; preserve failures and prune both records and artifacts. */
	private async drain(): Promise<void> {
		while (this.pending.length && !this.closing) {
			const job = this.pending.shift()!;
			let phase = 'prepare_output';

			this.history.start(job.id);
			try {
				await mkdir(this.reportRoot, { recursive: true, mode: 0o700 });
				phase = 'scan';
				const result = await runAudit(job.config, { id: job.id, source: job.source, output: join(this.reportRoot, job.id), baseline: job.baseline, signal: this.abort.signal });

				phase = 'persist';
				this.history.complete(result);
			} catch (error) {
				const failure = error as Error & { code?: string };
				const detail = error instanceof SyntaxError || failure.code ? 'Input or I/O failure' : redact(failure.message ?? 'Unknown failure').split(':')[0].slice(0, 300);

				this.history.fail(job.id, 'Audit could not complete. Verify source access, limits, configuration, and appliance logs.');
				log('error', 'audit_job_failed', { auditId: job.id, phase, errorType: failure.name ?? 'UnknownError', code: failure.code ?? 'none', detail });
			}

			for (const id of this.history.prune(this.retention)) await rm(join(this.reportRoot, id), { recursive: true, force: true });
		}
	}


	/** Log queue infrastructure failure without exposing submitted data. */
	private readonly failed = (): void => { log('error', 'audit_queue_failure'); };


	/** Clear the owning promise only after the drain settles. */
	private readonly finished = (): void => { this.active = undefined; if (this.pending.length && !this.closing) this.start(); };


	/** Abort active scanners, fail queued work, and wait for cleanup before closing storage. */
	async close(): Promise<void> {
		this.closing = true;
		this.abort.abort();
		for (const job of this.pending.splice(0)) this.history.fail(job.id, 'Audit cancelled by appliance shutdown');
		await this.active;
	}
}
