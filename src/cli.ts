#!/usr/bin/env node
/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { parseArgs } from 'node:util';
import { realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, type AuditProfile } from './config.js';
import { runAudit } from './orchestrator.js';
import { configSchema } from './config-schema.js';
import { log } from './logging.js';
import { ReportFailure } from './reports/index.js';
import { redact } from './findings.js';
import { environmentSetting } from './environment.js';
import { aiCommandOptions } from './ai-settings.js';

const help = `antislopscan
  antislopscan cli --source PATH --output FOLDER [--profile full|portable] [--config FILE]
  antislopscan gui [--source PATH] [--data FOLDER] [--profile full|portable] [--host 127.0.0.1] [--port 3000]
  antislopscan schema

CLI writes report.html, report.pdf, report.json, and report.sarif.json into --output
unless the configuration selects fewer formats. The folder must be outside source.
GUI starts the browser workbench; open the URL printed at startup.
AI options (CLI and GUI): --env-file FILE --ai [--ai-provider ollama|openai|claude|openrouter|openai-compatible]
  --ai-base-url URL --ai-model MODEL --ai-api-key-env NAME --allow-source-transmission
  --ai-mode architecture|advisory --ai-max-source-bytes BYTES --ai-timeout-seconds SECONDS
  --no-ai disables deployment defaults. Keys are read from environment variables, never CLI literals.
GUI --config FILE sets trusted appliance defaults. AI endpoint and credential variable are operator-pinned.
portable uses npm-installed scanners and HTML/JSON/SARIF; full also enables native tools and PDF.
Explicit JSON settings override profile defaults; missing enabled tools remain unavailable.
The audit and serve commands remain aliases for existing automation.
Exit codes: 0 passed, 1 quality gate, 2 scanner/report failure, 3 invalid input.
Audit configuration can override nonzero exit codes.
`;


/** Reject flags that do not apply to the selected mode rather than silently ignoring user settings. */
const validateOptions = (command: string, values: Record<string, string | boolean | undefined>): void => {
	const aiOptions = ['env-file', 'ai', 'no-ai', 'ai-provider', 'ai-base-url', 'ai-model', 'ai-api-key-env', 'allow-source-transmission', 'ai-mode', 'ai-max-source-bytes', 'ai-timeout-seconds'];
	const auditOptions = ['source', 'output', 'config', 'profile', 'help', ...aiOptions];
	const guiOptions = ['source', 'data', 'host', 'port', 'profile', 'config', 'help', ...aiOptions];
	const optionsByCommand: Record<string, string[]> = { cli: auditOptions, audit: auditOptions, gui: guiOptions, serve: guiOptions };
	const allowed = optionsByCommand[command] ?? ['help'];

	for (const [option, value] of Object.entries(values)) {
		if (value !== undefined && !allowed.includes(option)) {
			throw new Error(`--${option} is not supported in ${command} mode`);
		}
	}
	if (command === 'cli' && !values.output) {
		throw new Error('CLI mode requires --output FOLDER outside the audited source');
	}
};


/** Execute strict CLI commands and report machine-readable outcomes; errors use the configuration exit code. */
const main = async (): Promise<void> => {
	const { values, positionals } = parseArgs({
		allowPositionals: true,
		strict: true,
		options: {
			source: { type: 'string' },
			output: { type: 'string' },
			config: { type: 'string' },
			data: { type: 'string' },
			profile: { type: 'string' },
			host: { type: 'string' },
			port: { type: 'string' },
			help: { type: 'boolean' },
			'env-file': { type: 'string' }, ai: { type: 'boolean' }, 'no-ai': { type: 'boolean' },
			'ai-provider': { type: 'string' }, 'ai-base-url': { type: 'string' }, 'ai-model': { type: 'string' },
			'ai-api-key-env': { type: 'string' }, 'allow-source-transmission': { type: 'boolean' },
			'ai-mode': { type: 'string' }, 'ai-max-source-bytes': { type: 'string' }, 'ai-timeout-seconds': { type: 'string' },
		},
	});
	const command = positionals[0] ?? 'help';

	if (values.help || command === 'help') {
		process.stdout.write(help);
		return;
	}
	if (positionals.length !== 1) {
		throw new Error('Expected one command');
	}
	validateOptions(command, values);
	if (values.profile !== undefined && !['full', 'portable'].includes(values.profile)) {
		throw new Error('--profile must be full or portable');
	}
	const profile = (values.profile ?? 'full') as AuditProfile;
	if (values['env-file']) process.loadEnvFile(values['env-file']);

	if (command === 'schema') {
		process.stdout.write(`${JSON.stringify(configSchema, null, 2)}\n`);
		return;
	}
	if (command === 'cli' || command === 'audit') {
		const config = await loadConfig(values.config ?? environmentSetting('CONFIG_FILE'), profile, aiCommandOptions(values));

		try {
			const result = await runAudit(config, { source: values.source, output: values.output });

			const summary = {
				id: result.id,
				outputDirectory: await realpath(values.output ?? config.reports.outputDirectory),
				score: result.scores.overall,
				coverage: result.scores.coverage,
				ci: result.ci,
				reports: result.reports,
			};

			process.stdout.write(`${JSON.stringify(summary)}\n`);
			process.exitCode = result.ci.exitCode;
		} catch (error) {
			process.exitCode = error instanceof ReportFailure ? config.ci.exitCodes.scanner : config.ci.exitCodes.configuration;
			throw error;
		}
		return;
	}
	if (command === 'gui' || command === 'serve') {
		const { createServer } = await import('./server.js');
		const defaults = await loadConfig(values.config ?? environmentSetting('CONFIG_FILE'), profile, aiCommandOptions(values));
		const port = Number(values.port ?? process.env.PORT ?? 3000);
		const host = values.host ?? process.env.HOST ?? '127.0.0.1';
		const sourceRoot = values.source ?? environmentSetting('SOURCE_ROOT') ?? process.cwd();
		const dataDirectory = values.data ?? environmentSetting('DATA_DIRECTORY') ?? join(process.env.XDG_STATE_HOME ?? join(homedir(), '.local', 'state'), 'antislopscan');
		const origin = environmentSetting('ORIGIN') ?? `http://localhost:${port}`;

		if (!Number.isInteger(port) || port < 1 || port > 65535) {
			throw new Error('Invalid server port');
		}
		const server = await createServer({
			sourceRoot,
			dataDirectory,
			profile,
			origin,
			token: environmentSetting('API_TOKEN'),
			defaultConfig: defaults,
			allowAi: defaults.ai.enabled || environmentSetting('ALLOW_AI') === 'true',
			aiBaseUrl: defaults.ai.baseUrl,
			aiApiKeyEnv: defaults.ai.apiKeyEnv,
			aiProvider: defaults.ai.provider,
			retention: Number(environmentSetting('RETENTION') ?? 100),
		});

		/** Drain server work on process termination without terminating in-flight requests early. */
		const shutdown = async (): Promise<void> => { log('info', 'shutdown_requested'); await server.close(); };
		/** Own signal-handler rejections at the process boundary. */
		const stop = (): void => { shutdown().catch(failed); };

		process.once('SIGTERM', stop);
		process.once('SIGINT', stop);
		await server.listen({ host, port });
		log('info', 'server_started', { port });
		process.stdout.write(`${JSON.stringify({ mode: 'gui', url: origin, sourceRoot: await realpath(sourceRoot), dataDirectory: await realpath(dataDirectory) })}\n`);
		return;
	}
	throw new Error('Unknown command; use --help');
};


/** Emit a safe process-boundary error and preserve an already selected nonzero exit code. */
const failed = (error: unknown): void => {
	log('error', 'command_failed', { message: error instanceof SyntaxError ? 'Invalid JSON input or tool output' : error instanceof Error ? redact(error.message).slice(0, 1000) : 'Unknown failure' });
	process.exitCode ||= 3;
};

await main().catch(failed);
