# antislopscan

[![CI](https://github.com/jfscoertzen/AntiSlopScan/actions/workflows/ci.yml/badge.svg)](https://github.com/jfscoertzen/AntiSlopScan/actions/workflows/ci.yml)

<img src="assets/branding/antislopscan-mark.png" alt="antislopscan inspection mark" width="96" height="96">

An Apache-2.0, self-hosted repository audit appliance. It combines independent
architecture analysis with installed static-analysis tools, produces HTML, PDF,
JSON and SARIF, and records scanner failures separately from quality findings.

Core analysis works offline after installation. It does not require AI services,
install audited dependencies, run repository scripts, or load repository lint
configuration. Scans use bounded, private source snapshots.

The review workbench and standalone HTML reports offer light, dark, and system
appearance. Evidence dashboards drill into severity, category, rule, file, and
scanner slices. Advanced filters add assessment, detection method, confidence,
and sorting; the frontend exports the complete filtered selection as JSON.
Native finding disclosures expose evidence, remediation, provenance, and curated
online documentation. Reading reports and using filters requires no network;
reference links navigate externally only when clicked. PDF uses an expanded,
white A4 publication layout with a branded cover, quality gauge, illustrated
principle guide, labeled static/LLM assessments, complete evidence appendices and
global page numbers. HTML embeds the same local artwork and supports seven saved
accent colors. Print uses static illustrations and omits interactive controls;
JSON/SARIF retain their machine-readable contracts. All formats preserve the
same audit values and confidence limits. Brand provenance and the generation prompt are recorded in
[`assets/branding/README.md`](assets/branding/README.md).

The intelligence workbench starts in dark mode with a teal accent and preserves
existing saved preferences. Under **Appearance settings**, choose light, dark,
or system appearance and one of seven accent colors, including neutral gray.
Pause **Background motion** there; reduced-motion preferences and hidden tabs
also stop the illustrative flow. Appearance, accent, and motion are saved
independently in your browser.

The score-led summary keeps CI status separate from quality. The Architecture
dependency explorer draws bounded, actual module relationships with path search,
runtime/type distinction, module inspection, and evidence drill-down. Its radial
layout does not imply layers or causal loops. Original Imagegen background and
empty-state graphics have recorded prompts in
[`intelligence/README.md`](assets/branding/intelligence/README.md). They are
illustrative identity assets, separate from measured graph data.

## Install the npm CLI

Download the Linux x86_64 release archive from [GitHub Releases](https://github.com/jfscoertzen/AntiSlopScan/releases), extract it, and run `bin/antislopscan cli --profile portable --source /path/to/repository --output /path/to/reports`. The archive includes the Node executable and bundled application dependencies. It requires a compatible glibc-based Linux system and `prlimit`; the portable profile produces HTML, JSON and SARIF.

The npm release currently targets Linux x86_64 with glibc and Node 22.22.3+.
Build an installable release from this checkout:

```sh
npm ci
npm run package
npm install --global --ignore-scripts ./artifacts/antislopscan-1.0.0-alpha.1.tgz

antislopscan cli --profile portable --source /path/to/repository --output /path/to/reports
antislopscan gui --profile portable --source /path/to/repository
```

The tarball contains compiled CLI/UI assets, vendored rules and notices, and all
production npm dependencies verified against the authoritative lockfile. It can
be installed with an empty npm cache offline; no TypeScript build or project
checkout is needed. `portable` runs the independent engine,
ESLint, SlopScore, Oxlint, vendored Anti-Slop, jscpd, and dependency-cruiser, and
writes HTML, JSON and SARIF. Linux also requires util-linux's `prlimit`.

`full` is the default profile for existing Docker/CLI automation. It additionally
enables the native/Python scanners and PDF. Profiles supply defaults; explicit
JSON settings override them. Missing enabled tools and failed PDF rendering
remain visible and produce a failing operational status.

For full npm installation prerequisites and maintainer publication commands, see
[`docs/NPM_DISTRIBUTION.md`](docs/NPM_DISTRIBUTION.md). After this package is
published to the public npm registry, the registry installation command is
`npm install --global antislopscan`. Until publication, install the built tarball.

## Choose CLI or GUI

After completing the local installation below, run either mode from this checkout:

```sh
# CLI: write reports into the exact folder you choose.
./antislopscan cli --source /path/to/repository --output /path/to/reports

# GUI: start the browser workbench and open http://localhost:3000.
./antislopscan gui --source /path/to/repository
```

`cli` requires `--output`. It creates that folder if needed, writes the configured
HTML/PDF/JSON/SARIF reports there, prints its absolute location in the JSON
summary, and exits with the CI status. Keep the folder outside the source tree.
Quote paths containing spaces. Add `--config /path/to/config.json` to select an
audit policy. CLI mode starts no web server.

`gui` serves the web interface and REST API until stopped with Ctrl+C. `--source`
chooses the permitted repository root; it defaults to the current directory for
local execution. `--data /path/to/state` chooses persistent history and GUI report
storage. Its local default is `$XDG_STATE_HOME/antislopscan`, or
`~/.local/state/antislopscan` when that variable is unset. The container uses
`/workspace` and `/data`. Configure individual GUI audits in the browser.

The same modes are available as `npm run cli -- ...` and `npm run gui -- ...`.
After building, `npm link --ignore-scripts` optionally installs the
`antislopscan` command on your PATH from this checkout. `audit` and `serve` remain
compatible command aliases. `./antislopscan --help` lists modes and flags.
Docker users can select CLI or GUI as shown next without host development tools.

## Run with Docker

The alpha image is published as `jfscoertzen/antislopscan:alpha`. For a one-shot offline scan, mount your source read-only and a writable reports directory:

```sh
docker run --rm --network none \
  -v /path/to/source:/workspace:ro -v /path/to/reports:/reports \
  jfscoertzen/antislopscan:alpha cli --source /workspace --output /reports
```

The image runs as UID 1000; ensure the reports directory is writable by that user. For a self-hosted GUI, clone this repository and use the Compose command below. Release tags publish a versioned Docker image and a Linux x86_64 executable distribution through GitHub Actions; alpha builds are prereleases.

The pinned native bundle currently targets **Linux x86_64**. Build with Docker:

```sh
docker build --platform linux/amd64 -t antislopscan:latest .
mkdir -p /path/to/reports
docker run --rm --network none \
  --read-only --cap-drop ALL --security-opt no-new-privileges \
  --pids-limit 256 --memory 4g --cpus 4 \
  --tmpfs /tmp:size=1073741824,mode=1777 \
  -v /path/to/source:/workspace:ro \
  -v /path/to/config.json:/config/config.json:ro \
  -v /path/to/reports:/reports \
  antislopscan:latest cli --source /workspace \
  --config /config/config.json --output /reports
```

The container runs as UID/GID 1000. The reports mount must be writable by that
identity; source must be readable. Report output must be outside the audited
repository. A configuration file is optional; use `config/example.json` to begin.
Reports are `report.html`, `report.pdf`, `report.json`, and `report.sarif.json`.

Run the GUI appliance (the image defaults to `gui`):

```sh
ANTISLOPSCAN_SOURCE=/absolute/path/to/repositories docker compose up -d --build
```

Open [localhost:3000](http://localhost:3000). Enter `.` for the mounted root or a
relative path such as `services/api`. History and report artifacts persist in the
`codesentry-data` volume (its legacy storage key is retained to preserve history
when upgrading). The Compose network is internal, ports bind to host
loopback through a small unprivileged Nginx gateway, and source is mounted read-only.
The gateway has no source/data mounts and forwards only to the application; the
application/scanners join only the isolated network without outbound access.
Set `ANTISLOPSCAN_API_TOKEN` in the
operator environment to require bearer authentication; the UI keeps it in memory.

Use the one-shot mode in CI. Default exit codes are **0** passed, **1** quality
gate, **2** scanner/report failure, **3** configuration/input failure. Individual
nonzero codes are configurable under `ci.exitCodes`. Missing enabled scanners
fail when `audit.failOnScannerError` is true. Coverage and score thresholds remain
separate. Disabling CI score thresholds does not hide execution failures.

## Local development

Node 22.22.3 or later, Python 3.11+, and Linux x86_64 are needed for the full local
toolchain. Docker users do not need these tools on the host.

```sh
npm ci
python3 -m venv tools/python
tools/python/bin/pip install -r tools/requirements.lock
sh scripts/install-native-tools.sh
node node_modules/playwright/cli.js install --with-deps chromium
npm run build
npm test
npm run test:e2e
ANTISLOPSCAN_SOURCE_ROOT=/absolute/path/to/repositories \
  ANTISLOPSCAN_DATA_DIRECTORY=/tmp/antislopscan-data npm start
```

Installation scripts are disabled for npm dependencies. Scanner binaries are
installed by explicit commands with pinned versions; native downloads have
SHA-256 checks. For a read-only global npm cache, pass `--cache=/tmp/antislopscan-npm`
to install commands. The application build exports its JSON Schemas and bundles
all Vue assets locally. `npm run self-audit` audits this project and writes its
reports to `/tmp/antislopscan-self-audit`.

For offline web installation, pull the pinned gateway image once with
`docker compose pull gateway`. Transfer both images with `docker save`/`docker load`
when installing on an offline host; subsequent audits need neither registries nor
external services. The one-shot CLI uses only the antislopscan image.

## Configuration and policy

[`schemas/audit-config.schema.json`](schemas/audit-config.schema.json) is the
complete schema; unknown scanner arguments and configuration keys are rejected.
[`config/example.json`](config/example.json) shows a minimal complete workflow.
Run `node dist/cli.js schema` to print the same schema.

All sections accept defaults. `projects` maps project names to partial overrides
and is applied after the base settings when `project.name` matches. Arrays replace
base arrays. `rules.exclude` accepts rule-ID globs, `rules.severity` overrides
severity by ID, and `rules.weights` supplies penalty multipliers. Rule IDs appear
in canonical JSON and both human-readable reports.

```json
{
  "project": { "name": "Payments" },
  "projects": {
    "Payments": { "architecture": { "maxComplexity": 15 } }
  },
  "architecture": {
    "boundaries": [
      {
        "from": "src/domain/**",
        "disallow": ["src/http/**", "src/database/**"],
        "reason": "Domain policy must remain independent of transport and storage."
      }
    ],
    "documents": ["docs/architecture.md"]
  },
  "rules": { "severity": { "architecture/boundary": "major" } }
}
```

Optional `architecture.requirements` connects a declared timeout, bounded-queue,
or idempotency requirement to file globs. Missing local keywords are review
indicators, not proof of missing runtime behavior. Documentation is preserved as
evidence input; deterministic analysis does not infer requirements from prose.

Scores describe findings supported by completed scanners. Informational and
unassessable principles receive no penalties. Each report explains the formula,
tool execution coverage, confidence, and limitations. A score of 100 does not
mean all design principles or vulnerabilities have been assessed.

## Historical comparison

For CLI audits, set `ci.baseline` to an earlier canonical `report.json`. For API
audits, use `baselineId`. Project name, canonical source path, and analysis policy
must match. Structural measurement deltas include cycles, boundary violations,
coupling, complexity, duplication indicators, and root dependency names. With no
baseline, the report labels its score **current structural risk**. Git churn,
co-change, and defect inference are not implemented.

`ci.failOnNewHighSeverityFindings` requires a compatible baseline. Findings use
content-based fingerprints, so moving evidence does not automatically make it
new. Changing the evidence or renaming its file can produce a new fingerprint.
Keep mount paths stable between CI baseline comparisons.

## REST API

The same process serves the UI and API. Requests accept only mounted-workspace
relative source paths. The API has a five-job queue, executes one audit at a time,
and limits individual audit resources to the default appliance caps.

```sh
curl -H "Authorization: Bearer $ANTISLOPSCAN_API_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"source":"my-project","config":{"project":{"name":"My project"}}}' \
  http://localhost:3000/api/audits

curl -H "Authorization: Bearer $ANTISLOPSCAN_API_TOKEN" \
  http://localhost:3000/api/audits/AUDIT_UUID
```

- `GET /health`: process liveness.
- `GET /api/config/default`: defaults and configuration schema.
- `POST /api/audits`: submit `{source, config?, baselineId?}`; returns HTTP 202.
- `GET /api/audits?limit=25&offset=0`: paginated summaries, at most 100 per page.
- `GET /api/audits/:id`: job state and canonical result when complete.
- `GET /api/audits/:id/reports/:format`: authenticated attachment download.

By default, local development binds to 127.0.0.1. `HOST`, `PORT`,
`ANTISLOPSCAN_ORIGIN`, `ANTISLOPSCAN_SOURCE_ROOT`, `ANTISLOPSCAN_DATA_DIRECTORY`,
`ANTISLOPSCAN_API_TOKEN`, and `ANTISLOPSCAN_RETENTION` configure deployment. Retention
defaults to 100 completed/failed audits. One process owns the SQLite volume; do
not run multiple replicas against the same database.

The corresponding `CODESENTRY_*` environment names remain fallback aliases for
existing installations; explicit `ANTISLOPSCAN_*` values take precedence. Compose
also accepts the former `CODESENTRY_SOURCE` and `CODESENTRY_API_TOKEN` settings.
Original code headers, the package/bin name, UI, reports, schema identifiers, logs,
and container image now use `antislopscan`; the existing SQLite history is retained.

## Code-only analysis

Code checks and LLM source samples exclude comments throughout each source file.
Comments are masked in a private scanner copy; the repository, original hashes
and line references are preserved. DRY compares implementation, and module-size
and score-density metrics count nonblank code lines. Comment-hygiene rules are
disabled. Literal strings and regular expressions remain source data.

This policy also excludes comment-only secrets from credential scanning. Explicit
architecture documents remain requirements context. Previous reports retain
their original evidence; rerun an audit to apply the new policy. Old and new
policies have different fingerprints and cannot be compared as measured erosion.

## Optional AI review

LLM architecture grading now supports Ollama, OpenAI, Claude, OpenRouter and
OpenAI-compatible providers through JSON, explicit CLI flags, trusted environment
defaults and the assessment form. Principles show separate sample-based grades,
verified source citations, coverage and model provenance; static scores retain
their existing semantics. See [LLM setup and scoring](docs/LLM_SETUP.md) for
provider commands, Docker network settings, source consent and failure handling.

AI is disabled by default. Enabling it requires `ai.enabled=true`, an explicit
model, an HTTP(S) `baseUrl`, and `ai.allowSourceTransmission=true`. API jobs also
require operator opt-in (`ANTISLOPSCAN_AI_ENABLED=true`, explicit GUI CLI/config
settings, or the legacy `ANTISLOPSCAN_ALLOW_AI=true`) and an operator-pinned URL.
API requests must use that provider URL and the operator's
`ANTISLOPSCAN_AI_API_KEY_ENV` (default `AUDIT_AI_API_KEY`); clients cannot choose an
arbitrary credential environment variable or redirect credentials elsewhere. The API key is read
from the environment variable named by `ai.apiKeyEnv`; it is never passed to
scanner subprocesses or stored in reports. Provider-specific presets choose the
official endpoint and key-variable name unless explicitly overridden.

Only a bounded, redacted sample is sent. No redirects are followed. Repository
text is marked as untrusted data and model responses are validated against the
sample's files/lines. Prompt-injection resistance is not a model guarantee, so
model observations remain informational and do not change deterministic scores.
The separate LLM score exposes its own evidence, rubric and coverage. Outbound
connectivity must be explicitly provided for AI; the default Compose network
and one-shot `--network none` intentionally prevent it.

## Security and supported analysis

See [`docs/SECURITY.md`](docs/SECURITY.md),
[`docs/TOOL_RESEARCH.md`](docs/TOOL_RESEARCH.md), and
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md). Core JS/TS parsing includes
Vue script blocks. Python checks run through Ruff, Radon, Semgrep, and applicable
slop tools. Other recognized languages receive the checks their installed
adapters support. No framework capability is assumed from a directory name.

Knip, full TypeScript project compilation, Clippy, PMD, Checkstyle, clang-tidy, and
SonarQube are explicit unavailable adapters when enabled. They never emit invented
findings or passing statuses. The reasons and integration constraints are in the
tool research document. This is a functioning static audit appliance; it is not a
replacement for behavioral tests, runtime architecture evidence, or expert review.

Architecture and implementation progress are maintained in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and
[`docs/PROJECT_PLAN.md`](docs/PROJECT_PLAN.md). Verification evidence is recorded
in [`docs/VALIDATION.md`](docs/VALIDATION.md).
