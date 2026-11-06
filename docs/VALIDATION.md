# Validation record

Validation performed on 2026-11-05 and 2026-11-06 with Node 22.22.3, Python 3.12 locally,
Docker 29.1.3, Chromium revision 1194, and the pinned scanner toolchain.
The Docker image uses Debian bookworm's Python runtime and the same package locks.

## Public alpha and secret review

`v1.0.0-alpha.1` was published as a GitHub prerelease with an executable Linux
x86_64 archive, npm tarball and SHA-256 manifest. Its release workflow completed,
and Docker Hub serves both the versioned image and `alpha`. The archive launcher
passed a real portable audit at 100% tool coverage; the published asset digests
match the release checksum manifest. The first CI run exposed a report-directory
permission problem; the runner-readable handoff was reproduced and corrected,
and the following main-branch CI run passed.

Gitleaks found no secrets in the published Git history or downloaded npm
archive. A scan of the image's application directory also found none; that scan
skipped files larger than 5 MB and binary content. An additional exact-value
check found the Docker credential in neither the checked release files nor the
image environment. These checks are detection aids, not proof that no secret can
ever be present. CI now scans fetched Git history with redacted output.

## Branded publication reports

The HTML/PDF renderer now shares frontend palette tokens, original SVG icons,
category/primitive metadata and the existing Imagegen artwork. No dependency was
added. JSON/SARIF serializers, audit/scoring logic, API routes and CI behavior are
unchanged. `DESIGN.md` records the publication direction; `UI_REVIEW.md` records
the itemized design gate.

Strict TypeScript/Vue production build and callable documentation checks pass
in 102 original files. All **35 tests in 19 suites** pass, including the new
report regression for escaped hostile content, embedded artwork, all finding
fingerprints, unmapped historical assessments and canonical/SARIF immutability.
Both browser workflows pass. Standalone HTML additionally verifies all seven
accents/contrast in both themes, saved selection/reload, malformed storage,
decoded local artwork, four conceptual illustrations, no HTTP asset requests,
six responsive widths, existing evidence controls and white print in dark OS mode.
All three updated architecture diagrams render. No separate lint script exists;
the full scanner self-audit passes at **93/100**, **100% execution coverage**,
176 findings/observations and all four completed report formats.

The latest private repository canonical result is reused for presentation refresh; no
scanner or LLM was rerun and no source was modified. Original reports remain in
`local untracked audit artifacts`; refreshed artifacts
are in `local untracked audit artifacts`.
Deep equality verifies the complete canonical result is unchanged. JSON SHA-256
is `111b78b7cd65469d148e8ba41a7bb0597028d83514a69168c6feaafb58e561ca`;
SARIF is `c929f1068d4123671eed263a3681266bd5aafa5c7e1ec82430ac7a1c3833a340`.
The final PDF has **4,919 A4 pages**, **48,221,831 bytes**, no JavaScript, and
every finding fingerprint with its exact multiplicity (13,702 total), plus all
49 checked source citations. Cover, summaries, scanner table, numbered real
graph/relationship table, illustrated principles, citation continuations and
first/final evidence pages were rendered with Poppler and visually inspected.
Its SHA-256 is `4829f58989fa46ece020289ad54996152a0c47e3c716bda5a2225e586942c400`.
Actual standalone private repository browser review verifies exact 95/100 static and
61/100 LLM gauges, 56 principles, the 207-critical drill-down, expanded evidence,
both themes at six widths, no browser exceptions and no external asset requests.
Screenshots are `local untracked review artifacts`.

The fully tested runtime image is
`181aeadfa132ec12bd45c7f4c09971ba0593f27b4117c2aab15f529c7d271c81`.
Its build executes all 35 tests, both browser workflows, offline empty-cache
global/local npm installations, real portable scanners and packaged GUI/shutdown
checks. A final metadata-only layer includes these maintained documents without
changing runtime code. The refreshed release tarball includes the shared design
modules and local artwork, and excludes private configuration/secrets.

Deployment refreshes only the latest audit's HTML/PDF attachments through
staged atomic file replacement under UID 1000; its canonical history row and
JSON/SARIF stay unchanged. All 16 history summaries and all other stored report
hashes are compared before/after. Live download checks cover all four artifacts,
including the complete 48 MB PDF through the streaming gateway. Compose retains
the non-root application, read-only source/root, resource limits and existing
operator-controlled AI/network defaults. No database owner runs concurrently
with the application during attachment maintenance.

## Initial appliance checks

| Check | Outcome and evidence |
| --- | --- |
| Strict TypeScript and Vue production build | Passed through `npm run build`; bundled Vue assets and both JSON Schemas generated. |
| Callable documentation | Passed `npm run check:docs`; compiler-recognized documentation on every callable in 77 original source files. |
| Unit/integration tests | 26 tests across thirteen suites passed. They cover CLI/GUI subprocesses, exact report folders including spaces, executable/help contracts, environment aliases, configuration, traversal, symlinks, private-path exclusions and aliased architecture documents, limits, malformed scanner output, large SlopScore JSON and file-output caps, deduplication, read-only source, hostile executable configs, actual scanner output, baseline compatibility, repeated-fingerprint/new-high-severity gating, report-writer locks, repeated API jobs/downloads, AI consent/endpoint/location validation, TypeScript/Vue/inline-type parsing, composable evidence filters, complete group counts, curated reference URL safety, ordered PDF section assembly, validated accent preferences, and real-edge-only deterministic graph display with self-loops, query neighborhoods, bounds, and input immutability. |
| Native scanner integration | Actual SlopScore, Oxlint, vendored Anti-Slop, Rust AntiSlop, jscpd, dependency-cruiser, Semgrep, Gitleaks, Ruff, and Radon executed. Short fixtures correctly record jscpd's zero eligible source count and reduce tool coverage. |
| Browser workflow | Passed `npm run test:e2e`; authenticated connection, invalid JSON, real 267-finding audit, history, dashboard/graph/principle drill-downs, scoped filter visibility, combined filters, 50-item pagination, filtered JSON export, all four downloads, evidence copying and denial fallback, safe references, keyboard/Escape/focus, saved appearance/accents/motion, visibility-event simulation, reduced motion, live OS changes, standalone HTML, and 320/390/540/768/900/1440px geometry. |
| HTML injection | Hostile project markup remains escaped in standalone report HTML; source/configuration never executes. |
| SARIF schema | Actual self-audit SARIF passed the published SARIF 2.1.0 JSON Schema using Python jsonschema. |
| AI transport | Actual local HTTP contract test; explicit consent required, observations remain informational, nonexistent sample locations rejected, API endpoint/key-variable redirection rejected. No external AI service was used. |
| Architecture documentation | All three Mermaid diagrams rendered successfully with Mermaid CLI 12.2.0 using the existing Chromium binary. |
| Contrast | Browser checks require every frontend preset against all base surfaces in light/dark modes to meet 4.5:1 for ordinary text/semantic colors, 3:1 for controls/focus, and 4.5:1 for primary-action text. The independent report palette remains unchanged. |
| PDF rendering | Actual 68-page self-audit PDF generated with Chromium; Poppler metadata verified. The renamed first page and the same template's graph, continuation table, and final-page layout were inspected during release verification. Numbered graph nodes/file key corrected label overlap. Page numbers present; no PDF JavaScript. |
| Hardened Docker CLI | Network-disabled, non-root, read-only-root/source, dropped-capability run generated HTML/PDF/JSON/SARIF; deliberately flawed source produced the expected nonzero quality gate. |
| Self-audit | Renamed project passed the CLI gate at 92/100 with 100% applicable tool execution coverage, writing all four artifacts to `/tmp/antislopscan-self-audit`. The report retains 133 findings/observations; a passing gate does not claim zero warnings or full semantic assessment. |
| npm distribution | Actual bundled tarball installed globally and locally using npm offline mode, an empty cache, production-only dependencies, and disabled install scripts/update notifications. Tests passed with npm 12.1.0 locally and npm 10.9.8 during the successful Docker build. Both installed CLIs executed all seven portable adapters at 100% execution coverage and wrote HTML/JSON/SARIF into the chosen folders. Packaged GUI/profile defaults, license/provenance, and clean shutdown passed. |
| Rename compatibility | `antislopscan` executable, UI, reports, schemas and Docker image verified. All 12 previous persisted audit IDs remained present after the service rename; legacy environment aliases and storage volume are retained. |
| Compose deployment | Both containers running; application healthy, gateway serves `http://localhost:3000`, scanner-container outbound request blocked. Three consecutive persisted API self-audits completed at 92/100 and 100% coverage; all four report attachment endpoints returned HTTP 200 for each run. |

## Comment-exclusion release checks

The verified runtime image is
`77c9f785ef6897ae473b7653e2a14d34537238db3b080ae71d1e3cd1188b9173`.
Its build passes strict application/Vue type checks, **34 tests across 18 suites**,
both browser workflows, offline npm global/local installations and packaged GUI
checks. Documentation checks pass for **95 original files**. Any final documentation
layer preserves this tested runtime unchanged.

New regressions demonstrate that repeated multiline/unstarred/inline comments
cannot generate clones, inflate core module size, satisfy a timeout requirement,
or change density scores. Actual repeated code remains detectable across differing
comments with original line references. Compiler/Vue and lexical fixtures preserve
URLs, regexes, JSX/template text, Python quoted data, Rust lifetimes/nested comments,
C++/C#/Go raw literals, Ruby heredocs/percent/regex literals and PHP attributes.
Comment-only core input remains unassessed, with zero execution coverage and no
overall score. Advisory AI rejects a comment-only location. Real SlopScore,
Rust AntiSlop and jscpd executions produce no comment-marker/comment-clone findings.

Scanners use a private comment-masked source copy. Source credentials appearing
only in comments are therefore outside this policy, as documented in README and
SECURITY. Original source files and hashes are preserved. SlopScore physical-line
rule 055 is replaced by the core code-line metric, and Oxlint's safety-comment
requirement is disabled. `code-only-v1` changes the baseline fingerprint.

The authentic private repository audit `d9e8fc51-15ab-4928-ac2e-f0c5b47ee271` completes with
**95/100 static quality**, **100% tool execution coverage**, **13,702 findings**,
and a separate **61/100 LLM grade** across **27/56 principles** from 24 sampled
files. Critical findings still fail the CI gate. Every original source hash matches
the previous 371-file inventory; all model citations resolve to the comment-masked
code at their original locations. No scored model reasoning cites comment or
documentation text. HTML/PDF/JSON/SARIF are in
`local untracked audit artifacts`; the PDF contains
4,694 pages. Previous reports are retained as historical evidence, not rewritten.

The full self-audit passes at **93/100**, **100% coverage**, exit code 0, with
**171 findings/observations** and all four report formats. This is not a quality
trend against the earlier policy. Source limits and physical inventory counts
remain unchanged; semantic density now uses code lines.

Deployment verification on localhost:3000 preserves all 15 previous summaries
exactly and adds the authentic code-only audit as record 16. Its four attachment
SHA-256 hashes match the CLI files, the live DRY citation opens the correct file
filter, and Chromium reports no browser exceptions. The process remains non-root
with a read-only root filesystem. All three updated Mermaid diagrams render.
The installable npm archive includes the compiled code view and current policy
documentation; private `.env` and `config/local.json` are excluded.

## Previous LLM architecture release checks

The LLM extension retains Vue/Vite, Fastify, SQLite and the existing scanner
framework. It introduces no runtime dependency. Verified protocol contracts cover
native Ollama and Claude, OpenAI, OpenRouter and OpenAI-compatible chat. Cloud
providers were exercised against controlled HTTP contract servers, not live paid
accounts. Official protocol references are in [LLM_SETUP.md](LLM_SETUP.md).

The final image is
`ca54753920c8d7c61a7398d35fb1f7798a0dda0401c6a840f43504d91c10acc5`.
Its successful build ran strict TypeScript/Vue checks, all **30 tests in 17 suites**,
both browser workflows, empty-cache offline global/local npm installations and
packaged GUI/shutdown checks. Callable documentation passes in all **92 original
source files**, including inside the deployed container. All three updated
Mermaid diagrams rendered successfully. There is no separate lint script;
the full self-audit runs the actual appliance ESLint/Oxlint and other adapters.

Provider regressions cover explicit transmission consent, exact request protocols,
credential isolation, provider-default precedence, pinned endpoints, timeouts,
partial responses, invented/omitted/duplicate citations, confidence/rubric checks,
redaction, UTF-8 bounds and leading license-header exclusion with original line
numbers. Controlled positive/risk model responses prove deterministic scores,
static principles and erosion remain identical with AI on or off. Failed/partial
execution never produces a passing aggregate.

### Actual local provider and private repository evidence

The user's existing Ollama connection resolved local provider to
`http://localhost:11434`, version `0.40.5`, with installed
`qwen3.5:latest`. No TLS verification was bypassed. Native structured inference
completed on a small fixture and the real private repository. The initial trial
correctly rejected model-transcribed quotes; immutable source IDs avoid that
transcription failure. A subsequent review exposed irrelevant license-header
citations; a failing regression led to metadata exclusion and stricter direct-code
instructions. Semantic relevance still requires human review even when citations
match mechanically; no model calibration or whole-system proof is claimed.

The final authentic private repository run is `5ad6c69b-ba34-4893-9c9e-abc5cd2b9395`:

- Static score **96/100**, **100% applicable tool execution coverage**; the full
  static score object is identical to the preceding private repository audit.
- Separate LLM score **59/100** from **27 of 56 principles**; 29 remain unscored.
  It sampled **24 of 371 files**, **26,876 redacted source bytes**, and no supplied
  architecture documents. These are sample limits, not semantic coverage claims.
- **13,766 findings/observations**, including **188 critical** flags; the CI gate
  fails for critical findings independently of the LLM score. All 371 source
  hashes match the prior inventory and the source repository remains unchanged.
- HTML/PDF/JSON/SARIF completed in
  `local untracked audit artifacts`. The PDF has
  **4,717 A4 pages**, no JavaScript, readable printed score/provenance/citation
  pages, and local conceptual artwork. CLI results were imported unchanged into
  appliance-owned history; no audit identities or historical artifacts were rewritten.

This checkout's private `.env` enables the verified local provider provider, model, source
consent and network egress. Ignored `config/local.json` retains the established
private repository CI exclusions and trusted limits. Distributed defaults keep AI/consent
off and the Compose network internal. The opted-in local network permits outbound
traffic from the appliance, including scanners; it is not per-process isolation.
Source and operator policy mounts remain read-only, with a non-root process and
read-only root filesystem. Live container metadata requests reached local provider.

Four Imagegen sheets, static posters and small six-frame GIFs illustrate shared
authority, boundaries, contracts and flows. They are conceptual, not discovered
architecture maps. Prompts/provenance are in
`assets/branding/principles/README.md`. Browser checks cover provider/model/budget
editing, source consent, independent grades, citations, 14-row pagination,
domain/status/search filters, GIF pause/reduced motion, both themes at six widths
and no browser exceptions. The full per-item UI delivery gate remains in
[UI_REVIEW.md](UI_REVIEW.md).

The healthy Compose deployment on `http://localhost:3000` retains all original
13 audit IDs and both authentic LLM runs, for **15 records**. A live browser
verified the final 59/100 review, exact file-citation drill-down, domain/search
and pagination controls, GIF pause/reduced motion, provider defaults, both modes
at 320/390/540/768/900/1440px, zero exceptions and no external browser asset
requests. SHA-256 comparisons through the gateway match all four new attachments
and all four original private repository attachments, including the 43 MB new PDF.
The final full self-audit passes at **94/100**, **100% tool coverage**, exit code
0, with **205 findings/observations** and all four report formats in
`/tmp/antislopscan-self-audit`.

## Prior frontend release checks

The software intelligence frontend uses the existing Vue/Vite stack, original
SVG iconography, native exact-value charts, bounded real dependency exploration,
and two built-in Imagegen illustrations with exact prompt provenance. It preserves
backend contracts, report layout, scoring, CI gates, existing appearance/accent
preferences, and routes. Fresh installs are dark with a teal accent.

Local build now runs strict Vue SFC checking through pinned development-only
MIT `vue-tsc@3.3.14`. All 26 tests and callable documentation checks pass. The
expanded browser workflow verifies graph/module drill-down including a file with
zero findings, searchable principle assessments, the expandable assessment form,
clipboard success and denied-access feedback, Escape, explicit motion pause,
simulated hidden/visible document events, reduced-motion animation styles,
seven accents, all downloads, standalone HTML, and six responsive widths
(320/390/540/768/900/1440px). Mobile history navigation returns focus to the
selected repository; scoped rule/file/scanner drill-downs expose their filters.
Real private repository visual review covers the hero, findings, graph, assessment, and
light/dark phone/desktop layouts. All three updated Mermaid diagrams render.

The full self-audit passes at **93/100**, **100% applicable tool coverage**, and
exit code 0, with 155 findings/observations, no critical findings, and completed
HTML/PDF/JSON/SARIF in `/tmp/antislopscan-self-audit`. This is a current assessment,
not a measured improvement trend. The final image also passes its own audit in
a network-disabled, non-root, read-only-root container with dropped capabilities
and bounded memory/CPU/PIDs/tmpfs. Its four reports are in
`/tmp/antislopscan-intelligence-self-audit`.

Final image:
`8e6f19eb3a4d5c6aaa4b133433996428c65af3bb966abef3b64a333a7c592ef0`.
Its build passed 26 tests, the expanded browser suite, actual offline npm installs
into fresh global/local prefixes, and packaged GUI checks. Compose is healthy on
localhost:3000 with the same source read-only, the same persistent volume, and
the same internal scanner network. All 13 previous audit IDs remain. Live browser
checks verify both themes at six widths, the real 188-critical selection, bounded
32-module/100-edge graph, keyboard graph selection, phone history focus, no
external requests, and zero browser exceptions. Callable documentation also
passes inside the deployed container. The refreshed npm artifact retains the
verified bundled runtime; previous release paragraphs remain historical records.

Large-attachment regression: a Node fetch of the existing private repository PDF initially
terminated after approximately 19.6 MB; gateway logs recorded a partial tmpfs
write. Streaming upstream responses fixes the 16 MiB spool limit. `nginx -t`
passes, and actual downloads through localhost:3000 match the original SHA-256
hashes for HTML (20,554,550 bytes), PDF (35,295,279), JSON (11,894,126), and
SARIF (13,321,723), without regenerating any report or changing the API.

### Earlier release verification

The neutral frontend follow-up built image
`3dd92c1e0a6816f3fbfa9d0c68378f671b2a17c7dfccaae44e5705bdf9eb3e49`.
Its build passed 24 unit/integration tests, seven-accent browser checks in both
themes, and offline global/local npm installs plus packaged GUI verification.
Live Docker checks on localhost:3000 confirmed the neutral default, readable
selector label, custom-accent persistence, both modes, five responsive widths,
no page errors, and preservation of all 13 previous audit IDs. Source/architecture
documentation checks passed, including rendering all three Mermaid diagrams.
The npm artifact includes the updated frontend; existing audit reports were
preserved. Subsequent paragraphs retain the preceding report-engine validation.

The branding refresh adds an Imagegen mark embedded in standalone HTML/PDF and
bundled in the frontend. Its exact prompt and provenance live under
`assets/branding/README.md`. The current self-audit passes at 91/100 with 100%
execution coverage and 146 findings/observations, producing all four formats.

The full private repository rerun completed all 12 selected scanners at 100% coverage,
scoring 96/100 with 13,718 findings, including 188 critical flags requiring triage.
The critical gate fails independently of the overall score. Initial
single-document PDF printing failed explicitly; bounded section rendering repaired
publication without changing canonical evidence. The resulting PDF has 4,678
numbered pages and every one of the 13,718 canonical finding fingerprints.
Poppler extraction verified completeness, and first/appendix/final pages were
rendered and visually inspected. All 371 source hashes match after scanning.
A live frontend drill-down verified the 188-critical slice, 50-item pages,
references, both palettes, mobile geometry, and no automatic external requests.

The new `pdf-lib@1.17.1` dependency is pinned and bundled. Initial Docker
packaging correctly failed when npm normalized `bundleDependencies: true` into
an explicit list before adding that dependency. The list and lock now include
it, and `prepare-package.mjs` rejects omitted runtime bundles. Fresh empty-cache
npm global/local installs and packaged GUI checks passed after correction.
The final image `3d62bcad12f7cbe18a6c2ec0bdc652be2937e3c81477671d6dde824fcf060f0c`
built successfully with all 23 tests, browser checks, and empty-cache offline npm
installs. It regenerated the full private repository report under a non-root, read-only-root,
network-disabled, 6 GiB/4 CPU/256 PID container in 61 seconds. The final PDF has
4,678 pages, no JavaScript, and every canonical finding fingerprint. Compose is
healthy on localhost:3000, serves the actual 188-critical drill-down in both
themes, and returns HTTP 200 with matching hashes for all four attachments.
All 12 prior audit IDs are preserved; history now has 13 records. The source bind
remains read-only and the application uses the internal isolated network.

The release image built successfully and executes the unit/integration and browser
suites during its build. Compose serves the complete appliance through an
unprivileged Nginx 1.30.6 gateway while the scanner container remains isolated.
Final repeat testing exposed an unavailable protected `.codex` metadata mount;
private agent settings, credentials, and npm caches are now explicitly excluded.
The regression checks these exclusions and prevents architecture-document paths
from bypassing them. API integration tests exercise repeated jobs in one server.
The validation commands are:

```sh
npm run build
npm run check:docs
npm test
npm run test:e2e
npm run self-audit
npm run package
npm run test:package
docker build --platform linux/amd64 -t antislopscan:latest .
docker compose up -d --no-build
```

Docker images are pinned by version/digest, scanner versions are locked, and
native archives are checksum-verified. Report mounts
in one-shot checks are outside the audited repository. Optional unavailable tools
are not claimed to have executed. AI tests use a controlled local provider and do
not establish the semantic accuracy of any particular model.

## Review limits

This is functional/regression verification, not an independent penetration test,
load benchmark, or calibrated study of scanner precision. Scores are explained
heuristics. Broad semantic principles remain unassessable without additional
requirements/runtime evidence. Git history, full project type checking, and
the documented unavailable integrations remain explicit limitations.

The UI delivery gate and individual control evidence are in `UI_REVIEW.md`.
