# antislopscan architecture

antislopscan is a TypeScript modular monolith with a Vue interface, Fastify API,
SQLite history, and isolated scanner processes. Core audits need no external
service. Source repositories are data, never executable configuration.

Compose adds an unprivileged Nginx gateway solely for network isolation. Docker's
internal application network did not publish a reachable host port in deployment
verification. The gateway joins frontend and internal networks, publishes localhost
port 3000, and forwards to the monolith. It has no source or history mounts.
The gateway streams upstream responses with `proxy_buffering off`, avoiding
temporary-file spooling into its 16 MiB tmpfs for large PDF/HTML downloads. This
changes delivery buffering only; report content and API endpoints are unchanged.
See the [Nginx directive documentation](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_buffering).

## Entry points and connections

[`cli.ts`](../src/cli.ts) invokes [`orchestrator.ts`](../src/orchestrator.ts) for
`cli` one-shot audits or starts [`server.ts`](../src/server.ts) through `gui`.
The executable [`antislopscan`](../antislopscan), npm scripts, and npm bin all reach
this entry point. CLI mode requires `--output`, publishes only into that folder,
and prints its canonical location and exit status. GUI accepts `--source` and
`--data`, prints the browser URL, and owns the server lifecycle. `audit`/`serve`
remain compatible aliases. [`environment.ts`](../src/environment.ts) resolves
`ANTISLOPSCAN_*` settings before legacy `CODESENTRY_*` fallbacks. The server serves the
built [`Vue workbench`](../ui/App.vue), validates HTTP authority and source paths,
and submits work to [`jobs.ts`](../src/jobs.ts). Its bounded queue executes one
audit at a time. [`history.ts`](../src/history.ts) owns one SQLite connection,
indexed pagination, canonical results, restart recovery, and retention.

`--profile portable` layers Node-only scanner and HTML/JSON/SARIF defaults before
explicit JSON/project settings. `full` retains native/Python/PDF defaults. The
GUI passes the operator-selected profile to its configuration and job endpoints.
Missing explicitly enabled prerequisites still fail rather than disappearing.

The npm package carries compiled application/UI code and the verified production
dependency tree. [`security/installation.ts`](../src/security/installation.ts)
locates fixed scanner entry points from this installation's npm resolution paths,
with a legacy checkout fallback; audited repository configuration never chooses
binaries. [`build-vendor.mjs`](../scripts/build-vendor.mjs) transpiles trusted
MIT rule sources to `dist/vendor/anti-slop` because Node does not strip types in
`node_modules`. Sources, license, and provenance remain included. The package
currently targets Linux x86_64/glibc for its bundled scanner bindings.

The tag-triggered [release workflow](../.github/workflows/release.yml) builds
the same verified Docker image used by CI. The
[`create-release.sh`](../scripts/create-release.sh) script extracts its bundled
npm archive and Node executable into a portable Linux x86_64 distribution;
the portable profile requires host glibc and `prlimit`. The workflow checks
the tag against `package.json`, tests the extracted launcher, publishes Docker
Hub version/alpha tags, and creates a GitHub prerelease with SHA-256 checksums.
Docker Hub credentials enter only through the `DOCKER_TOKEN` Actions secret.

[`prepare-package.mjs`](../scripts/prepare-package.mjs) verifies installed versions
against the authoritative lockfile and copies release provenance into config.
[`package.mjs`](../tests/package.mjs) installs the actual tarball offline into
fresh global/local prefixes, executes the npm scanner set, verifies report
folders, and starts/stops the packaged GUI. No developer installation is reused.

The orchestrator connects the following responsibilities in order:

1. [`config.ts`](../src/config.ts) validates against
   [`config-schema.ts`](../src/config-schema.ts), applies project overrides, and
   fingerprints the effective policy and pinned tool versions.
2. [`security/paths.ts`](../src/security/paths.ts) confines paths.
   [`security/snapshot.ts`](../src/security/snapshot.ts) inventories and copies
   bounded source through no-follow descriptors. Symlinks and repository
   executable configuration are excluded. Private agent settings (`.codex`,
   `.agents`), AWS credentials (`.aws`), and npm caches (`.npm-cache`) are never
   traversed. Package metadata contributes names only.
3. [`scanners/registry.ts`](../src/scanners/registry.ts) implements the common
   [`ScannerAdapter`](../src/domain.ts) contract for every internal/external tool.
   [`catalog.ts`](../src/scanners/catalog.ts) declares versions, languages,
   categories, and reasons for integrations that remain unavailable.
4. [`security/process.ts`](../src/security/process.ts) runs fixed appliance
   binaries with a clean environment, output limits, process-group cleanup,
   deadlines, Node heap limits, and Linux resource controls.
   [`worker.ts`](../src/worker.ts) isolates the core engine and
   [`ESLint`](../src/scanners/eslint.ts). [`external.ts`](../src/scanners/external.ts)
   generates trusted tool configuration. [`normalize.ts`](../src/scanners/normalize.ts)
   rejects malformed scanner output rather than inventing a clean result.
   SlopScore uses its UTF-8 `--out` file mode because its immediate `process.exit`
   can truncate large piped JSON. File-based scanner reports are checked against
   the configured output cap before parsing, alongside subprocess/file limits.
5. [`findings.ts`](../src/findings.ts) redacts, fingerprints, and deduplicates
   findings, preserving provenance and the strongest supported assessment.
   [`scoring.ts`](../src/scoring.ts) calculates evidence-density scores and
   separate quality, coverage, execution, and artifact-generation CI gates.
6. [`analysis/erosion.ts`](../src/analysis/erosion.ts) compares compatible
   measurements. Without a baseline its result is labeled current structural risk.
7. [`reports/index.ts`](../src/reports/index.ts) stages artifacts from the canonical
   result, records PDF failure explicitly, calculates the final CI decision, and
   publishes files. [`result-schema.ts`](../src/result-schema.ts) validates
   canonical JSON before publication or baseline use.
8. The orchestrator removes the source snapshot in `finally`. API jobs persist
   the result; CLI jobs return the configured exit code.

## Comment exclusion and source views

[`security/code-snapshot.ts`](../src/security/code-snapshot.ts) derives a second,
read-only scanner view from the bounded original snapshot. Every scanner consumes
the code view; original file hashes, physical inventory counts and optional report
context remain tied to the untouched source. Both snapshots are removed in the
orchestrator's `finally` path. Temporary source storage can reach twice the
configured repository limit. Failure to construct the view fails the audit rather
than silently scanning unfiltered text.

[`analysis/comments.ts`](../src/analysis/comments.ts) uses TypeScript compiler
locations for JS/TS/JSX, Vue script/template parsing, and lexical comment spans for
other supported languages. Comments become spaces, retaining UTF-16 columns and
newlines. Quoted/raw strings, regex literals and template text remain code data.
Non-JS/TS lexical handling is not a complete semantic parser. Native language
adapters retain their existing syntax/error reporting.

The core clone engine compares nonblank code lines, retaining original positions.
Module metrics and score density also use nonblank code lines. Comment-only
markers and decorative-comment rules are disabled, as is the Oxlint rule requiring
a safety comment. SlopScore physical-size rule 055 is replaced by the core code-line
metric; jscpd explicitly uses `--skip-comments`. LLM source windows and citations
come exclusively from the code view. Supplied architecture documents remain
optional requirements context and cannot independently earn a source-backed grade.
The `code-only-v1` policy marker changes the configuration fingerprint so audits
using the previous comment policy cannot become a misleading erosion baseline.

## Review and reporting presentation

[`review.ts`](../src/review.ts) is a browser-safe, pure module shared by the
frontend and reports. It groups complete canonical findings, applies exact
composable filters and deterministic sorting, and resolves curated HTTPS issue
references. Finding text cannot supply a destination URL. Links use no-referrer
navigation, and neither report reading nor dashboard interactions fetch external
data. Documentation may describe a newer tool version; execution versions remain
the pinned versions displayed with the scan.

[`App.vue`](../ui/App.vue) owns configuration, history, authentication, downloads,
and selected audit state. [`AuditDashboard.vue`](../ui/AuditDashboard.vue) emits
exact evidence slices to [`FindingsExplorer.vue`](../ui/FindingsExplorer.vue),
which filters before 50-item pagination and exports the entire filtered selection.
[`AuditHero.vue`](../ui/AuditHero.vue) separates the exact overall quality gauge
from CI gate status, execution coverage, findings, and export availability.
[`ScoreGauge.vue`](../ui/ScoreGauge.vue), [`MetricCard.vue`](../ui/MetricCard.vue),
[`UiIcon.vue`](../ui/UiIcon.vue), and [`presentation.ts`](../ui/presentation.ts)
reuse display conventions without changing canonical values.
[`CoveragePanel.vue`](../ui/CoveragePanel.vue) keeps execution status, scoring
methodology, penalty contributions, and detector confidence explicit.
[`ArchitecturePanel.vue`](../ui/ArchitecturePanel.vue) presents connectivity,
cycles, grouped findings, and searchable principle assessments.
[`DependencyGraph.vue`](../ui/DependencyGraph.vue) uses the pure tested
[`graph-layout.ts`](../ui/graph-layout.ts) to bound the radial display to 32 real
modules and 100 real edges. It ranks by canonical connectivity, filters paths with
one-hop neighbors, and distinguishes type-only imports. Geometry organizes data;
it infers neither architectural layers nor causality. Node inspection and a
native module selector expose exact metrics and incident imports, with evidence
drill-down. Its relationship table renders at most 100 matches; canonical JSON
retains every edge. Empty graphs and unassessable concepts remain explicit.
UI review URLs identify a persisted audit through `?audit=UUID` without bypassing
bearer authentication. Findings copy uses the browser clipboard with a visible
denial fallback; no executable repository content is interpreted.

[`theme.ts`](../ui/theme.ts) persists separate appearance, accent, and optional
background-motion preferences. Existing saved appearance/accent choices are
preserved. Fresh installs follow the new dark-first intelligence brief with a
teal accent; malformed stored accents safely fall back to neutral through
[`appearance.ts`](../ui/appearance.ts). [`palette.css`](../ui/palette.css) imports
the shared [`theme.css`](../assets/theme.css) tokens: light/dark/OS surfaces,
seven accents, semantics, spacing, radii, motion, and shadows.
[`style.css`](../ui/style.css) owns the shell and global controls;
[`dashboard.css`](../ui/dashboard.css) owns hero, metrics, and charts;
[`evidence.css`](../ui/evidence.css) owns findings, coverage, and architecture.
No new framework, chart library, icon package, external font, or runtime dependency
was introduced. Pinned development-only `vue-tsc` checks Vue templates as well as
TypeScript; Vite still builds the existing frontend.

The original Imagegen PNGs in [`intelligence/`](../assets/branding/intelligence/README.md)
are illustrative identity material. [`NetworkBackdrop.vue`](../ui/NetworkBackdrop.vue)
blends topology behind the hero and owns a cleaned-up document visibility listener.
CSS path flow pauses with the user's control or a hidden tab, and reduced-motion
disables it. Only measured graph data appears in the dependency explorer.
Accent selection affects actions, links, quality charts, selections, and focus;
severity colors retain their meaning. Storage restrictions leave controls usable
with a persistence notice. Native header disclosures support Escape and exclusive
opening; the assessment expands without adding routes or changing POST semantics.
On phones, the sticky shell keeps assessment and history actions available.
Choosing a history entry restores focus to its repository heading; polling does
not move focus. Settings popovers stay within the viewport and evidence anchors
reserve space for the shell and review navigation.
Browser-safe [`presentation/`](../src/presentation/) modules own the original
icons, category names, accent choices and principle illustrations/explanations.
Small compatibility exports under `ui/` preserve existing imports. The
original [`brand mark`](../assets/branding/antislopscan-mark.png) is
bundled by Vite; the server's confined asset route permits PNG as well as JS/CSS.

[`reports/presentation.ts`](../src/reports/presentation.ts) embeds fixed local
brand/topology PNGs, four static principle posters and original SVG symbols once
per document. It renders the score-led cover, exact-value gauges, provenance and
publication timestamp. Artwork is explicitly conceptual. The shared theme feeds
[`report.css`](../assets/report.css), whose responsive layout and white A4 print
rules provide publication typography, chapter hierarchy, repeated table headers
and compact evidence. Print has no animation.

[`reports/html.ts`](../src/reports/html.ts) composes that presentation,
[`dashboard.ts`](../src/reports/dashboard.ts), the separate
[`ai-architecture.ts`](../src/reports/ai-architecture.ts) summary, unified
[`principles.ts`](../src/reports/principles.ts) static/LLM evidence and a CSP-hashed
local filtering script. All source strings are escaped. HTML disclosures remain
usable without JavaScript; JS adds filtering, sorting, pagination and saved
theme/accent selection. Actual scores, finding identities, graph edges and
citations are unchanged; JSON and SARIF serializers receive the same canonical
result. PDF
rendering in [`pdf.ts`](../src/reports/pdf.ts) disables JavaScript and networking,
forces the light print palette, and renders at most 250 findings per Chromium
section. Large reports retain full canonical statistics in their opening summary
and put every finding into an ordered evidence appendix. Pinned MIT `pdf-lib`
merges every generated page and adds a restrained brand footer and global page
numbers. A section has a
60-second print budget; the whole PDF has a ten-minute budget and a 50,000-finding
limit. Larger inputs fail the PDF artifact explicitly while HTML/JSON/SARIF
remain available. No arbitrary uploaded PDF is parsed. All four artifacts
continue to derive from the same canonical result.

## Independent engine

[`analysis/engine.ts`](../src/analysis/engine.ts) combines source structure,
duplication indicators, supplied requirements, and import edges independently of
external scanners. [`source.ts`](../src/analysis/source.ts) extracts Vue scripts
without execution and preserves original line numbers. [`ast.ts`](../src/analysis/ast.ts)
uses the TypeScript parser and resolves relative imports against the inventory.
[`graph.ts`](../src/analysis/graph.ts) finds strongly connected components with
iterative traversal. Type-only edges are excluded from runtime cycle penalties.
Fan-in/out measurements identify structural review candidates.

[`policies.ts`](../src/analysis/policies.ts) defines each design, architecture,
and systems principle with methodology, evidence, severity, confidence, score
impact, recommendations, false positives, and assessment status. Static imports
are not interpreted as causal or feedback loops. Unobservable principles remain
explicitly unassessable. Missing capabilities are only considered against supplied
requirements; textual absence alone is still a review indicator.

## Use case diagram

Mermaid flowchart notation represents actors, use cases, and the appliance
boundary. Developers use the CLI/UI, pipelines use CLI/API, and operators own
source mounts, configuration, access, and persistence.

```mermaid
flowchart LR
    developer[Developer]
    pipeline[CI pipeline]
    operator[Appliance operator]
    subgraph antislopscan[antislopscan appliance]
        mode([Choose CLI or GUI])
        configure([Validate audit configuration])
        audit([Audit read-only code excluding comments])
        evidence([Review findings and coverage])
        compare([Compare compatible audits])
        export([Export HTML PDF JSON SARIF])
        publication([Read branded publication and complete evidence])
        history([Review persisted history])
        drill([Drill into rules files and scanner evidence])
        theme([Choose appearance accent and motion])
        structure([Inspect resolved modules and principles])
    end
    developer --> mode
    mode --> configure
    developer --> audit
    developer --> evidence
    developer --> history
    developer --> theme
    evidence --> drill
    evidence --> structure
    pipeline --> audit
    pipeline --> export
    operator --> configure
    maintainer[Release maintainer] --> release([Publish tagged alpha release])
    release --> export
    operator --> compare
    audit --> evidence
    evidence --> export
    export --> publication
```

## Data flow diagram

The caller owns the repository; the appliance owns temporary snapshots, canonical
results, SQLite, and report artifacts. Only explicitly enabled AI can send bounded
source data across an external-service boundary.

```mermaid
flowchart LR
    input[CLI flags or API JSON] --> config[config.ts]
    repo[(Read-only source)] --> snapshot[security/snapshot.ts]
    config --> snapshot
    snapshot --> private[(Private temporary snapshot)]
    private --> projection[security/code-snapshot.ts and analysis/comments.ts]
    projection --> code[(Comment-masked code and code-line count)]
    code --> registry[scanners/registry.ts]
    registry --> worker[worker.ts and independent engine]
    registry --> external[External scanner processes]
    worker --> canonical[findings.ts]
    external --> canonical
    canonical --> scoring[scoring.ts and erosion.ts]
    baseline[(Compatible prior result)] --> scoring
    scoring --> result[Canonical AuditResult]
    result --> reports[reports/index.ts]
    result --> review[review.ts evidence grouping and references]
    review --> reports
    design[Shared presentation modules and theme tokens] --> reports
    artwork[(Bundled illustrative PNGs)] --> reports
    result --> sqlite[(SQLite history)]
    reports --> files[(HTML PDF JSON SARIF)]
    tag[Alpha release tag] --> release[GitHub Actions release workflow]
    release --> image[(Docker Hub image)]
    release --> archive[(Executable and npm archives)]
    sqlite --> api[Fastify review API]
    files --> api
    api --> gateway[Unprivileged Nginx gateway]
    gateway --> vue[Vue workbench]
    review --> vue
    design --> vue
    vue --> graphview[DependencyGraph.vue]
    graphview --> layout[graph-layout.ts bounded geometry]
    layout --> graphview
    graphview -->|File evidence slice| vue
    artwork --> backdrop[NetworkBackdrop.vue]
    backdrop --> vue
    vue -->|User copy action| clipboard[(Browser clipboard)]
    vue --> preferences[(Browser appearance accent motion preferences)]
    preferences --> vue
    worker --> evidence[ai/evidence.ts bounded source catalog]
    external --> evidence
    code -. explicit consent .-> evidence
    evidence --> ai[ai.ts deferred optional review]
    ai -. bounded HTTP request .-> provider[Configured LLM provider]
    provider -. untrusted model response .-> validation[ai/assessment.ts citations and rubric]
    validation --> canonical
    validation --> result
```

Scanner failure contributes execution status and missing coverage, never fabricated
findings. The independent engine runs through an internal adapter/worker. Diagram
nodes represent responsibilities inside one deployment, not microservices.

## Sequence diagram

This sequence shows an API audit. The CLI calls the same orchestrator directly.
Scanner tasks execute with bounded parallelism and independent error boundaries.

```mermaid
sequenceDiagram
    actor Caller
    participant API as server.ts
    participant Queue as jobs.ts
    participant DB as history.ts
    participant Audit as orchestrator.ts
    participant Source as security/snapshot.ts
    participant Code as security/code-snapshot.ts
    participant Adapters as scanners/registry.ts
    participant Process as security/process.ts
    participant Reports as reports/index.ts
    participant Publication as reports/html.ts and pdf.ts
    participant AI as ai/architecture.ts
    participant Model as Configured LLM
    Caller->>API: POST through fixed Nginx gateway
    API->>API: Validate origin, token, paths, limits
    API->>Queue: Submit validated job
    Queue->>DB: Persist queued state
    API-->>Caller: 202 and audit ID
    Queue->>DB: Mark running
    Queue->>Audit: runAudit
    Audit->>Source: Create bounded source snapshot
    Source-->>Audit: Inventory
    Audit->>Code: Mask comments preserving source locations
    Code-->>Audit: Read-only code view and code-line count
    loop Bounded independent scanner tasks
        Audit->>Adapters: supports and isAvailable
        alt Available and supported
            Adapters->>Process: Execute fixed binary or worker
            alt Valid successful output
                Process-->>Adapters: Scanner output
                Adapters-->>Audit: Normalized findings
            else Failure or deadline
                Process-->>Audit: failed or timed_out
            end
        else Missing or inapplicable
            Adapters-->>Audit: unavailable, skipped, or unsupported
        end
    end
    opt AI enabled with explicit source consent
        Audit->>AI: Bounded redacted source and static evidence
        loop Known principle batches
            AI->>Model: Fixed instructions, source IDs, response schema
            alt Valid complete response
                Model-->>AI: Principle grades and source IDs
                AI->>AI: Resolve citations, validate rubric and confidence
            else Invalid output or timeout
                AI->>AI: Retain partial failure, no aggregate grade
            end
        end
        AI-->>Audit: Separate review, execution status, informational findings
    end
    Audit->>Audit: Deduplicate, assess, compare, score
    Audit->>Reports: Canonical result
    Reports->>Publication: Same scores, findings and shared design assets
    Publication->>Publication: Embed escaped artwork and print bounded sections
    Publication-->>Reports: Standalone HTML and complete numbered PDF
    Reports-->>Audit: Artifact statuses and final CI decision
    Audit->>Source: Remove original and code snapshots in finally
    Audit-->>Queue: Canonical result
    Queue->>DB: Persist result
    Caller->>API: GET audit and attachment
    API->>DB: Retrieve summary or one result
    API-->>Caller: Evidence, coverage, reports
```

For releases, a maintainer pushes an alpha tag. GitHub Actions builds the image,
extracts and verifies the portable archive, authenticates to Docker Hub using
the repository secret, then publishes the images and GitHub prerelease. A failed
verification stops publication; publication errors remain visible in Actions.

## Runtime, ownership, and failure boundaries

Docker runs Node under `tini` as UID/GID 1000. Compose makes the root filesystem
read-only, drops capabilities, bounds memory/PIDs/CPU/tmpfs, mounts source
read-only, and uses an internal network. `/data` owns history and API reports;
`/reports` is the CLI output mount selected by `--output`. Compose retains the
legacy `codesentry-data` volume key so renaming the service/image preserves history.
Local GUI state defaults outside the source tree to the user's state directory.
Installed binaries, profiles, rules, npm/Python
packages, and Chromium assets support offline execution.

JSON is the configuration authority. API clients cannot choose binaries,
arbitrary host paths, output destinations, or local baseline files. Requested
missing tools fail the default execution policy. Exceptions reach the CLI/API/job
boundary through safe structured logging. Shutdown owns queued-job failure,
active scanner cancellation, temporary-file cleanup, browser closure, and SQLite
teardown. A single process owns each database volume.

[`ai.ts`](../src/ai.ts) dispatches legacy advisory review or separately scored
principle assessment. [`ai-settings.ts`](../src/ai-settings.ts) layers trusted
deployment settings, provider endpoint/key-variable presets and explicit CLI
overrides. The installed CLI loads dotenv only through `--env-file`; checkout
npm entry scripts explicitly load their own optional `.env`. GUI operator JSON
becomes default configuration while the API pins provider protocol, URL and
credential-variable authority. The browser never receives key values.

The orchestrator finishes static scanner work before optional semantic review.
[`ai/evidence.ts`](../src/ai/evidence.ts) selects bounded, redacted source windows
using static risk priority and path spread, with bounded graph/finding context.
Leading attribution/license headers are excluded from source windows without
renumbering citations. This reserves the limited source budget for implementation
evidence; model instructions also exclude legal boilerplate from design judgments.
[`ai/assessment.ts`](../src/ai/assessment.ts) assigns immutable excerpt IDs,
requires complete known principle batches and resolves model-selected IDs into
checked source citations. Its rubric excludes uncertain/inapplicable principles
and confidence below 60%; partial execution has no aggregate score.
[`ai/architecture.ts`](../src/ai/architecture.ts) owns sequential batches and
partial-failure provenance. [`ai/transport.ts`](../src/ai/transport.ts) implements
native Ollama and Claude plus OpenAI/OpenRouter/compatible chat requests using
bounded Node fetch, no redirects, no automatic retries and no tool execution.
The outer audit deadline and per-request timeout both apply.

Optional `AuditResult.aiArchitecture` preserves backward readability of historical
results. It records model/provider, rubric, source scope, per-principle grades,
citations, uncertainty and errors. The separate LLM score does not change core
deterministic scores or CI thresholds; model risk findings are informational by
default. Requested AI execution failure still reduces coverage and follows the
configured scanner-error gate. HTML/PDF show the independent summary through
[`reports/ai-architecture.ts`](../src/reports/ai-architecture.ts) and all principle
assessments/citations through [`reports/principles.ts`](../src/reports/principles.ts).
JSON and SARIF retain the canonical review. Historical artifacts are not
automatically rewritten; an explicit presentation refresh changes only HTML/PDF
attachments, retaining the canonical result and machine-readable artifacts.

[`PrinciplesPanel.vue`](../ui/PrinciplesPanel.vue) joins static and LLM evidence
without overwriting either, filters/paginates 14 rows, and links exact source or
rule slices. [`AiSettingsPanel.vue`](../ui/AiSettingsPanel.vue) edits the same JSON
submitted by the existing form while exposing operator pins.
[`PrincipleIllustration.vue`](../ui/PrincipleIllustration.vue) switches Imagegen
GIFs to static posters when closed, paused, hidden or reduced-motion is active.
The original sheets, exact prompts and deterministic conversion are recorded in
[`principles/README.md`](../assets/branding/principles/README.md).

Generic defaults disable AI and retain the internal Compose network. This user's
ignored `.env` explicitly enables local provider over its existing Ollama HTTP port 11434
and changes `ANTISLOPSCAN_NETWORK_INTERNAL` to false. In that opted-in deployment,
outbound network access is available to the appliance, not isolated per scanner;
scanner child environments still exclude provider credentials. See
[`LLM_SETUP.md`](LLM_SETUP.md) for provider/API, network and scoring contracts.

See [`SECURITY.md`](SECURITY.md) for isolation limits and
[`TOOL_RESEARCH.md`](TOOL_RESEARCH.md) for adapter constraints. Git-history/co-change
analysis, full project type checking, semantic architecture drift, and safe
adapters for unavailable tools remain explicitly unimplemented optional work.
