# LLM architecture review

AntiSlopScan supports native Ollama, OpenAI Chat Completions, native Claude
Messages, OpenRouter, and other OpenAI-compatible servers. AI is optional.
Distributed defaults keep AI and source transmission disabled. This checkout's
ignored `.env` explicitly enables the user's existing local provider Ollama connection.

## CLI

```sh
antislopscan cli --source /path/to/repository --output /path/to/reports \
  --ai --ai-provider ollama --ai-base-url http://localhost:11434 \
  --ai-model YOUR_INSTALLED_MODEL --allow-source-transmission
```

Or use this checkout's trusted defaults:

```sh
npm run cli -- --source /path/to/repository --output /path/to/reports
# Installed binary: dotenv files are only loaded when explicitly selected.
antislopscan cli --env-file /path/to/operator.env \
  --source /path/to/repository --output /path/to/reports
```

AI precedence is built-in defaults, deployment environment, trusted JSON,
then explicit CLI flags.
`ANTISLOPSCAN_CONFIG_FILE` can select a trusted default JSON file; `--config`
overrides it. Provider changes apply their endpoint/key-variable preset within
each layer, avoiding accidental reuse of a previous provider's endpoint.
Existing environment variables retain Node's normal
precedence over dotenv values. The installed binary never automatically loads
a repository's `.env`. The checkout's npm cli/gui/start/audit scripts load
its own optional `.env`. Neither path executes shell startup files.

Flags: `--ai`, `--no-ai`, `--ai-provider`, `--ai-base-url`, `--ai-model`,
`--ai-api-key-env`, `--allow-source-transmission`,
`--ai-mode architecture|advisory`, `--ai-max-source-bytes`,
`--ai-timeout-seconds`, and `--env-file`.
`--ai` selects architecture grading; `--no-ai` overrides enabled deployment
defaults. Keys are referenced by environment variable name; there is no raw-key
CLI option.

## Providers

| Provider | Base URL | Protocol | Typical credential variable |
| --- | --- | --- | --- |
| `ollama` | `http://localhost:11434` | Native `/api/chat`, nonstreaming structured JSON | Optional `AUDIT_AI_API_KEY` |
| `openai` | `https://api.openai.com/v1` | `/chat/completions`, `max_completion_tokens` | `OPENAI_API_KEY` |
| `claude` | `https://api.anthropic.com/v1` | `/messages`, version `2026-10-21` | `ANTHROPIC_API_KEY` |
| `openrouter` | `https://openrouter.ai/api/v1` | OpenAI-compatible chat | `OPENROUTER_API_KEY` |
| `openai-compatible` | Operator-provided API prefix, usually ending in `/v1` | Chat Completions | Operator-selected variable |

Choose an actually available model identifier from your provider. No cloud model
is silently selected or substituted. Set credentials in the process environment
or a private operator dotenv file. Do not put literal keys in JSON or command
arguments. Ollama supports `ollama list` for installed model discovery.
Use a workspace-scoped Claude API key. Unscoped keys requiring the additional
`anthropic-workspace-id` header are not currently supported by this adapter.

Official protocol references:
[Ollama chat](https://docs.ollama.com/api/chat),
[OpenAI Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create),
[Claude authentication](https://platform.claude.com/docs/en/api/overview),
[Claude Messages](https://platform.claude.com/docs/en/api/messages/create),
[OpenRouter](https://openrouter.ai/developers).
Transport is dependency-free Node fetch; no provider SDK is required.

## JSON

```json
{
  "ai": {
    "enabled": true,
    "provider": "ollama",
    "baseUrl": "http://localhost:11434",
    "model": "qwen3.5:latest",
    "apiKeyEnv": "AUDIT_AI_API_KEY",
    "allowSourceTransmission": true,
    "mode": "architecture",
    "timeoutSeconds": 180,
    "maxSourceBytes": 32768,
    "maxFiles": 24,
    "maxTokens": 8192,
    "batchSize": 14
  }
}
```

This is the verified local provider address, derived from the user's existing Ollama
connection. Its Ollama endpoint is HTTP on port 11434; using HTTPS on the default
port failed hostname verification. No TLS checks were disabled. The installed
`qwen3.5:latest` model completed a real 56-principle assessment. Its
availability and output quality are deployment-specific.

Source limits cap unique redacted source windows, not whole-repository coverage.
The collector prioritizes static risk indicators and spreads other samples across
paths. It transmits up to 100 lines per selected file, then enforces the byte
budget. All source comments are masked before sampling, including inline and
multiline comments throughout a file. Original line numbers and columns remain
valid; comments cannot supply a principle citation or a grade. Quoted code data
is preserved. Optional architecture documents supply requirements context.
Excerpts are numbered by the appliance; model output selects reference IDs.
Paths, ranges and quotes are resolved and checked by the appliance.

Supplied `architecture.documents` are optional, confined source-relative Markdown
or text inputs. `architecture.requirements` provide explicit capability contracts.
Without requirements or runtime evidence, many principles remain unassessable.
Increase limits deliberately and stay within the chosen model's context window.
Native Ollama requests use a 32K context window; larger budgets are not a claim
that every selected model can consume them. Token limits and batch size remain
configurable in JSON. The outer audit deadline bounds the whole review.

## GUI and API

```sh
antislopscan gui --source /path/to/repositories --data /path/to/state \
  --config /path/to/operator-config.json --port 3000
# Or, in this checkout:
npm run gui
```

Open **New assessment > LLM architecture assessment**. Adjust the model, sample
budget, maximum files, per-batch timeout, review mode and source consent.
The JSON editor remains authoritative; provider fields update the same JSON.
Malformed JSON is preserved and must be repaired before form editing.

The appliance operator pins the provider protocol, base URL and credential
environment variable through CLI/config/environment settings. API clients cannot
redirect source or credentials to another endpoint. Changing provider requires
updating these trusted deployment settings and restarting the GUI process.
The default-config endpoint returns policy and nonsecret settings, never keys.

Architecture review shows 14 principles per page with domain/status/search
filters, source citations, source-sampling coverage and model/rubric provenance.
Original Imagegen illustrations explain conceptual patterns. Expanded explanations
use six-frame GIFs; the pause control, reduced motion and hidden documents select
static posters. They do not represent discovered project architecture.

## Docker and network access

Normal scans can still use `--network none` and leave AI disabled.
An LLM request requires explicit provider network access:

```sh
docker run --rm --network bridge --env-file /path/to/operator.env \
  -v /path/to/source:/workspace:ro -v /path/to/reports:/reports \
  antislopscan:latest cli --source /workspace --output /reports
```

Compose forwards named `ANTISLOPSCAN_AI_*` settings and the standard credential
variables. It mounts the JSON policy selected by `ANTISLOPSCAN_CONFIG_FILE`
read-only as `/config/operator.json`; the distributed default is an empty policy.
The API bounds each request against trusted operator limits. Private policy is
excluded from Docker context and npm publication.
The credential variables are shown in `.env.example`. Its network remains internal unless the
operator sets `ANTISLOPSCAN_NETWORK_INTERNAL=false`. Enabling egress
allows outbound connections from the appliance, including scanner processes;
it is not per-process network isolation. Scanner child environments do not receive
provider keys, and repository code/configuration is still never executed.

When changing the existing Compose network's internal flag, recreate the network:

```sh
docker compose down
docker compose up -d --no-build
```

Do not use `down -v`; the existing history volume must be retained. Wait for
active audits to finish before restarting.

## Scores, failures and reports

`result.aiArchitecture` is optional so existing audit records remain readable.
It stores provider/model/rubric, completed or partial status, sample counts,
56 requested principle assessments, confidence, exact citations, errors and a
separate aggregate score.

Rubric v1: supported local contract 80–100; potential design risk 40–79;
evidence of violating a supplied requirement/contract 0–39. A score requires a
known source citation and estimated confidence of at least 60%. Unassessable or
inapplicable principles have null scores. The aggregate is the rounded arithmetic
mean of eligible scores; a partial run has no aggregate. Confidence is not a
calibrated probability, and valid citations do not prove semantic correctness.

Deterministic overall/category/erosion scores and quality thresholds are unchanged.
LLM risk observations enter canonical findings as informational and have no
default numeric penalty. AI execution failures still reduce tool execution
coverage and follow the configured scanner-error CI policy. No AI failure is
presented as a passing review. Source-only analysis cannot establish all runtime
or business architecture properties.

JSON carries the full review; standalone HTML and PDF include the score, methods
and all per-principle citations; SARIF retains review metadata and informational
AI findings. Existing reports are never rewritten by enabling a provider.
Legacy `mode: "advisory"` retains the bounded, unscored observation workflow.
