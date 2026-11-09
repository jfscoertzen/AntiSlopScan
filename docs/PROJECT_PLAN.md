# antislopscan project plan

antislopscan is an Apache-2.0, self-hosted audit appliance. Developers and CI jobs
submit existing repositories as read-only inputs and receive evidence-based
quality, architecture, systems-thinking, and security assessments.

## Scope and requirements

- One TypeScript modular monolith, CLI, Fastify API, Vue interface, SQLite history.
- Offline scanning after installation; Docker one-shot and web execution modes.
- Strict JSON configuration, independent scanner adapters, bounded subprocesses.
- Canonical findings, explicit execution status, deduplication, scores, coverage.
- Independent AST and dependency-graph engine, configured boundaries, principles.
- Historical structural comparison without claiming deterioration without a baseline.
- Standalone HTML, Chromium PDF, JSON, and SARIF from one audit result.
- Optional Ollama, OpenAI, Claude, OpenRouter and OpenAI-compatible analysis only with explicit source-transmission consent.
- Original files carry author and open-source license headers without copyright clauses; third-party notices are preserved.

## Roadmap and current progress

### Alpha 2 release

Completed on 2026-11-09: published
[`v1.0.0-alpha.2`](https://github.com/jfscoertzen/AntiSlopScan/releases/tag/v1.0.0-alpha.2)
through the successful
[tag workflow](https://github.com/jfscoertzen/AntiSlopScan/actions/runs/42604252153).
Hosted verification passed before publication. The release provides the Linux
x86_64 executable, installable npm tarball and matching checksum manifest;
Docker Hub serves both `1.0.0-alpha.2` and `alpha` at the same verified digest.
Branded CI reports and raw test/scan evidence are retained in workflow artifacts.
Local agent instructions, credentials, audit artifacts and article drafts were
excluded from the commit and release distributions. Public install examples and
release notes are updated; publication evidence is in [VALIDATION.md](VALIDATION.md).

### Snyk dependency and source security gate

Completed and verified on 2026-11-09: added pinned Snyk CLI 1.1308.4 dependency
and Code cloud scans as the final application gate before release assembly.
Credentials enter only execution, with sanitized test/build/report subprocess
environments. Both scans retain actual outcomes and all severity counts; missing
credentials, failed scans and high/critical findings block release. Branded
HTML/PDF reports verify raw current-run evidence and present findings, fix
versions, dependency paths and source/data-flow locations.

Live Code findings fell from three to zero after source/worker path hardening
and safe scanner-error classification, supported by failing-before/passing-after
regressions. Patched Vite/esbuild and an ESLint/Ajv-scoped maintained URI resolver
remove the observed critical/high dependency findings. No broad ignores were
added. Four medium advisory/package/version combinations remain visible.
Native npm 12 and container npm 10 both pass real offline package/GUI tests.

The final native and Docker pipelines each pass **64 Jest cases** (56 backend,
five CLI, one distribution, two UI), **194 required screenshots**, security,
self-audit and both Snyk scans. Docker also passes checksummed archive and
portable executable verification. Coverage is 100% lines/statements/functions
and 84.53% branches in the five measured modules; self-audit remains 93/100 with
100% applicable tool coverage. Reports were generated and print layout reviewed.
See [SNYK.md](SNYK.md) and [VALIDATION.md](VALIDATION.md) for scope, compatibility
constraints, remaining advisories and exact evidence. GitHub needs its own
`SNYK_TOKEN` repository secret; this task did not configure remote secrets, push
changes, run GitHub Actions or publish a release.

### Source-backed test documentation and branded CI evidence

Completed and verified on 2026-11-09: the source-generated
[testing inventory](TESTING.md) documents every registered case's contract and
actual assertions, including delegated browser and installation scenarios.
Preflight rejects stale documentation. Both Playwright scenarios require all
declared feature and appearance/viewport screenshots; reports independently check
run IDs, paths, timestamps, PNG dimensions and SHA-256 digests.

The complete Docker pipeline passed **54 Jest cases** (46 backend, five CLI, one
distribution and two UI), with no failures or skips, and retained **194 required
screenshots** (170 dashboard and 24 model review). Branded standalone HTML and
A4 PDF reports contain actual gate/test/scanner outcomes, coverage, assertion
details, captioned screenshots and sanitized diagnostic excerpts. Failure-path
regressions verify readable reports after an actual command failure, artifact
confinement, hostile HTML escaping and rejection of incomplete visual evidence.
Missing evidence or failed report generation blocks CI. GitHub always retains
the viewable report artifact and links it from the job summary.

The final PDF was rendered with Poppler and its cover, continued pipeline table,
feature evidence and responsive contact sheets visually inspected. The small
print-layout adjustment keeps durations on one line. Runtime APIs, scoring and
local article drafts are preserved; an obsolete organization name was removed
from the application footer. Release publication remains explicitly separate
from verification; no push or publication was performed. Remaining scope limits
and reproducible validation are recorded in [VALIDATION.md](VALIDATION.md).

### Ordered functional CI and Jest migration

Implemented: migrated regression tests to Jest 30.5.2; added backend/API edge
cases, CLI failure exit codes, fail-closed pipeline tests and bounded performance
checks. Existing Playwright scenarios now run as Jest UI tests with per-scenario
logs, failure screenshots/traces and explicit completion checks. Added strict
test type checking and critical-module coverage gates. The shared npm runner
orders backend, CLI, distribution, UI, security and self-audit. The Docker wrapper
also verifies the portable executable. GitHub CI and release call one reusable
workflow; publication requires its success and consumes the saved verified image.
The [testing guide](TESTING.md) maps the ten pillars to actual tests and documents
commands, evidence, budgets and coverage limits. Direct production dependency versions
are unchanged; npm moved the existing PDF tslib helper into a nested location
when adding Jest optional dependencies. Local launch article drafts remain local.

Completed and verified on 2026-11-09 after execution/network access was restored:
`npm run ci:local` and the complete Docker pipeline pass. Docker ran 47 Jest
cases (39 backend, five CLI, one offline distribution and two Playwright flows),
with no failed or skipped cases. Critical-module coverage is 100% lines,
statements and functions, and 84.61% branches. SAST, full Git-history/working-tree
secret scans and dependency checks including development dependencies pass at
the configured high/critical threshold. Lower-severity dependency advisories
remain visible. Self-audit is 93/100 with 100% applicable scanner coverage and
no configured boundary violations; every requested report completed. The portable
executable audit and archive checksums also pass.

Verification exposed and fixed production Vue parsing that discarded template
comment spans, reproduced by a failing fresh-process regression before the fix.
Vite was updated from 5.4.21 to patched 6.4.5 using the existing Vue plugin.
The CI-only temporary mount now permits launching trusted installed CLI/scanner
binaries; production Compose is unchanged. Dependency auditing explicitly
includes dev dependencies despite the container's production environment.
Earlier restricted runs were failures, not passing evidence. Final records and
commands are in [VALIDATION.md](VALIDATION.md) and [TESTING.md](TESTING.md).
No publication was performed during this verification task.

### Local launch articles

Completed: prepared concise dev.to and LinkedIn article drafts under
`docs/articles/antislopscan-launch/`, with the requested inspiration talks,
additional primary-source research, a source/claim ledger and a matching Imagegen
banner. The drafts introduce the alpha and distinguish structural indicators from
runtime proof. Publishing notes and the exact image prompt accompany the files.
This is a local editorial package; no article or repository changes were pushed.

### Public alpha release

Completed: published the initial Apache-2.0 source repository and the
`1.0.0-alpha.1` Docker image and Linux x86_64 executable distribution. The
tag-triggered release workflow builds and tests the image, checks its version,
verifies the portable distribution, and publishes checksummed archives and a
GitHub prerelease. The Docker Hub credential is supplied through the repository
secret; private configuration, audit artifacts and local agent instructions are
excluded. GitHub and Docker Hub publication require authenticated access. The
release workflow and corrected CI artifact upload passed. Git history and the
executable distribution passed a secret scan; CI now scans full Git history as
well. Docker Hub's overview is maintained in [DOCKER_HUB.md](DOCKER_HUB.md).
The public README includes installation paths and a dashboard screenshot captured
from an isolated sample audit, with no private repository data.

### Branded publication reports

Completed: shared the frontend palette, original icons and principle metadata
with the HTML/PDF renderer. Added a score-led cover, embedded topology artwork,
illustrated principle guide, unified static/LLM evidence chapters, refined charts,
tables, findings and print typography. All 35 tests, both browser suites, strict
builds, callable documentation and three architecture diagrams pass. The self-audit
passes at 93/100 with 100% execution coverage. Docker and offline global/local npm
installation checks pass. The regenerated 4,919-page private repository PDF retains all
13,702 findings and 49 citations; canonical JSON/SARIF remain byte-identical.
The latest audit's HTML/PDF attachments use the new design, with all 16 history
records, machine exports and other historical attachments preserved. No scanner
or LLM rerun was needed. See [VALIDATION.md](VALIDATION.md).

### Exclude comments from code assessments

Completed: replaced comment-prefix heuristics with a shared comment-masked code
view, preserving source locations and string/regex literals. Used it for core
duplication, module-size/requirement checks, text scanners and LLM evidence;
configured native jscpd comment skipping. Removed comment-hygiene findings from
code scoring and prevented comment-only LLM citations. All 34 tests, both browser
suites, strict builds, documentation checks in 95 original files and offline npm
installation checks pass. The source-only private repository rerun completed all formats
at 95/100 static and 61/100 LLM, with unchanged original source hashes. Its policy
fingerprint differs from older audits to prevent misleading baseline comparisons.
The self-audit passes at 93/100 with 100% execution coverage and 171 observations.
Deployment preserves historical evidence; validation is recorded in
[VALIDATION.md](VALIDATION.md).

### LLM architecture assessment and illustrated principle review

Completed: extended the existing opt-in AI adapter with verified Ollama,
OpenAI-compatible/OpenAI/OpenRouter, and native Claude transport, JSON/CLI/env/GUI
configuration, bounded evidence sampling, validated per-principle assessments,
and a separately labeled LLM architecture score. Preserve deterministic scoring
and CI semantics, legacy audit readability, operator endpoint/credential authority,
and visible provider failures. Configured this checkout's ignored .env for the
user-requested local provider endpoint after inspecting the existing Ollama connection setup.

Refreshed the principle investigation experience using compact status/evidence
rows, explanatory Imagegen artwork and pausable animated GIFs, exact static/LLM
provenance, and honest unassessable states. Added provider/scoring/schema/security
and browser regressions; verified actual configured local provider inference, documentation, reports,
package/container builds and deployment without altering previous audits. Live
review exposed weak model conclusions citing legal boilerplate; a reproducing
test now verifies source-window header exclusion with original line numbers,
and stricter instructions require direct support from the selected code excerpt.
Mechanical quote validation cannot establish semantic correctness; retain human
review and sample limitations prominently. All 30 tests, both browser workflows,
strict builds, documentation checks in 92 original files, three Mermaid renders,
and offline npm installation checks pass. The final private repository run scores 96
statically and 59 across 27 LLM-graded principles, sampling 24 of 371 files;
all source hashes and static scores match the preceding inventory. All four
exports complete. The deployed appliance preserves the original 13 audits plus
two authentic LLM runs, with unchanged old attachment hashes. Live checks verify
all provider defaults, principle interactions, GIF pause/reduced motion, both
themes at six widths and no browser exceptions/external asset requests. The
appliance's own full audit passes at 94/100 and 100% tool coverage with 205
findings/observations. See [VALIDATION.md](VALIDATION.md) and
[LLM_SETUP.md](LLM_SETUP.md) for reproducible commands and limitations.

### Software intelligence frontend modernization

Completed: retained Vue 3/Vite and all backend contracts while introducing a
dark-first token system, compact shell/navigation, score-led repository hero,
original SVG iconography, a pausable illustrative topology background, actual
severity/category charts, bounded dependency exploration, and refined findings,
coverage, assessment, and history. Preserved existing appearance/accent choices,
audit IDs, filters, exports, configuration payloads, CI gates, and canonical data.
Added regression coverage for graph display and UI interactions; verified type/build,
contrast, keyboard, reduced-motion, simulated hidden-tab pause, six responsive
widths, and actual audit data. The production build includes pinned development-only
Vue template type checking. All 26 unit/integration tests and the expanded browser
workflow pass; all three Mermaid diagrams render. The appliance's own full audit passes at
93/100 with 100% tool coverage, 155 findings/observations, no critical findings,
and all four reports, including a network-disabled, non-root, read-only-root
container run of the final image. Docker build, offline global/local npm installs,
and packaged GUI checks pass. The healthy appliance on localhost:3000 preserves
all 13 audit IDs and unchanged hashes for all four private repository reports. Live checks
verify real critical/graph/scanner drill-down, both modes, six widths, keyboard
graph selection, phone history focus, local-only asset requests, and no browser
exceptions. Large report streaming fixes the gateway's bounded temporary storage
limit without changing report content or backend contracts. npm artifacts are
refreshed with the same verified runtime and current documentation.

### Neutral frontend theme and accent preferences

Completed: replaced green-tinted frontend surfaces with BnB's neutral reference
palette and independently implemented seven named accent choices. Appearance and
accent selections persist separately. All 24 tests, callable documentation in 66
source files, and browser checks passed, including all presets in both modes,
contrast, reload/fallback, keyboard access, and five responsive widths. Light
orange was darkened slightly for readable text on gray rows. The rebuilt Docker
appliance is healthy on localhost:3000; live checks verified neutral defaults,
custom-accent persistence, both modes, and preservation of all 13 audit records.
Existing report artifacts retain their publication appearance.

### Branding and review workbench refresh

Implemented and verified: an original Imagegen inspection mark, consistent app
and HTML/PDF branding, persisted light/dark/system themes, evidence-derived
dashboards, paginated multi-filter drill-downs, filtered JSON export, and curated
online issue references. Browser workflows passed in both themes from 320px to
1440px. The full private repository rerun completed all 12 selected scanners at 100%
execution coverage; 13,718 findings are retained in all four formats, with all
371 source hashes unchanged. Its 4,678-page PDF includes every finding fingerprint.

Large-document testing exposed Chromium's single-document printing limit. The
repaired renderer prints 250-finding sections, merges all pages using pinned MIT
`pdf-lib`, and applies global numbering. Real multi-section browser tests and an
ordered-page assembly regression passed. Offline package testing caught an npm
normalization issue that omitted the new dependency from the bundled list; the
explicit bundle and a release guard now prevent incomplete runtime bundles.
Fresh empty-cache global/local installs passed after the correction.

The updated frontend is running for review on localhost:3001 with the real
private repository result. Final Docker deployment validation passed: the hardened image generated every
artifact, localhost:3000 serves the selected audit, all four attachments match
the published files, and all 12 previous history records remain alongside it. private repository's
`ci/verified-runs` destination remains read-only; private artifacts are preserved
under this project's ignored `local untracked audit artifacts` instead.

| Milestone | State | Remaining tasks and dependencies |
| --- | --- | --- |
| Tool research and licensing | Completed | Requested tools evaluated; versions pinned, native checksums, vendored rules/profile, notices, matching source archives. |
| Configuration and safe snapshot | Completed | Strict schemas, project overrides, confined/bounded inventory; adversarial regression tests passed. |
| Independent analysis engine | Completed | JS/TS/Vue checks, runtime cycles, configured boundaries, principle catalog, and compatible baseline measurements verified. |
| Scanner adapters | Completed | Common interface, actual bundled JS/TS/Python toolchain exercised, explicit unavailable integrations. |
| Orchestration and scoring | Completed | Bounded execution, isolated failures, deduplication, coverage, CI policies, baseline mismatch rejection. |
| Reports and persistence | Completed | Staged HTML/PDF/JSON/SARIF, result validation, SQLite history/retention, restart/shutdown ownership. |
| API and interface | Completed | Confined/authenticated jobs, history, downloads, evidence filters, browser states, keyboard/mobile checks. |
| Packaging and verification | Completed | Docker build executes unit/integration/browser checks; hardened offline CLI and live Compose/API/download/egress checks passed; self-audit and documentation recorded. |
| antislopscan rename and launch modes | Completed | Renamed metadata/UI/reports/image, explicit CLI/GUI commands and chosen report folders verified. All 12 existing history records retained after deployment; legacy environment aliases remain supported. |
| npm CLI distribution | Completed | Bundled Linux x86_64/glibc tarball passed empty-cache offline global/local installs, actual npm scanners and packaged GUI tests with npm 12 locally and npm 10 in the successful Docker build. CI exports the verified tarball. Publication remains a separate maintainer action. |

## private repository audit execution

Completed analysis: inspected private repository's local CI stages and verified its report root is
`ci/verified-runs`. A 371-file scan generated all four formats but exposed large
SlopScore JSON truncation through stdout. A reproducing regression fails before
the adapter fix; the adapter now uses SlopScore's verified UTF-8 `--out` option
and checks report size before parsing. All 19 tests and the Docker/package checks
passed; the real audit rerun completed every selected scanner and all four report
formats. Source hashes were unchanged. Final publication is blocked because the
requested destination is mounted read-only in this session. Reports and CI
context are preserved under ignored `local untracked audit artifacts`, with originals
under `/tmp`, pending destination write access.

## Constraints and decisions

Audited code is data: never install its dependencies, run package/build scripts,
or import executable repository configuration. Scanners consume a private source
snapshot without repository symlinks or executable configuration. API clients
cannot choose arbitrary host paths. Network isolation is enforced by the Docker
execution mode; a subprocess alone is not a security boundary.

The project uses Apache-2.0 and `LICENSE.TXT`. Author and license attribution
remain in original file headers; third-party notices remain in their respective
notice files.

The initial environment denied package-host DNS and Docker access. Access was
enabled during implementation. Installation, Docker builds, and a network-disabled
hardened one-shot scan have succeeded. Final verification is tracked in
`docs/VALIDATION.md`; scanner unavailability remains visible.

## Validation and delivery criteria

1. Compile with strict TypeScript and run unit/integration tests.
2. Exercise hostile configuration, traversal, symlink escape, subprocess limits,
   malformed scanner output, baseline mismatches, and HTML injection.
3. Audit clean and deliberately flawed fixture repositories without mutating them.
4. Generate all four report formats; inspect PDF rendering and report consistency.
5. Exercise API job creation/history/downloads and browser empty/loading/error states,
   findings filters, keyboard access, and mobile layout.
6. Build/run the container where the environment permits and record any gap.
7. Run antislopscan against itself and investigate actionable findings.
8. Update this plan, architecture links, diagrams, tool notices, and validation record.

## Risks and open work

Final deployment verification exposed traversal into the coding environment's
protected `.codex` mount. Private agent settings, AWS credentials, and npm caches
are now explicitly outside snapshot coverage, including architecture-document
inputs. Regression checks and three repeated live API audits verified the fix.

Static analysis cannot prove most systems-thinking properties or identify AI
authorship. Heuristics need explicit confidence and false-positive guidance.
Language coverage varies by adapter. Native tools need pinned installation and
platform checks. Baselines require matching project and policy identities.
SQLite and report retention must be bounded. A broad tool collection must not
silently turn missing scanners into a passing audit.

Implementation and required release verification are complete. Optional future
work includes reviewed Knip integration, dependency-aware
type checking under a separate trust policy, Java/C++ scanner bundles, Git-history
measurements, semantic drift, and runtime evidence ingestion. None is represented
as an implemented check. The separately researched scanaislop `aislop` CLI is not
currently bundled.

## npm cache setup repair

Completed: npm now keeps its cache and diagnostic logs in the ignored
`.npm-cache/` directory. The reported `EROFS` failure targeted the shared
`~/.npm` cache; host write probes passed for that cache and this project,
indicating an execution sandbox restriction rather than incorrect Unix ownership.

Validation passed: `npm config get cache` resolved to the project cache;
`npm view fastify@5.12.8 version --fetch-retries=0 --fetch-timeout=20000` returned
`5.12.8`; `npm cache verify` passed; temporary cache files and npm diagnostic logs
were writable. Earlier cache verification used host write access while the
original session restricted writes. Subsequent dependency installation, local
builds, and Docker builds have succeeded; no installation blocker remains.
