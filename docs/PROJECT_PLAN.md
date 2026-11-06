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

### Public alpha release

In progress: publish the initial Apache-2.0 source repository and the
`1.0.0-alpha.1` Docker image and Linux x86_64 executable distribution. The
tag-triggered release workflow builds and tests the image, checks its version,
verifies the portable distribution, and publishes checksummed archives and a
GitHub prerelease. The Docker Hub credential is supplied through the repository
secret; private configuration, audit artifacts and local agent instructions are
excluded. GitHub and Docker Hub publication require authenticated access.

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
