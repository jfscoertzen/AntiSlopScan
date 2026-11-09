# Testing and delivery gates

AntiSlopScan uses Jest 30.5.2 for backend, CLI, distribution and browser test
results. The UI scenarios use the existing Playwright 1.56.0 dependency to drive
Chromium against a real Fastify server, SQLite history and audit workers.
Tests use disposable repositories and local model-provider fixtures. They never
scan an operator's repository or call a paid model provider.

## Run the pipeline locally

From a normal Linux x86_64 Git checkout, with Node 22.22.3+ and Docker available:

```sh
npm run ci:docker
```

This builds the pinned appliance, runs all gates, assembles the npm/executable
archives and smoke-tests the executable. It **does not publish** an image, npm
package or GitHub release. Host npm dependencies are not required for this command.
The test container uses the host UID/GID, a read-only application tree and Git
history mount, no capabilities, no Docker socket, a 6 GiB memory limit, four CPUs,
512 processes and a 2 GiB temporary filesystem. This CI-only `/tmp` mount allows
execution so the suite can launch its freshly installed trusted CLI and bundled
scanner binaries. Production Compose retains its separate `noexec` policy.
Docker is used only by the host
wrapper. A normal `.git` directory is required for this Docker command.
Full CI also requires an exported `SNYK_TOKEN` with dependency and Code scan
access. GitHub uses the repository secret of the same name and optional
`SNYK_ORG` variable. See [Snyk setup and remediation](SNYK.md). Build/test processes
do not inherit that credential; only the final Snyk stage receives it.

The equivalent application gates can run directly with the full local toolchain
installed as described in the [README](../README.md#local-development):

```sh
npm ci --ignore-scripts
npm run ci:local
```

`ci:local` builds, type-checks application/UI/tests, checks callable documentation,
prepares the npm tarball, then runs the ordered gates. It needs the pinned native
and Python scanners, Chromium/system dependencies, `git` and `prlimit`. The Docker
command additionally verifies the portable executable archive using the exact
image that GitHub will publish. Installation/build downloads and the dependency
advisory check need network access. Offline repository scanning remains supported;
an unavailable advisory service fails CI rather than reporting a clean scan.

Individual commands after `npm run build`:

| Command | Purpose |
| --- | --- |
| `npm test` | Jest backend and CLI projects |
| `npm run test:backend` | API, core, scanner, security and regression tests |
| `npm run test:cli` | Real executable modes, paths, exit codes and GUI startup |
| `npm run test:ui` | Jest-managed Playwright dashboard and model-review scenarios |
| `npm run test:e2e` | Alias for `test:ui` |
| `npm run package:built && npm run test:distribution` | Fresh offline global/local npm installations and packaged GUI |
| `npm run test:package` | Alias for `test:distribution` |
| `npm run test:sast` | ESLint/Semgrep, redacted history/working-tree secret scans and npm advisories |
| `npm run test:slop` | Full appliance self-audit, including architecture boundaries |
| `npm run test:snyk` | Pinned Snyk dependency and Code cloud scans, including dev dependencies and high/critical gating |
| `npm run check:tests` | Strict TypeScript checking of tests |
| `npm run ci:verify` | Ordered gates for an already built, fully provisioned checkout/image |

`ANTISLOPSCAN_CI_OUTPUT=/absolute/path npm run ci:docker` changes evidence storage.
The default is `artifacts/ci/`. Self-audit/SAST reports are produced outside the
source tree before being copied unchanged into this ignored evidence folder.
Changing this folder does not change CLI report
output semantics.

## Gate order and release behavior

1. Build and preflight: locked dependencies, TypeScript/Vue/test type checks and
   callable documentation.
2. Backend Jest tests, including real scanner integrations and critical-module
   coverage thresholds.
3. CLI Jest tests.
4. Distribution Jest tests: empty-cache offline installations, bundled scanners,
   report generation and packaged GUI.
5. UI Jest tests driving Playwright.
6. SAST/security: appliance-owned ESLint and offline Semgrep rules, Gitleaks over
   all fetched Git history and the working tree, and `npm audit --include=dev`
   over the complete lockfile, including build/test dependencies even when the
   container sets `NODE_ENV=production`. The working-tree policy excludes generated
   dependencies and ignored operator configuration; the history scan has no such
   path exclusions, so committed secrets remain detectable. Critical or major
   security findings, high/critical advisories, execution failure or
   missing scanner coverage fail the gate. This is static analysis, not proof
   that a release has no vulnerabilities.
7. Self-audit: the existing `config/self-audit.json` scoring policy, 100% applicable
   execution coverage and no configured architecture-boundary violations. AI is
   disabled, keeping this gate deterministic and independent of model services.
8. Snyk: independently run dependency and Code scans, retain all severities,
   reject missing/invalid evidence and block on high/critical findings. Missing
   credentials or unavailable scans fail rather than pass. Both scans are attempted
   within this gate, even if the first fails. No arbitrary Snyk score is derived.
9. Docker path: checksummed npm/executable archives and a real portable CLI smoke
   audit using the extracted Node binary and bundled JavaScript scanners.
10. Only on an alpha release tag: publish the **saved verified image** and archives.

A failed stage marks later application stages **skipped** in `summary.json` and
returns nonzero. Skipped Jest tests, empty suites, missing completion records and
scanner errors cannot produce a passing gate. There are no automatic test retries.
Browser/package child scenarios must explicitly confirm successful completion.

[ci.yml](../.github/workflows/ci.yml) and
[release.yml](../.github/workflows/release.yml) both call
[verify.yml](../.github/workflows/verify.yml), which invokes the same Docker npm
command. The release's `publish` job has `needs: verify`; it downloads the verified
image and archives without rebuilding. Only that job receives `DOCKER_TOKEN` and
GitHub release-write permission. The tag must match `package.json`. Existing alpha
tag conventions, Docker Hub destination and application versions are preserved.

## The ten testing pillars

| Pillar | Implemented evidence and gate |
| --- | --- |
| Functional correctness | `api.test.ts`, `cli.test.ts`, `audit.test.ts`: validated API jobs, persisted artifacts, source preservation, scoring/CI decisions and CLI exit codes 0/1/2/3. |
| Coverage | V8 coverage in the backend project: at least 80% lines, statements and functions; 70% branches across scoring, finding normalization/deduplication, review grouping, path confinement and dependency-cycle analysis. These are critical-module thresholds, **not whole-application coverage**. Separate functional scenarios cover workers and browsers. |
| Reliability | No fixed browser ports, arbitrary browser sleeps or automatic retries. Playwright waits for visible state/downloads; API/startup polling checks conditions with finite deadlines. Graph results are checked for repeatability. |
| Isolation | Per-test temporary repositories/databases, independent browser contexts and local synthetic HTTP providers. Pipeline subprocesses remove operator AI settings and credential variables. No external model credentials enter fixtures. |
| Edge cases | Malformed JSON/options/output, absent jobs, pagination bounds, symlink escapes, inventory/output limits, comments-only inputs, empty graphs and missing scanners. |
| Integration integrity | Actual API → queue → worker → SQLite → exports; offline npm installs; real scanner binaries; Playwright assessment/history/export flows; controlled provider wire contracts. No mocked scanner findings. |
| Architectural integrity | Graph/boundary regression fixtures and the configured source-layer boundaries enforced as a hard self-audit gate. |
| Security | Authentication, CSRF/origin authority, path confinement, report escaping, repository configuration non-execution, resource limits, consent/citation validation, SAST, history/working-tree secret scanning and dependency advisories. |
| Performance | A 20,000-module cycle must complete within 10 seconds without stack overflow; 100 isolated authenticated history requests must complete within 10 seconds. Per-stage deadlines and container resource limits bound runaway work. These generous CI regression budgets are not production latency/throughput guarantees. |
| Regression protection | All prior test suites migrated to Jest; UI scenarios retain filtering, drill-down, exports, theme/contrast, motion and six viewport sizes. `pipeline.test.mjs` verifies fail-closed gate ordering and child deadlines. |

## Viewable CI reports and screenshot evidence

Every managed run writes `pipeline.json`, recording preflight/build, each test
project, security, self-audit and (in Docker mode) cleanup/archive/executable
steps. Reports are generated in `finally`, including when a gate fails. Pending
steps become skipped; missing Jest outcomes are never inferred to have passed.
HTML is written before PDF rendering. If Chromium or report evidence validation
fails, `report-status.json` records that failure and the command returns nonzero.
If dependencies/browser installation itself is unavailable, HTML remains the
fallback; the report does not pretend a PDF exists. Release publication is a
separate gated job and is explicitly pending or not requested in verification
reports, rather than claimed as completed.

Open `artifacts/ci/ci-report.html` or `artifacts/ci/ci-report.pdf`. The HTML embeds
branding and all screenshot pixels and needs no server/CDN/network. It provides
chapter navigation and expandable test/log details. The printable PDF expands
all details, repeats table headers and includes page numbers. Both include:

- Actual gate status, duration and failure context, including unexecuted steps.
- Every individual Jest case, source contract, exact assertions, duration and
  assertion failures. Delegated browser/package checks point to their scenarios.
- Critical-module line/statement/function/branch coverage with explicit scope.
- Scanner versions/execution outcomes, finding distributions, dependency
  advisories and self-audit results. Lower-severity issues remain visible.
- Snyk dependency/Code completion, durations, exit codes, all severity counts,
  fix versions, dependency paths, source/data-flow evidence and advisory links.
  The collector checks current raw scans against their run summary.
- Captioned feature screenshots and the complete appearance/viewport matrix.
- Bounded, escaped and credential-redacted diagnostic excerpts.

The source inventory and screenshot table below are generated by
`npm run docs:tests`. `npm run check:testing` rejects stale documentation; the
full pipeline requires it. Run `npm run ci:report` to regenerate documents from
an existing `pipeline.json` and its unchanged evidence. It must be run against the
same source/test inventory; adding tests after an older run creates an honest
missing-evidence failure instead of a false pass.

Each browser scenario writes `ui-dashboard/evidence.json` or
`ui-model/evidence.json` plus one PNG for every declared checkpoint. The browser
case fails if any required checkpoint is missing. Manifest run IDs prevent
reuse of another run's screenshots; SHA-256, PNG signatures, regular-file/path
checks, freshness checks and size budgets are verified when building the report.
Inputs of type password are masked only when visible. Screenshots show controlled
fixture UI, not private operator repositories. Captions distinguish visual state
from the assertions that verify clipboard contents, network behavior, downloads
or animation properties. Each tested theme/accent/viewport combination has its
own image; these are layout evidence, not invented trends or analytics.

Raw evidence includes stage logs/Jest JSON, `summary.json`, `pipeline.json`, LCOV,
SAST JSON/SARIF, redacted secret SARIF, advisory JSON, self-audit formats,
`executable.json`, `release/SHA256SUMS` and `report-status.json`. Failed browser
contexts retain screenshots and `trace.zip` when a context could be created:

```sh
node node_modules/playwright/cli.js show-trace artifacts/ci/ui-dashboard/trace.zip
```

GitHub always uploads `antislopscan-ci-report` separately from
`verification-evidence`, and links the report artifact in the job summary.
The download requires the GitHub access granted to that Actions run. Reports and
raw evidence remain available for 14 days. The runtime tests preserve failure
artifacts; a passing run never changes an earlier failure to a pass.

Only fixture source is present in browser traces. Review artifacts before sharing them; local
self-audit reports contain this checkout's code evidence. Never store keys in
fixtures or captured logs.

Jest transpiles tests using the already pinned TypeScript compiler, then runs ESM
with `--experimental-vm-modules`; type checking is a separate required gate.
Fastify itself is loaded unmodified in the test environment through Node's loader
because its CommonJS dependency requires ESM and Jest's VM supports that operation
only on Node 24.9+. Application modules remain instrumented. See
[Jest ESM support](https://jestjs.io/docs/ecmascript-modules) and
[code transformation](https://jestjs.io/docs/code-transformation).

The optional real-scanner test may skip in a partial developer installation;
the full pipeline rejects that skip. Sandboxes that prohibit local TCP listeners,
scanner subprocess controls, Docker access or registry access cannot complete
these gates. Fix those prerequisites; do not disable tests or count them as passing.

<!-- test-inventory:start -->

## Every registered test case

This inventory is extracted from the test source. Each case lists its stated contract and actual assertion expressions. Assertions inside loops run for each fixture/combination; this list is not a runtime assertion count. On an early failure, later assertions were not reached. Browser screenshots and manifests provide the visual checkpoints described below.

### backend-adapters-adapterContract

**all bundled scanners execute and normalize actual JS/TS/Python evidence**

Project: backend. Source: [tests/adapters.test.ts:59](../tests/adapters.test.ts).

Exercise the actual pinned toolchain and verify reported execution, normalization, and credential minimization.

Actual checks:

~~~typescript
expect({ id, status }).toEqual({ id, status: 'completed' });
expect(result.scores.coverage).toBe(92);
expect(result.ci.passed).toBe(false);
expect(result.ci.exitCode).toBe(1);
expect(result.findings.some(hasGitleaks)).toBe(true);
expect(result.findings.some((finding) => ['057', '069', 'slop/unfinished-comment', 'design/duplication'].includes(finding.ruleId))).toBe(false);
expect(await readFile(join(output, 'report.json'), 'utf8')).not.toContain(syntheticAwsId);
~~~

### backend-ai-assessment-assessmentContract

**LLM scores require complete batches and cited evidence; uncertainty and partial failures never pass**

Project: backend. Source: [tests/ai-assessment.test.ts:93](../tests/ai-assessment.test.ts).

Require exact sample evidence, valid IDs, uncertainty exclusion, confidence, and complete batch accounting.

Actual checks:

~~~typescript
expect(validatePrincipleBatch({ assessments: [review] }, ['CQS'], [sample])[0].score).toBe(90);
expect(() => validatePrincipleBatch({ assessments: [{ ...review, evidence: [{ ...review.evidence[0], line: 1 }] }] }, ['CQS'], [sample])).toThrow();
expect(() => validatePrincipleBatch({
    assessments: [
        { ...review, evidence: [{ ...review.evidence[0], quote: 'invented source evidence' }] }
    ]
}, ['CQS'], [sample])).toThrow();
expect(() => validatePrincipleBatch({ assessments: [review] }, ['DRY'], [sample])).toThrow();
expect(() => validatePrincipleBatch({ assessments: [review, review] }, ['CQS'], [sample])).toThrow();
expect(() => validatePrincipleBatch({ assessments: [{ ...review, confidence: 0.2 }] }, ['CQS'], [sample])).toThrow();
expect(() => validatePrincipleBatch({ assessments: [{ ...review, assessment: 'not_assessable' }] }, ['CQS'], [sample])).toThrow();
expect(resolved[0].evidence[0].line).toBe(10);
expect(resolved[0].evidence[0].quote).toContain('export const read');
expect(() => resolvePrincipleReferences({ assessments: [{ ...wire, evidenceIds: ['OUTSIDE'] }] }, ['CQS'], [sample])).toThrow();
expect(validatePrincipleBatch({ assessments: [unknown] }, ['CQS'], [sample])[0].score).toBeNull();
expect(summarizeAiScore([review, unknown] as never, false)).toEqual({ score: 90, assessedPrinciples: 1 });
expect(summarizeAiScore([review] as never, true).score).toBeNull();
expect(summarizeAiScore([], false).score).toBeNull();
~~~

### backend-ai-evidence-evidenceContract

**AI source sampling preserves redaction and exact UTF-8 byte limits**

Project: backend. Source: [tests/ai-evidence.test.ts:70](../tests/ai-evidence.test.ts).

Enforce the source/document byte budget and secret redaction at multibyte UTF-8 boundaries.

Actual checks:

~~~typescript
expect(Buffer.byteLength(source + documents)).toBeLessThanOrEqual(1024);
expect(source).not.toContain('fixture-secret-value');
expect(source + documents).not.toContain('\uFFFD');
expect(source).not.toContain('@license');
expect(input.samples[0].startLine).toBe(6);
expect(input.samples).toHaveLength(2);
~~~

### backend-ai-providers-providerContract

**LLM providers honor native wire contracts and retain honest evidence-backed architecture grades**

Project: backend. Source: [tests/ai-providers.test.ts:180](../tests/ai-providers.test.ts).

Verify native protocols, bounded structured grading, and visible partial failure through actual HTTP.

Actual checks:

~~~typescript
expect(await requestAi(settings, 'untrusted data', {}, AbortSignal.timeout(10000))).toEqual({
    ok: true
});
expect(headers.at(-1)!['x-api-key']).toBe('fixture-credential');
expect(headers.at(-1)!['anthropic-version']).toBe('2026-10-21');
expect(headers.at(-1)!.authorization).toBe('Bearer fixture-credential');
expect(bodies.at(-1)!.max_completion_tokens).toBe(8192);
expect(bodies.at(-1)!.stream).toBe(false);
expect(result.status).toBe('completed');
expect(result.aiArchitecture?.score).toBe(78);
expect(result.aiArchitecture?.requestedPrinciples).toBe(56);
expect(result.aiArchitecture?.assessedPrinciples).toBe(2);
expect(result.aiArchitecture?.principles[0].evidence[0].quote).toContain('authoritativeValue');
expect(withAi.scores).toEqual(staticResult.scores);
expect(withAi.principles).toEqual(staticResult.principles);
expect(withAi.erosion).toEqual(staticResult.erosion);
expect(withAi.aiArchitecture?.score).toBe(78);
expect(withAi.findings.some((finding) => finding.method === 'ai_assisted' && finding.assessment === 'informational')).toBe(true);
expect(partial.status).toBe('failed');
expect(partial.aiArchitecture?.score).toBeNull();
expect(partial.aiArchitecture?.status).toBe('partial');
expect(partial.aiArchitecture?.errors.length).toBeGreaterThan(0);
await expect(executeAi(context, AbortSignal.timeout(10000))).rejects.toThrow('not been explicitly enabled');
~~~

### backend-ai-settings-settingsContract

**AI settings layer explicit CLI over trusted JSON over deployment environment**

Project: backend. Source: [tests/ai-settings.test.ts:75](../tests/ai-settings.test.ts).

Verify environment, trusted JSON and explicit CLI precedence without automatic repository dotenv loading.

Actual checks:

~~~typescript
expect((await loadConfig()).ai.model).toBe('deployment-model');
expect((await loadConfig(path)).ai.model).toBe('file-model');
expect(final.ai.enabled).toBe(true);
expect(final.ai.model).toBe('cli-model');
expect(final.ai.maxSourceBytes).toBe(4096);
expect(final.ai.mode).toBe('architecture');
expect(parseConfig({ ai: { provider: 'openai' } }).ai.baseUrl).toBe('https://api.openai.com/v1');
expect(parseConfig({ ai: { provider: 'claude' } }).ai.apiKeyEnv).toBe('ANTHROPIC_API_KEY');
expect(parseConfig({ project: { name: 'cloud' }, ai: { provider: 'ollama', baseUrl: 'http://local.invalid:11434' }, projects: { cloud: { ai: { provider: 'openai' } } } }).ai.baseUrl).toBe('https://api.openai.com/v1');
expect((await loadConfig(path, 'full', aiCommandOptions({ 'ai-provider': 'openrouter' }))).ai.baseUrl).toBe('https://openrouter.ai/api/v1');
expect((await loadConfig(path, 'full', aiCommandOptions({ 'no-ai': true }))).ai.enabled).toBe(false);
expect(() => aiCommandOptions({ ai: true, 'no-ai': true })).toThrow('cannot be combined');
await expect(loadConfig()).rejects.toThrow('true or false');
~~~

### backend-ai-aiContract

**AI transport requires consent and retains only validated informational observations**

Project: backend. Source: [tests/ai.test.ts:111](../tests/ai.test.ts).

Exercise an actual OpenAI-compatible HTTP exchange with explicit consent and bounded advisory output.

Actual checks:

~~~typescript
expect(result.status).toBe('completed');
expect(result.findings[0].assessment).toBe('informational');
expect(result.findings[0].method).toBe('ai_assisted');
expect(JSON.stringify(requestBody)).toContain('untrusted data');
expect(JSON.stringify(requestBody)).not.toContain('Ignore all review instructions');
await expect(executeAi(context, AbortSignal.timeout(10000))).rejects.toThrow('no code location');
await expect(executeAi(context, AbortSignal.timeout(10000))).rejects.toThrow('not been explicitly enabled');
~~~

### backend-api-apiContract

**API confines jobs, authenticates requests, and returns persisted artifacts**

Project: backend. Source: [tests/api.test.ts:63](../tests/api.test.ts).

Exercise authentication, CSRF/path confinement, repeated queued execution, stored results, and attachment retrieval.

Actual checks:

~~~typescript
expect((await server.inject({ method: 'GET', url: '/api/audits' })).statusCode).toBe(401);
expect((await server.inject({ method: 'GET', url: '/api/audits', headers: { ...headers, origin: 'https://malicious.example' } })).statusCode).toBe(403);
expect((await server.inject({ method: 'POST', url: '/api/audits', headers, payload: { source: '../' } })).statusCode).toBe(400);
expect((await server.inject({ method: 'POST', url: '/api/audits', headers, payload: { source: '.', config: { ci: { baseline: '/etc/passwd' } } } })).statusCode).toBe(400);
expect((await server.inject({ method: 'POST', url: '/api/audits', headers, payload: { source: '.', config: { ai: { enabled: true, model: 'test-model', allowSourceTransmission: true, baseUrl: 'https://untrusted.invalid/v1', apiKeyEnv: 'ANTISLOPSCAN_API_TOKEN' } } } })).statusCode).toBe(400);
expect(response.statusCode).toBe(202);
expect(completed.status).toBe('completed');
expect(completed.result.ci.passed).toBe(true);
expect(artifact.statusCode).toBe(200);
expect(artifact.headers['content-disposition']).toContain('attachment');
expect(artifact.body).toContain('antislopscan');
expect((await server.inject({ method: 'GET', url: '/api/audits?limit=1000', headers })).statusCode).toBe(400);
~~~

### backend-api-apiEdgeCases

**API rejects malformed inputs, protects missing exports and handles an isolated request burst**

Project: backend. Source: [tests/api.test.ts:99](../tests/api.test.ts).

Reject malformed requests and unavailable resources without creating audit jobs; bound a small authenticated request burst.

Actual checks:

~~~typescript
expect((await server.inject({ method: 'POST', url: '/api/audits', headers: { ...headers, 'content-type': 'application/json' }, payload: '{invalid' })).statusCode).toBe(400);
expect((await server.inject({ method: 'POST', url: '/api/audits', headers, payload: {} })).statusCode).toBe(400);
expect((await server.inject({ method: 'GET', url: '/api/audits/00000000-0000-4000-8000-000000000000', headers })).statusCode).toBe(404);
expect((await server.inject({ method: 'GET', url: '/api/audits/missing/reports/html' })).statusCode).toBe(401);
expect((await server.inject({ method: 'GET', url: `/api/audits?${query}`, headers })).statusCode).toBe(400);
expect(response.statusCode).toBe(200);
expect(response.json().audits).toEqual([]);
expect(performance.now() - started).toBeLessThan(10000);
~~~

### backend-appearance-accentContract

**accent preferences accept only the supported palette identifiers**

Project: backend. Source: [tests/appearance.test.ts:18](../tests/appearance.test.ts).

Preserve each supported selection and use the neutral default for absent or hostile browser storage.

Actual checks:

~~~typescript
expect(normalizeAccent(option.id)).toBe(option.id);
expect(normalizeAccent(value)).toBe('neutral');
expect(accentOptions).toHaveLength(7);
~~~

### backend-audit-auditContract

**audits preserve source and report supported structure and historical change**

Project: backend. Source: [tests/audit.test.ts:115](../tests/audit.test.ts).

Exercise analysis, boundary evidence, report safety, immutable inputs, baseline deltas, and CI decisions.

Actual checks:

~~~typescript
expect(first.graph.cycles).toHaveLength(1);
expect(first.findings.some(isBoundary)).toBe(true);
expect(first.findings.some(isEmptyCatch)).toBe(true);
expect(first.erosion.basis).toBe('current_structural_risk');
expect(first.ci.passed).toBe(true);
expect(await readFile(join(source, 'a.ts'), 'utf8')).toBe(original);
await expect(stat(sentinel)).rejects.toThrow();
expect(html).toContain('&lt;script&gt;alert');
expect(html).not.toContain('<script>alert("injected")</script>');
expect(html).toContain('data:image/png;base64,');
expect(html).toContain('Where to look first');
expect(html).toContain('id="theme"');
expect(html).toContain('data-finding');
expect(html).toContain('https://eslint.org/docs/latest/rules/no-empty');
expect(html).toContain("connect-src 'none'");
expect(JSON.parse(await readFile(join(output, 'report.sarif.json'), 'utf8')).version).toBe('2.1.0');
await expect(runAudit(config, { source, output })).rejects.toThrow('Report publication');
expect(JSON.parse(await readFile(join(output, 'report.json'), 'utf8')).id).toBe(first.id);
expect(second.erosion.basis).toBe('historical_comparison');
expect(second.erosion.deltas.cycles).toBe(-1);
expect(second.erosion.deltas.boundaryViolations).toBe(-1);
expect(second.ci.newHighSeverity).toBe(0);
expect(unavailable.ci.exitCode).toBe(2);
expect(unavailable.scores.coverage).toBe(50);
expect(regression.ci.passed).toBe(false);
expect(regression.ci.newHighSeverity).toBeGreaterThan(0);
expect(evaluateCi(repeatedEvidence, ratchetPolicy, regression).newHighSeverity).toBe(1);
await expect(runAudit(changedPolicy, { source, output: join(directory, 'mismatch'), baseline: first })).rejects.toThrow('Baseline');
~~~

### backend-ci-report-failedJournal

**CI journal preserves failure and downstream skips**

Project: backend. Source: [tests/ci-report.test.mjs:96](../tests/ci-report.test.mjs).

Failed preflight must retain the real error and show all unexecuted downstream stages as skipped.

Actual checks:

~~~typescript
await expect(recorded(directory, 'build', async () => { throw new Error('Fixture compiler failure'); })).rejects.toThrow('Fixture compiler failure');
expect(result.passed).toBe(false);
expect(result.steps.map((step) => step.status)).toEqual(['failed', 'skipped', 'skipped']);
expect(result.steps[0].error).toBe('Fixture compiler failure');
~~~

### backend-ci-report-artifactConfinement

**CI report evidence stays confined, fresh and bounded**

Project: backend. Source: [tests/ci-report.test.mjs:97](../tests/ci-report.test.mjs).

Artifact collection must reject traversal, absolute paths, symlink escape and stale/oversized evidence.

Actual checks:

~~~typescript
expect((await artifact(directory, 'safe.json')).toString()).toBe('{}');
await expect(artifact(directory, '../secret')).rejects.toThrow('traversal');
await expect(artifact(directory, '/etc/passwd')).rejects.toThrow('Absolute');
await expect(artifact(directory, 'escape.json')).rejects.toThrow('symlink');
await expect(artifact(directory, 'safe.json', 1)).rejects.toThrow('limit');
await expect(artifact(directory, 'safe.json', 100, Date.now() + 60000)).rejects.toThrow('Stale');
~~~

### backend-ci-report-resultHonesty

**CI report never invents missing test outcomes or exposes diagnostic credentials**

Project: backend. Source: [tests/ci-report.test.mjs:98](../tests/ci-report.test.mjs).

Missing Jest outcomes stay not-run and unknown executed tests remain visibly unmapped; diagnostic credentials are masked.

Actual checks:

~~~typescript
expect(mapped[0].status).toBe('failed');
expect(mapped[1].status).toBe('not_run');
expect(mapped[2].unmapped).toBe(true);
expect(mapped[0].failures[0]).toContain('[redacted]');
expect(diagnosticText('token=fixture-credential')).not.toContain('fixture-credential');
~~~

### backend-ci-report-escapedHtml

**CI HTML retains real outcomes and escapes hostile evidence**

Project: backend. Source: [tests/ci-report.test.mjs:99](../tests/ci-report.test.mjs).

Branded HTML must retain failed/skipped state, source assertions and captions while escaping hostile evidence.

Actual checks:

~~~typescript
expect(html).toContain('antislopscan');
expect(html).toContain('expect(value).toBe(1)');
expect(html).toContain('skipped');
expect(html).toContain('&lt;script&gt;hostile()&lt;/script&gt;');
expect(html).not.toContain('<script>hostile()');
expect(html).not.toContain('<script>coverage()');
expect(html).toContain('&lt;script&gt;coverage()&lt;/script&gt;');
expect(html).toContain("default-src 'none'");
~~~

### backend-ci-report-inventoryCompleteness

**test inventory covers every registered test and delegated browser assertion**

Project: backend. Source: [tests/ci-report.test.mjs:100](../tests/ci-report.test.mjs).

Every registered suite must expose its actual assertion source, including delegated frontend scenarios.

Actual checks:

~~~typescript
expect(item.purpose.length).toBeGreaterThan(10);
expect(item.checks.length).toBeGreaterThan(0);
expect(titles.has(item.title)).toBe(false);
expect(frontend).toHaveLength(2);
expect(frontend[0].evidenceSource).toBe('tests/browser.mjs');
expect(frontend[1].evidenceSource).toBe('tests/browser-ai.mjs');
~~~

### backend-ci-report-failureDocuments

**failed CI runs still produce branded HTML and PDF evidence**

Project: backend. Source: [tests/ci-report.test.mjs:109](../tests/ci-report.test.mjs).

A real failing syntax check must still produce readable HTML/PDF with failed/skipped stages and no fabricated test passes.

Assertions run by the delegated scenario: [tests/ci-report-failure.mjs](../tests/ci-report-failure.mjs).

Actual checks:

~~~typescript
await assert.rejects(recorded(output, 'build', async () => command(process.execPath, ['--check', join(temporary, 'broken.js')], { log: join(output, 'build.log') })));
assert.equal(journal.passed, false);
assert.deepEqual(journal.steps.map((step) => step.status), ['failed', 'skipped', 'skipped']);
assert.match(html, /controlled-failure-fixture/);
assert.match(html, /failed/);
assert.match(html, /skipped/);
assert.ok(pdf.getPageCount() > 0);
assert.equal(status.pdf, 'completed');
assert.equal(status.evidenceValid, true);
~~~

### backend-ci-report-missingVisualEvidence

**frontend completion requires screenshot evidence for every declared feature**

Project: backend. Source: [tests/ci-report.test.mjs:130](../tests/ci-report.test.mjs).

A browser scenario cannot report completion when a declared feature has no screenshot.

Actual checks:

~~~typescript
await expect(evidence.complete()).rejects.toThrow('Missing visual evidence');
await expect(evidence.capture(undefined, 'undeclared')).rejects.toThrow('Undeclared');
expect(manifest.complete).toBe(false);
expect(manifest.captures).toEqual([]);
expect(manifest.expected).toContain('citation');
~~~

### cli-cli-commandContract

**public CLI exposes the renamed executable and explicit mode contracts**

Project: cli. Source: [tests/cli.test.ts:167](../tests/cli.test.ts).

Verify the public executable and help expose both modes and reject ambiguous output or irrelevant options.

Actual checks:

~~~typescript
expect(manifest.name).toBe('antislopscan');
expect(manifest.bin.antislopscan).toBe('dist/cli.js');
expect(help.exitCode).toBe(0);
expect(help.stdout).toContain('antislopscan cli');
expect(help.stdout).toContain('antislopscan gui');
expect(launcher.stdout).toBe(help.stdout);
expect(missingOutput.exitCode).toBe(3);
expect(missingOutput.stderr).toContain('--output');
expect(invalidOption.exitCode).toBe(3);
expect(invalidOption.stderr).toContain('--port');
expect(invalidProfile.exitCode).toBe(3);
expect(invalidProfile.stderr).toContain('--profile');
~~~

### cli-cli-outputContract

**CLI reports go to the user-selected output directory**

Project: cli. Source: [tests/cli.test.ts:168](../tests/cli.test.ts).

Verify a real CLI scan writes artifacts only to the requested folder, including spaces, and preserves source.

Actual checks:

~~~typescript
expect(result.exitCode).toBe(0);
expect(summary.outputDirectory).toBe(output);
expect((await readdir(output)).sort()).toEqual(['report.html', 'report.json', 'report.sarif.json']);
expect(await readFile(join(output, 'report.html'), 'utf8')).toContain('antislopscan');
expect(JSON.parse(await readFile(join(output, 'report.json'), 'utf8')).ci.passed).toBe(true);
expect(await readFile(join(source, 'index.ts'), 'utf8')).toBe('export const answer = 42;\n');
expect((await readdir(directory)).sort()).toEqual(['chosen reports', 'config.json', 'source']);
~~~

### cli-cli-guiContract

**GUI mode starts the browser application using selected paths**

Project: cli. Source: [tests/cli.test.ts:169](../tests/cli.test.ts).

Verify GUI mode starts an authenticated browser application with explicit source/state folders and shuts down cleanly.

Actual checks:

~~~typescript
expect(ready).toBe(true);
expect((await fetch(`http://127.0.0.1:${port}/api/audits`)).status).toBe(401);
expect((await fetch(`http://127.0.0.1:${port}/api/audits`, { headers: { authorization: `Bearer ${token}` } })).status).toBe(200);
expect(await (await fetch(`http://127.0.0.1:${port}/`)).text()).toContain('<title>antislopscan');
expect(JSON.parse(stdout).mode).toBe('gui');
expect(JSON.parse(stdout).dataDirectory).toBe(state);
expect(await readdir(source)).toEqual([]);
~~~

### cli-cli-environmentContract

**renamed deployment settings retain legacy compatibility**

Project: cli. Source: [tests/cli.test.ts:170](../tests/cli.test.ts).

Verify legacy settings remain effective and an explicit renamed setting wins without falling through on empty values.

Actual checks:

~~~typescript
expect(environmentSetting('RETENTION')).toBe('25');
expect(environmentSetting('RETENTION')).toBe('50');
expect(environmentSetting('RETENTION')).toBe('');
~~~

### cli-cli-exitCodeContract

**CLI returns distinct quality, scanner and configuration failure exit codes**

Project: cli. Source: [tests/cli.test.ts:211](../tests/cli.test.ts).

Distinguish a quality failure, missing scanner and invalid input using real built CLI runs and valid machine-readable reports.

Actual checks:

~~~typescript
expect(quality.exitCode).toBe(1);
expect(qualityReport.ci.passed).toBe(false);
expect(qualityReport.findings.some((finding: {
    severity: string;
}) => finding.severity === 'critical')).toBe(true);
expect(unavailable.exitCode).toBe(2);
expect(scannerReport.scanners.find((scanner: {
    id: string;
}) => scanner.id === 'knip').status).toBe('unavailable');
expect(invalid.exitCode).toBe(3);
expect(missing.exitCode).toBe(3);
expect((await readdir(directory)).includes('invalid')).toBe(false);
expect(await readFile(join(source, 'index.ts'), 'utf8')).toBe('export const execute = (input: string) => eval(input);\n');
~~~

### backend-comments-commentAssessment

**code assessments ignore comments throughout files while retaining real implementation risks**

Project: backend. Source: [tests/comments.test.ts:97](../tests/comments.test.ts).

Comments cannot create duplicates, inflate module size or satisfy an implementation requirement.

Actual checks:

~~~typescript
expect(rules).not.toContain('design/duplication');
expect(rules).not.toContain('architecture/module-size');
expect(rules).not.toContain('slop/unfinished-comment');
expect(rules).toContain('requirements/deadline');
expect(rules).toContain('systems/fetch-timeout');
expect(input.samples).toHaveLength(2);
expect(sample.content).not.toContain('Duplicated explanatory');
expect(sample.content).not.toContain('TODO');
expect(sample.content).not.toContain('signal: pretend');
expect(sample.content).toContain("fetch('/api'");
expect(sample.startLine).toBe(124);
~~~

### backend-comments-productionVueComments

**Vue template comments stay excluded in production containers**

Project: backend. Source: [tests/comments.test.ts:173](../tests/comments.test.ts).

Container production mode must retain template comment spans while preserving comment-like attribute values and coordinates.

Actual checks:

~~~typescript
expect(code).not.toContain('excluded template comment');
expect(code).toContain('<!-- literal -->');
expect(code.length).toBe(source.length);
expect(code.indexOf('value')).toBe(source.indexOf('value'));
~~~

### backend-comments-literalContract

**comment masking preserves code literals, JSX/templates, raw strings and original coordinates**

Project: backend. Source: [tests/comments.test.ts:228](../tests/comments.test.ts).

Preserve source literals and exact locations across compiler and lexical comment views.

Actual checks:

~~~typescript
expect(code).not.toContain('REMOVE');
expect(code.length).toBe(source.length);
expect(code.split('\n').length).toBe(source.split('\n').length);
expect(code).toContain(literal);
~~~

### backend-comments-implementationClone

**DRY still detects repeated code across differing comments**

Project: backend. Source: [tests/comments.test.ts:232](../tests/comments.test.ts).

Real duplicated implementation remains detectable across different intervening comments.

Actual checks:

~~~typescript
expect(duplicates).toHaveLength(1);
expect(duplicates[0].line).toBe(2);
~~~

### backend-comments-scoreIsolation

**comments do not affect quality scores and comments-only inputs remain unassessed**

Project: backend. Source: [tests/comments.test.ts:269](../tests/comments.test.ts).

Adding comments cannot change density scores; a comments-only repository cannot claim assessed quality.

Actual checks:

~~~typescript
expect(second.scores).toEqual(first.scores);
expect(second.findings[0].line).toBe(123);
expect(empty.findings).toEqual([]);
expect(empty.scores.overall).toBeNull();
expect(empty.scores.coverage).toBe(0);
~~~

### backend-core-configurationContract

**configuration rejects unsafe or unsupported options**

Project: backend. Source: [tests/core.test.ts:55](../tests/core.test.ts).

Verify strict option validation and supported appliance defaults.

Actual checks:

~~~typescript
expect(parseConfig({ version: '1.0' }).audit.parallelScanners).toBe(4);
expect(parseConfig({}, 'portable').scanners.rustAntiSlop.enabled).toBe(false);
expect(parseConfig({}, 'portable').reports.formats).toEqual(['html', 'json', 'sarif']);
expect(parseConfig({ scanners: { rustAntiSlop: { enabled: true } } }, 'portable').scanners.rustAntiSlop.enabled).toBe(true);
expect(() => parseConfig({ audit: { maxFiles: -1 } })).toThrow();
expect(() => parseConfig({ scanners: { eslint: { enabled: true, command: 'evil' } } })).toThrow();
expect(() => parseConfig({ scanners: { eslint: { profile: 'invented' } } })).toThrow();
expect(() => parseConfig({ ai: { enabled: true, allowSourceTransmission: false } })).toThrow();
expect(() => parseConfig({ scoring: { weights: { slop: 0, codeQuality: 0, architecture: 0, systemsThinking: 0, security: 0, maintainability: 0, technicalDebt: 0 } } })).toThrow();
~~~

### backend-core-pathContract

**paths remain confined to the configured root**

Project: backend. Source: [tests/core.test.ts:56](../tests/core.test.ts).

Verify lexical traversal and lookalike root rejection.

Actual checks:

~~~typescript
expect(resolveInside('/workspace', 'src/a.ts')).toBe('/workspace/src/a.ts');
expect(() => resolveInside('/workspace', '../workspace-other/a.ts')).toThrow();
expect(() => resolveInside('/workspace', '/etc/passwd')).toThrow();
~~~

### backend-core-scoreContract

**unavailable analysis never receives an overall score**

Project: backend. Source: [tests/core.test.ts:57](../tests/core.test.ts).

Verify incomplete scanner execution cannot produce a passing score.

Actual checks:

~~~typescript
expect(scores.overall).toBeNull();
expect(scores.coverage).toBe(0);
~~~

### backend-core-cycleContract

**cycles are actual strongly connected components**

Project: backend. Source: [tests/core.test.ts:58](../tests/core.test.ts).

Verify strongly connected components include self-cycles and disconnected cycles.

Actual checks:

~~~typescript
expect(findCycles(['a', 'b', 'c', 'd'], edges)).toEqual([['a', 'b'], ['c']]);
~~~

### distribution-distribution-distribution

**release tarball installs offline and executes CLI scanners and GUI**

Project: distribution. Source: [tests/distribution.test.mjs:12](../tests/distribution.test.mjs).

Verify global/local offline installs, actual scanners and the packaged GUI in disposable prefixes.

Assertions run by the delegated scenario: [tests/package.mjs](../tests/package.mjs).

Actual checks:

~~~typescript
assert.match(help.stdout, /antislopscan cli/);
assert.match(help.stdout, /antislopscan gui/);
assert.equal(command.stdout, help.stdout);
assert.equal(JSON.parse(audit.stdout).outputDirectory, output);
assert.equal(result.ci.passed, true);
assert.equal(result.scores.coverage, 100);
assert.deepEqual((await readdir(output)).sort(), ['report.html', 'report.json', 'report.sarif.json']);
assert.equal(scanner?.status, 'completed', `${id} did not run from ${global ? 'global' : 'local'} dependencies`);
assert.equal(result.scanners.find((scanner) => scanner.id === id)?.status, 'skipped');
assert.match(await readFile(join(installed, 'LICENSE.TXT'), 'utf8'), /Apache License/);
assert.equal(JSON.parse(await readFile(join(installed, 'config/npm-dependencies.lock.json'), 'utf8')).version, manifest.version);
assert.equal((await readdir(join(installed, 'tools'))).includes('python'), false);
assert.equal((await readdir(join(installed, 'tools'))).includes('bin'), false);
assert.equal((await readdir(join(installed, 'node_modules'))).includes('jest'), false);
assert.equal((await readdir(installed)).includes('AGENTS.md'), false);
assert.equal((await readdir(installed)).includes('.env'), false);
assert.equal((await readdir(join(installed, 'config'))).includes('local.json'), false);
assert.equal((await readdir(join(installed, 'docs'))).includes('articles'), false);
assert.ok(address && typeof address !== 'string');
assert.ok(ready, diagnostics);
assert.match(await (await fetch(`http://127.0.0.1:${port}/`)).text(), /<title>antislopscan/);
assert.equal(defaults.config.scanners.rustAntiSlop.enabled, false);
assert.deepEqual(defaults.config.reports.formats, ['html', 'json', 'sarif']);
~~~

### backend-graph-layout-evidenceContract

**dependency visualization preserves real evidence and deterministic geometry**

Project: backend. Source: [tests/graph-layout.test.ts:51](../tests/graph-layout.test.ts).

Verify visualization never invents edges, mutates evidence, or loses self-loops through invalid geometry.

Actual checks:

~~~typescript
expect(layout.edges).toHaveLength(3);
expect(graph.edges).toContainEqual({ from: edge.from, to: edge.to, line: edge.line, typeOnly: edge.typeOnly });
expect(Number.isFinite(node.x)).toBe(true);
expect(Number.isFinite(node.y)).toBe(true);
expect(layout.edges[2].path).not.toContain('NaN');
expect(JSON.stringify(graph)).toBe(original);
expect(layoutDependencies(graph)).toEqual(layout);
~~~

### backend-graph-layout-filterContract

**dependency visualization filters and bounds only the display**

Project: backend. Source: [tests/graph-layout.test.ts:52](../tests/graph-layout.test.ts).

Verify query neighborhoods, runtime-only view, bounds, and unavailable graph states remain honest.

Actual checks:

~~~typescript
expect(runtime.edges.every((edge) => !edge.typeOnly)).toBe(true);
expect(neighborhood.nodes.map((node) => node.file)).toEqual(['src/a.ts', 'src/b.ts']);
expect(layoutDependencies(graph, { maxNodes: 1 }).nodes).toHaveLength(1);
expect(layoutDependencies(graph, { query: 'missing' }).edges).toEqual([]);
expect(layoutDependencies({ nodes: [], edges: [], cycles: [], unresolvedImports: 0 }).nodes).toEqual([]);
~~~

### backend-pdf-mergeContract

**PDF sections merge without losing or reordering pages**

Project: backend. Source: [tests/pdf.test.ts:27](../tests/pdf.test.ts).

Verify generated sections retain every page in order and carry safe document metadata.

Actual checks:

~~~typescript
expect(merged.getPageCount()).toBe(3);
expect(merged.getPages().map((page) => page.getWidth())).toEqual([400, 410, 420]);
expect(merged.getTitle()).toBe('antislopscan audit: Actual audit');
await expect(mergePdfParts([new Uint8Array([0, 1, 2])], 'Invalid', '1.0.0')).rejects.toThrow();
await expect(mergePdfParts([], 'Empty', '1.0.0')).rejects.toThrow('no pages');
~~~

### backend-performance-largeDependencyGraph

**20,000-module cycle analysis stays within a ten-second regression budget**

Project: backend. Source: [tests/performance.test.ts:26](../tests/performance.test.ts).

Detect large connected components without recursive stack overflow or runaway work; this is a CI guardrail, not a production SLO.

Actual checks:

~~~typescript
expect(result).toHaveLength(1);
expect(result[0]).toHaveLength(nodeCount);
expect(findCycles(files, edges)).toEqual(result);
expect(elapsedMs).toBeLessThan(10000);
expect(findCycles([], [])).toEqual([]);
~~~

### backend-pipeline-gateFailures

**verification fails closed after any failed gate**

Project: backend. Source: [tests/pipeline.test.mjs:101](../tests/pipeline.test.mjs).

A failed gate must prevent every later gate from executing, including release prerequisites.

Actual checks:

~~~typescript
expect(executed).toEqual(stages.slice(0, failedIndex + 1).map((stage) => stage.id));
expect(results[failedIndex].status).toBe('failed');
expect(result.status).toBe('skipped');
~~~

### backend-pipeline-successfulGates

**verification preserves gate order and runs each stage once**

Project: backend. Source: [tests/pipeline.test.mjs:102](../tests/pipeline.test.mjs).

A successful verification runs all stages once, without retrying or reordering them.

Actual checks:

~~~typescript
expect(executed).toEqual(['backend', 'cli', 'distribution', 'ui', 'security', 'self-audit', 'snyk']);
expect(results.every((result) => result.status === 'passed')).toBe(true);
~~~

### backend-pipeline-isolatedEnvironment

**verification excludes operator credentials and external provider settings**

Project: backend. Source: [tests/pipeline.test.mjs:103](../tests/pipeline.test.mjs).

Operator credentials and enabled external AI settings must never leak into fixture subprocesses.

Actual checks:

~~~typescript
expect(environment.ANTISLOPSCAN_AI_ENABLED).toBeUndefined();
expect(environment.CODESENTRY_API_TOKEN).toBeUndefined();
expect(environment.OPENAI_API_KEY).toBeUndefined();
expect(environment.DOCKER_TOKEN).toBeUndefined();
expect(environment.SNYK_TOKEN).toBeUndefined();
expect(environment.SNYK_DEBUG).toBeUndefined();
expect(environment.ANTISLOPSCAN_CHROMIUM_SANDBOX).toBe('false');
expect(environment.PATH).toBe(original.PATH);
~~~

### backend-pipeline-subprocessFailures

**verification captures child failures and enforces execution deadlines**

Project: backend. Source: [tests/pipeline.test.mjs:104](../tests/pipeline.test.mjs).

Real child failures and deadline overruns must reject and preserve diagnostics.

Actual checks:

~~~typescript
await expect(command(process.execPath, ['-e', 'process.stderr.write("fixture failure");process.exit(7)'], { log })).rejects.toThrow('Command exited 7');
expect(await readFile(log, 'utf8')).toContain('fixture failure');
await expect(command(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { log, timeoutMs: 50 })).rejects.toThrow('Stage timed out');
~~~

### backend-pipeline-collectedReports

**CI collects unchanged audit reports without weakening output path confinement**

Project: backend. Source: [tests/pipeline.test.mjs:128](../tests/pipeline.test.mjs).

CI may collect evidence in its checkout while the audit itself must publish outside the audited source tree.

Actual checks:

~~~typescript
expect(published.id).toBe(result.id);
expect(published.reports).toEqual(result.reports);
expect(JSON.parse(await readFile(join(output, 'report.sarif.json'), 'utf8')).version).toBe('2.1.0');
expect(await readFile(join(directory, 'index.ts'), 'utf8')).toBe('export const answer = 42;\n');
~~~

### backend-report-presentation-reportContract

**publication styling preserves all evidence and machine contracts with safe offline branding**

Project: backend. Source: [tests/report-presentation.test.ts:115](../tests/report-presentation.test.ts).

Presentation preserves canonical evidence, separates static/model scores, escapes content and embeds offline artwork.

Actual checks:

~~~typescript
expect(html).toContain('class="report-cover"');
expect(html).toContain('class="score-gauge"');
expect(html).toContain('id="report-accent"');
expect(html).toContain('id="concept-boundaries"');
expect(html).toContain('id="concept-consolidation"');
expect(html).toContain('id="concept-contracts"');
expect(html).toContain('id="concept-flows"');
expect(html).toContain('Unmapped historical assessment must remain visible.');
expect(html).toContain('LLM interpretation');
expect(html).toContain('Static assessment');
expect(html).toContain('&lt;script&gt;untrusted interpretation&lt;/script&gt;');
expect(html).not.toContain('<script>untrusted interpretation</script>');
expect(html).toContain('data:image/png;base64,');
expect(html).not.toContain('<img src=x');
expect(html).toContain(finding.fingerprint);
expect(appendix).toContain(finding.fingerprint);
expect(appendix).not.toContain('class="report-cover"');
expect(result).toEqual(before);
expect(renderSarif(result)).toEqual(sarif);
~~~

### backend-review-filtering

**review filters compose and prioritize severity**

Project: backend. Source: [tests/review.test.ts:42](../tests/review.test.ts).

Verify exact drill-down filters compose, respect confidence, and retain canonical objects.

Actual checks:

~~~typescript
expect(filterEvidence([minor, finding], { severity: 'critical', file: 'src/a.ts', ruleId: 'no-eval', scanner: 'eslint', assessment: 'potential_risk', method: 'deterministic', minimumConfidence: 70, query: 'SCRIPT', sort: 'severity' })).toEqual([finding]);
expect(filterEvidence([finding], { minimumConfidence: 90 })).toEqual([]);
expect(filterEvidence([finding], { scanner: 'gitleaks' })).toEqual([]);
expect(filterEvidence([minor, finding], { sort: 'severity' })[0]).toBe(finding);
~~~

### backend-review-grouping

**review groups preserve complete counts**

Project: backend. Source: [tests/review.test.ts:43](../tests/review.test.ts).

Verify grouped counts include all evidence and use stable deterministic tie-breaking.

Actual checks:

~~~typescript
expect(groups[0]).toEqual({ key: 'no-eval', count: 2, highSeverity: 1 });
expect(groups[1].key).toBe('complexity');
~~~

### backend-review-referenceSafety

**online references cannot be supplied by repository evidence**

Project: backend. Source: [tests/review.test.ts:44](../tests/review.test.ts).

Verify references are curated HTTPS destinations and never interpolate evidence or arbitrary URLs.

Actual checks:

~~~typescript
expect(referencesFor(finding)[0].url).toBe('https://eslint.org/docs/latest/rules/no-eval');
expect(hostile).toEqual([]);
expect(referencesFor({ ...finding, scanner: 'gitleaks', sources: ['gitleaks'], ruleId: 'generic-api-key' })[0].url).toContain('github.com/gitleaks/gitleaks');
expect(referencesFor({ ...finding, ruleId: 'security/dynamic-evaluation' })[0].url).toBe('https://eslint.org/docs/latest/rules/no-eval');
~~~

### backend-security-snapshotContract

**source snapshot rejects symlink escape and config discovery**

Project: backend. Source: [tests/security.test.ts:103](../tests/security.test.ts).

Verify snapshots skip symlinks, private metadata, caches, and executable configuration while preserving bounded source.

Actual checks:

~~~typescript
expect(inventory.files.length).toBe(1);
expect(inventory.skippedSymlinks).toBe(2);
expect(await readFile(join(snapshot, 'code.ts'), 'utf8')).toContain('answer');
await expect(readFile(join(snapshot, 'tsconfig.json'))).rejects.toThrow();
await expect(createSnapshot(source, join(directory, 'private-document'), parseConfig({ architecture: { documents: ['.aws/private.ts'] } }))).rejects.toThrow('private metadata');
await expect(createSnapshot(source, join(directory, 'aliased-document'), parseConfig({ architecture: { documents: ['aliased-private-directory/private.ts'] } }))).rejects.toThrow('private metadata');
~~~

### backend-security-snapshotLimits

**source inventory limits fail visibly**

Project: backend. Source: [tests/security.test.ts:104](../tests/security.test.ts).

Verify oversize files and traversal limits fail visibly instead of silently reducing coverage.

Actual checks:

~~~typescript
await expect(createSnapshot(source, join(directory, 'snapshot'), parseConfig({ audit: { maxFileBytes: 1024 } }))).rejects.toThrow('maxFileBytes');
await expect(createSnapshot(source, join(directory, 'snapshot-entries'), parseConfig({ audit: { maxEntries: 1 } }))).resolves.toBeDefined();
await expect(createSnapshot(source, join(directory, 'snapshot-overflow'), parseConfig({ audit: { maxEntries: 1 } }))).rejects.toThrow('maxEntries');
~~~

### backend-security-processLimits

**subprocess timeout and output caps are enforced**

Project: backend. Source: [tests/security.test.ts:105](../tests/security.test.ts).

Verify scanner deadlines and output bounds produce explicit failures and reap the child process.

Actual checks:

~~~typescript
await expect(runProcess('worker', ['systems', join(directory, 'missing.json')], directory, { timeoutMs: 1, maxOutputBytes: 1024, memoryMb: 128 })).rejects.toMatchObject({ status: 'timed_out' });
await expect(runProcess('slopscore', ['--help'], directory, { timeoutMs: 10000, maxOutputBytes: 32, memoryMb: 128 })).rejects.toMatchObject({ status: 'failed' });
~~~

### backend-security-outputContract

**malformed scanner output is rejected**

Project: backend. Source: [tests/security.test.ts:106](../tests/security.test.ts).

Verify malformed SARIF cannot be treated as an empty successful analysis.

Actual checks:

~~~typescript
expect(() => fromSarif({ version: '2.1.0', runs: [{ results: 'broken' }] }, 'oxlint', {} as never)).toThrow();
~~~

### backend-security-deduplicationContract

**deduplication preserves strongest assessment and provenance**

Project: backend. Source: [tests/security.test.ts:107](../tests/security.test.ts).

Verify stronger deterministic evidence survives a higher-severity heuristic overlap.

Actual checks:

~~~typescript
expect(results).toHaveLength(1);
expect(results[0].assessment).toBe('verified_violation');
expect(results[0].category).toBe('codeQuality');
expect(results[0].severity).toBe('critical');
expect(results[0].sources).toContain('slopscore');
~~~

### backend-security-findingEvidenceBoundary

**finding snippets reject traversal, unlisted files and symlink escape**

Project: backend. Source: [tests/security.test.ts:165](../tests/security.test.ts).

Scanner evidence may read only inventoried regular snapshot files; traversal, unlisted files and symlinks must fail before snippets are exposed.

Actual checks:

~~~typescript
expect((await applyFindingPolicy([scanner('code.ts')], context))[0].snippet).toContain('answer = 42');
await expect(applyFindingPolicy([scanner('../outside.ts')], context)).rejects.toThrow();
await expect(applyFindingPolicy([scanner('unlisted.ts')], context)).rejects.toThrow('inventory');
await expect(applyFindingPolicy([scanner('code.ts')], context)).rejects.toThrow();
~~~

### backend-security-workerContextBoundary

**worker context is restricted to its own regular context file**

Project: backend. Source: [tests/security.test.ts:166](../tests/security.test.ts).

The internal worker must reject arbitrary context paths and symlinked context data, while accepting its own bounded context file.

Actual checks:

~~~typescript
expect(escaped.exitCode).toBe(2);
expect(escaped.stdout).toBe('');
expect(linked.exitCode).toBe(2);
expect(linked.stdout).toBe('');
expect(valid.exitCode).toBe(0);
expect(JSON.parse(valid.stdout).analyzedFiles).toBe(0);
~~~

### backend-slopscore-largeOutputContract

**SlopScore preserves large JSON reports**

Project: backend. Source: [tests/slopscore.test.ts:45](../tests/slopscore.test.ts).

Verify SlopScore findings survive outputs larger than an OS pipe buffer without truncation or source execution.

Actual checks:

~~~typescript
expect(result.status).toBe('completed');
expect(result.analyzedFiles).toBe(1);
expect(result.findings.length).toBeGreaterThan(500);
expect(result.findings[0].file).toBe('bad.js');
await expect(limited.execute({ snapshot, workDirectory: directory, config, inventory })).rejects.toThrow('Scanner report exceeds output limit');
~~~

### backend-snyk-dependencyFindings

**Snyk dependencies retain all paths and block unpatched high severity**

Project: backend. Source: [tests/snyk.test.mjs:83](../tests/snyk.test.mjs).

A completed dependency scan must retain each path, deduplicate advisories per affected package/version and block high severity even without a fix.

Actual checks:

~~~typescript
expect(summary.status).toBe('completed');
expect(summary.passed).toBe(false);
expect(summary.counts).toEqual({ critical: 0, high: 1, medium: 0, low: 0 });
expect(summary.issues[0].paths).toHaveLength(2);
expect(summary.issues[0].fixedIn).toEqual([]);
expect(summary.dependencyCount).toBe(3);
~~~

### backend-snyk-codeFindings

**Snyk Code retains severity, locations and data flow without inventing a score**

Project: backend. Source: [tests/snyk.test.mjs:84](../tests/snyk.test.mjs).

Code SARIF maps genuine severities and location/flow evidence; a low/medium finding is visible without becoming a high-severity gate failure.

Actual checks:

~~~typescript
expect(summary.passed).toBe(true);
expect(summary.counts.medium).toBe(1);
expect(summary.counts.critical).toBe(0);
expect(summary.issues[0].location).toBe('src/fixture.ts:12');
expect(summary.issues[0].trace).toEqual(['src/fixture.ts:12']);
expect(summarizeSnyk('code', { ...body, runs: [{ ...body.runs[0], results: [] }] }, 0).issues).toEqual([]);
~~~

### backend-snyk-failedEvidence

**Snyk errors and malformed or contradictory evidence fail closed**

Project: backend. Source: [tests/snyk.test.mjs:85](../tests/snyk.test.mjs).

Authentication/errors, unsupported exits, malformed SARIF, unknown severities and mismatched completion evidence must never pass.

Actual checks:

~~~typescript
expect(() => summarizeSnyk('dependencies', { error: 'fixture authentication failure' }, 2)).toThrow();
expect(() => summarizeSnyk('code', {}, 3)).toThrow();
expect(() => summarizeSnyk('code', { runs: [] }, 0)).toThrow();
expect(() => summarizeSnyk('dependencies', { ok: true, vulnerabilities: [] }, 1)).toThrow('disagree');
expect(() => summarizeSnyk('dependencies', { ok: false, vulnerabilities: [{ id: 'fixture', name: 'fixture', version: '1', title: 'Fixture', severity: 'unknown', from: [] }] }, 1)).toThrow('severity');
~~~

### backend-snyk-credentialIsolation

**Snyk credentials are isolated from other test and provider settings**

Project: backend. Source: [tests/snyk.test.mjs:86](../tests/snyk.test.mjs).

Only the Snyk scan receives its configured token; other credentials and operator AI settings are excluded.

Actual checks:

~~~typescript
expect(environment.SNYK_TOKEN).toBe('fixture-only');
expect(environment.SNYK_CFG_ORG).toBe('fixture-org');
expect(environment.DOCKER_TOKEN).toBeUndefined();
expect(environment.ANTISLOPSCAN_AI_ENABLED).toBeUndefined();
expect(environment.SNYK_DEBUG).toBeUndefined();
~~~

### backend-snyk-missingCredentials

**missing Snyk credentials persist unavailable scans and fail the gate**

Project: backend. Source: [tests/snyk.test.mjs:87](../tests/snyk.test.mjs).

Missing credentials produce persisted unavailable outcomes for both scans and a failing gate without executing the scanner.

Actual checks:

~~~typescript
expect(result.passed).toBe(false);
expect(stored.runId).toBe('fixture-run');
expect(stored.scans.dependencies.status).toBe('unavailable');
expect(stored.scans.code.status).toBe('unavailable');
expect(stored.scans.code.error).toContain('SNYK_TOKEN');
~~~

### backend-snyk-legacySchemaResolver

**ESLint schema resolver preserves validation and terminates on hostile Unicode paths**

Project: backend. Source: [tests/snyk.test.mjs:97](../tests/snyk.test.mjs).

ESLint's Ajv 6 must use the maintained URI resolver and preserve draft-07 reference validation without hanging on Unicode separators.

Assertions run by the delegated scenario: [tests/uri-resolver.mjs](../tests/uri-resolver.mjs).

Actual checks:

~~~typescript
assert.equal(ajvRequire('uri-js/package.json').name, 'fast-uri');
assert.equal(ajvRequire('uri-js/package.json').version, '3.1.9');
assert.deepEqual(Object.keys(manifest.overrides), ['eslint']);
assert.equal(manifest.overrides.eslint.ajv['uri-js'], 'npm:fast-uri@3.1.9');
assert.equal(validate({ quantity: 2 }), true);
assert.equal(validate({ quantity: 0 }), false);
assert.equal(validate({ quantity: 'bad' }), false);
assert.equal(validate({}), false);
assert.equal(validate({ quantity: 2, extra: true }), false);
assert.equal(uri.resolve('https://example.invalid/base/', '../child.json'), 'https://example.invalid/child.json');
assert.doesNotThrow(() => {
    uri.resolve('https://example.invalid/base/', '\u2028/../child.json', { iri: true });
    uri.normalize('https://example.invalid/\u2029/../child.json', { iri: true });
});
~~~

### backend-snyk-reportEvidenceIntegrity

**CI reports validate Snyk raw evidence and reject stale or forged summaries**

Project: backend. Source: [tests/snyk.test.mjs:145](../tests/snyk.test.mjs).

Report generation independently verifies current-run raw scans and rejects forged summaries or reused credentials-era evidence.

Actual checks:

~~~typescript
expect((await collectReport(directory)).issues).toEqual([]);
expect(inconsistent.passed).toBe(false);
expect(inconsistent.issues.join(' ')).toContain('differs from raw');
expect((await collectReport(directory)).issues.join(' ')).toContain('does not belong to this run');
~~~

### backend-snyk-reportPresentation

**CI reports include escaped Snyk findings and explicit unavailable measurements**

Project: backend. Source: [tests/snyk.test.mjs:146](../tests/snyk.test.mjs).

Branded CI HTML must expose Snyk failures, preserve remediation paths, escape hostile findings and never show unknown measurements as zero.

Actual checks:

~~~typescript
expect(html).toContain('Snyk dependency and source security');
expect(html).toContain('No upstream fixed version reported');
expect(html).toContain('application → fixture');
expect(html).toContain('not assessed');
expect(html).toContain('Fixture service unavailable');
expect(html).toContain('&lt;script&gt;fixture()&lt;/script&gt;');
expect(html).not.toContain('<script>fixture()');
expect(html).toContain('no numeric repository score is invented');
~~~

### backend-typescript-typeScriptContract

**TypeScript generics and Vue scripts retain correct parser context and source locations**

Project: backend. Source: [tests/typescript.test.ts:37](../tests/typescript.test.ts).

Verify generic TS syntax is parsed as TypeScript and Vue script locations retain original line numbers.

Actual checks:

~~~typescript
expect(result.findings).toHaveLength(0);
expect(extracted.split('\n')[2]).toContain('const answer');
expect(extracted).not.toContain('<template>');
expect(typeImports.imports).toHaveLength(2);
expect(dependency.typeOnly).toBe(true);
~~~

### ui-ui-functional-dashboard

**Playwright: authenticated assessment, history, findings, reports and responsive appearance**

Project: ui. Source: [tests/ui-functional.test.mjs:15](../tests/ui-functional.test.mjs).

Exercise a real audit, evidence investigation, exports and accessible responsive controls with Playwright.

Assertions run by the delegated scenario: [tests/browser.mjs](../tests/browser.mjs).

Actual checks:

~~~typescript
assert.match(hex, /^#[a-f0-9]{6}$/i);
assert.ok(contrast(palette[text], palette[surface]) >= 4.5, `${text} on ${surface}: ${palette[text]} / ${palette[surface]}`);
assert.ok(contrast(palette['control-line'], palette[surface]) >= 3, `Control contrast on ${surface}`);
assert.ok(contrast(palette.focus, palette[surface]) >= 3, `Focus contrast on ${surface}`);
assert.ok(contrast(palette['on-brand'], palette.brand) >= 4.5, 'Primary action text contrast');
assert.equal(await page.getByRole('combobox', { name: 'Accent color', exact: true }).inputValue(), 'teal');
assert.equal(await page.evaluate(appliedTheme), 'dark');
assert.match(await page.title(), /^antislopscan /);
assert.match(await page.locator('.masthead .product').innerText(), /^antislopscan/);
assert.match(await page.locator('footer').innerText(), /Apache-2.0/);
assert.doesNotMatch(await page.locator('footer').innerText(), /A&R|areng/i);
assert.equal(await page.getByLabel('Severity', { exact: true }).locator('option:checked').innerText(), 'All severities');
assert.equal(await page.locator('.finding').count(), 50);
assert.ok(await page.locator('.finding').count() > 0);
assert.ok(await page.getByRole('heading', { name: 'Catch block discards every failure' }).count() > 0);
assert.equal(await page.locator('.finding').count(), 1);
assert.match(await page.evaluate(() => navigator.clipboard.readText()), /errors\/empty-catch/);
assert.equal(await page.locator('.references a').first().getAttribute('rel'), 'noopener noreferrer');
assert.equal(JSON.parse(await readFile(selectionPath, 'utf8')).findings.length, 1);
assert.equal(await page.getByLabel('Severity', { exact: true }).inputValue(), 'major');
assert.ok(await page.getByRole('combobox', { name: 'Rule', exact: true }).inputValue());
assert.equal(await report.failure(), null);
assert.ok(await page.locator('#coverage table tbody tr').count() > 0);
assert.equal(await page.locator('.graph-node').count(), 3);
assert.equal(await page.locator('.graph-edges > path').count(), 1);
assert.equal(await page.getByRole('combobox', { name: 'File', exact: true }).isVisible(), true);
assert.equal(await page.getByRole('combobox', { name: 'File', exact: true }).inputValue(), 'helper.ts');
assert.equal(await page.locator('.graph-node').count(), 2);
assert.equal(await page.locator('.principle-row').count(), 1);
assert.equal(await page.getByLabel('Project name').evaluate((field) => document.activeElement === field), true);
assert.ok(await page.locator('.network-art').evaluate((element) => element.classList.contains('is-paused')));
assert.equal(await page.locator('.flow-line').first().evaluate((element) => getComputedStyle(element).animationPlayState), 'paused');
assert.equal(await page.locator('.flow-line').first().evaluate((element) => getComputedStyle(element).animationPlayState), 'running');
assert.equal(await page.locator('.flow-line').first().evaluate((element) => getComputedStyle(element).animationName), 'none');
assert.equal(await page.locator('.appearance-settings').getAttribute('open'), null);
assert.equal(await page.evaluate(appliedTheme), palette);
assert.equal(tokens.paper, palette === 'light' ? '#f3f5f8' : '#0b111b');
assert.equal(tokens.brand, palette === 'light' ? '#52525b' : '#b8b8c2');
assert.equal(await page.evaluate(overflows), false, `${palette}/${selectedAccent} overflow at ${width}px`);
assert.equal(await page.evaluate(overflows), false, `${palette} overflow at ${width}px`);
assert.equal(await page.getByRole('combobox', { name: 'Accent color', exact: true }).inputValue(), 'blue');
assert.equal(await page.evaluate(appliedTheme), undefined);
assert.notEqual(await page.evaluate(surfaceColor), lightSurface);
assert.equal((await page.evaluate(paletteTokens)).brand, '#8cb8ff');
assert.equal(await page.getByRole('combobox', { name: 'Accent color', exact: true }).inputValue(), 'neutral');
assert.equal(await page.evaluate(focusedTag), 'BUTTON');
assert.equal(await report.locator('.report-cover').count(), 1);
assert.equal(await report.locator('.principle-guide figure').count(), 4);
assert.equal(await report.locator('.cover-topology').evaluate((image) => image.complete && image.naturalWidth > 0), true);
assert.equal(await report.getByRole('combobox', { name: 'Accent color', exact: true }).locator('option').count(), 7);
assert.equal(await report.getByRole('combobox', { name: 'Accent color', exact: true }).inputValue(), 'violet');
assert.equal(await report.evaluate(appliedTheme), 'dark');
assert.equal(await report.locator('[data-finding]:visible').count(), 50);
assert.ok(await report.locator('[data-finding]:visible').count() > 0);
assert.ok(await report.locator('[data-finding]:visible').count() < 50);
assert.equal(await report.locator('[data-finding]:visible').count(), 0);
assert.equal(await report.evaluate(overflows), false);
assert.equal(await report.getByRole('combobox', { name: 'Accent color', exact: true }).inputValue(), 'neutral');
assert.equal(await report.evaluate(surfaceColor), 'rgb(255, 255, 255)');
assert.deepEqual(reportRequests, []);
assert.deepEqual(failures, []);
~~~

### ui-ui-functional-modelReview

**Playwright: controlled LLM review, source consent, principles and reduced motion**

Project: ui. Source: [tests/ui-functional.test.mjs:16](../tests/ui-functional.test.mjs).

Exercise consent, provider failures, sampled model evidence and principle navigation against a local fixture provider.

Assertions run by the delegated scenario: [tests/browser-ai.mjs](../tests/browser-ai.mjs).

Actual checks:

~~~typescript
assert.equal(rejected.statusCode, 400);
assert.equal(calls, 0);
assert.equal(await page.getByRole('checkbox', { name: 'Enable LLM architecture assessment', exact: true }).isChecked(), true);
assert.equal(await page.getByRole('combobox', { name: 'LLM provider', exact: true }).isDisabled(), true);
assert.equal(await page.getByLabel('LLM base URL', { exact: true }).getAttribute('readonly'), '');
assert.equal(calls, 4);
assert.equal(await page.locator('.principle-row').count(), 14);
assert.match(await dry.locator('.principle-explainer img').getAttribute('src'), /\.gif$/);
assert.match(await dry.locator('.principle-explainer img').getAttribute('src'), /poster.*\.png$/);
assert.equal(await page.locator('.principle-row').count(), 1);
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${mode} AI overview at ${width}px`);
assert.equal(await page.getByRole('combobox', { name: 'File', exact: true }).inputValue(), 'a.ts');
assert.equal(result.aiArchitecture.score, 90);
assert.equal(result.aiArchitecture.model, 'fixture-model-v2');
assert.equal(result.aiArchitecture.sampledFiles, 1);
assert.equal(result.scores.overall, 100);
assert.match(await html.text(), /LLM sample score/);
assert.deepEqual(failures, []);
~~~

## Every required frontend screenshot

Each checkpoint is captured only after its assertions. The manifest records viewport, theme, time, actual PNG dimensions and SHA-256. Hidden password fields are not masked over unrelated UI; visible credential fields are masked. Static screenshots do not prove motion, clipboard contents or download bytes, so captions identify the corresponding nonvisual checks.

### ui-dashboard visual checkpoints

| PNG / checkpoint | Feature | Verified behavior |
| --- | --- | --- |
| connection.png | Connection and authentication | Unauthenticated alert, brand, fresh-install accent and bearer connection control. |
| empty.png | Empty history and assessment | Successful connection opens the initial assessment workflow. |
| validation.png | Invalid JSON validation | Malformed configuration displays a visible alert. |
| assessment.png | Configured assessment | Project name, scanner settings and all four report formats are submitted. |
| findings.png | Completed audit and finding pagination | Actual audit findings appear; the first page contains 50 findings. |
| next.png | Next finding page | Next page contains actual findings. |
| previous.png | Previous finding page | Previous restores the first page. |
| no-findings.png | Empty finding search | A search with no matches renders the no-findings message. |
| severity-category.png | Severity and category filters | Major/code-quality filtering retains the empty-catch evidence. |
| advanced.png | Advanced evidence filters | File, rule, method, scanner, assessment, confidence and sorting leave one finding. |
| copy.png | Expanded evidence and clipboard | Recommendation appears; copied evidence contains the selected rule. |
| clipboard-fallback.png | Clipboard denial fallback | Copy denial displays instructions and selectable evidence. |
| filtered-export.png | Filtered JSON export | Downloaded JSON contains exactly the one selected finding; issue links are isolated. |
| severity-drill.png | Severity chart drill-down | Selecting major in the dashboard applies the major evidence filter. |
| rule-drill.png | Rule ranking drill-down | Selecting a ranked rule applies its finding filter. |
| methodology.png | Scoring methodology | The actual methodology disclosure is expanded. |
| measurements.png | Structural measurements | The measurement and delta disclosure is expanded. |
| architecture.png | Dependency relationships | The graph has three actual nodes and one resolved relationship. |
| principle.png | Static systems principle | Holism expands to an informational static assessment. |
| module.png | Module-to-finding navigation | Selecting helper.ts applies that exact file filter. |
| no-modules.png | Empty module search | An unmatched path renders the no-modules message. |
| runtime-imports.png | Runtime import filtering | Matching api.ts leaves two nodes; runtime-only mode retains one edge. |
| no-principles.png | Principle assessment filtering | Holism combined with unassessed displays a no-match state. |
| new-assessment.png | New assessment and focus | Opening the form focuses Project name. |
| history-mobile.png | Mobile audit history | History selection restores repository heading focus at 390px. |
| motion-pause.png | User motion pause | The rendered hero enters its paused state. |
| hidden-pause.png | Hidden-document motion lifecycle | A simulated visibility change pauses flow animation; screenshot remains a static view. |
| motion-resume.png | Visible-document motion lifecycle | Visibility restoration resumes the measured animation play state. |
| reduced-motion.png | System reduced motion | Computed animation name becomes none. |
| escape.png | Appearance keyboard dismissal | Escape closes appearance settings. |
| persist.png | Keyboard accent and persisted preference | ArrowDown selects blue; reload retains dark/blue settings. |
| system-light.png | System light appearance | System mode clears the explicit theme and follows the light OS palette. |
| system-dark.png | System dark appearance | The OS dark palette differs and retains the selected blue accent. |
| invalid-accent.png | Invalid saved preference | Malformed saved accent safely falls back to neutral. |
| keyboard.png | Connection keyboard navigation | Tab moves from the masked token field to the connection button. |
| report-cover.png | Standalone report identity | Embedded cover artwork decodes, four principle illustrations exist and no HTTP assets load. |
| report-persist.png | Standalone saved appearance | The report retains violet through reload and applies dark mode. |
| report-next.png | Standalone report pagination | The report shows 50 findings and supports next-page navigation. |
| report-filters.png | Standalone advanced filters | Scanner, method, assessment and file sort retain matching evidence. |
| report-drill.png | Standalone file drill-down | Selecting api.ts reduces results and exposes safe references. |
| report-empty.png | Standalone no-match search | Unmatched evidence search produces zero visible findings. |
| report-invalid.png | Standalone invalid saved accent | Malformed preference falls back to neutral. |
| report-print.png | Standalone print palette | Print uses a white surface even when the OS appearance is dark. |
| coverage.png | Scanner execution coverage | The coverage screen displays the actual completed scanner results. |
| layout-light-1440.png | light appearance at 1440px | Actual document geometry has no horizontal overflow. |
| report-layout-light-1440.png | Standalone light report at 1440px | The exported report has no horizontal overflow. |
| layout-light-900.png | light appearance at 900px | Actual document geometry has no horizontal overflow. |
| report-layout-light-900.png | Standalone light report at 900px | The exported report has no horizontal overflow. |
| layout-light-768.png | light appearance at 768px | Actual document geometry has no horizontal overflow. |
| report-layout-light-768.png | Standalone light report at 768px | The exported report has no horizontal overflow. |
| layout-light-540.png | light appearance at 540px | Actual document geometry has no horizontal overflow. |
| report-layout-light-540.png | Standalone light report at 540px | The exported report has no horizontal overflow. |
| layout-light-390.png | light appearance at 390px | Actual document geometry has no horizontal overflow. |
| report-layout-light-390.png | Standalone light report at 390px | The exported report has no horizontal overflow. |
| layout-light-320.png | light appearance at 320px | Actual document geometry has no horizontal overflow. |
| report-layout-light-320.png | Standalone light report at 320px | The exported report has no horizontal overflow. |
| report-accent-light-neutral.png | Standalone light/neutral palette | Measured text/action contrast is at least 4.5:1; control/focus contrast is at least 3:1. |
| accent-light-neutral-1440.png | light/neutral at 1440px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-light-neutral-900.png | light/neutral at 900px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-light-neutral-768.png | light/neutral at 768px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-light-neutral-540.png | light/neutral at 540px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-light-neutral-390.png | light/neutral at 390px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-light-neutral-320.png | light/neutral at 320px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| report-accent-light-blue.png | Standalone light/blue palette | Measured text/action contrast is at least 4.5:1; control/focus contrast is at least 3:1. |
| accent-light-blue-1440.png | light/blue at 1440px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-light-blue-900.png | light/blue at 900px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-light-blue-768.png | light/blue at 768px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-light-blue-540.png | light/blue at 540px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-light-blue-390.png | light/blue at 390px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-light-blue-320.png | light/blue at 320px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| report-accent-light-violet.png | Standalone light/violet palette | Measured text/action contrast is at least 4.5:1; control/focus contrast is at least 3:1. |
| accent-light-violet-1440.png | light/violet at 1440px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-light-violet-900.png | light/violet at 900px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-light-violet-768.png | light/violet at 768px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-light-violet-540.png | light/violet at 540px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-light-violet-390.png | light/violet at 390px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-light-violet-320.png | light/violet at 320px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| report-accent-light-teal.png | Standalone light/teal palette | Measured text/action contrast is at least 4.5:1; control/focus contrast is at least 3:1. |
| accent-light-teal-1440.png | light/teal at 1440px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-light-teal-900.png | light/teal at 900px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-light-teal-768.png | light/teal at 768px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-light-teal-540.png | light/teal at 540px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-light-teal-390.png | light/teal at 390px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-light-teal-320.png | light/teal at 320px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| report-accent-light-orange.png | Standalone light/orange palette | Measured text/action contrast is at least 4.5:1; control/focus contrast is at least 3:1. |
| accent-light-orange-1440.png | light/orange at 1440px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-light-orange-900.png | light/orange at 900px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-light-orange-768.png | light/orange at 768px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-light-orange-540.png | light/orange at 540px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-light-orange-390.png | light/orange at 390px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-light-orange-320.png | light/orange at 320px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| report-accent-light-rose.png | Standalone light/rose palette | Measured text/action contrast is at least 4.5:1; control/focus contrast is at least 3:1. |
| accent-light-rose-1440.png | light/rose at 1440px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-light-rose-900.png | light/rose at 900px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-light-rose-768.png | light/rose at 768px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-light-rose-540.png | light/rose at 540px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-light-rose-390.png | light/rose at 390px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-light-rose-320.png | light/rose at 320px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| report-accent-light-green.png | Standalone light/green palette | Measured text/action contrast is at least 4.5:1; control/focus contrast is at least 3:1. |
| accent-light-green-1440.png | light/green at 1440px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-light-green-900.png | light/green at 900px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-light-green-768.png | light/green at 768px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-light-green-540.png | light/green at 540px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-light-green-390.png | light/green at 390px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-light-green-320.png | light/green at 320px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| layout-dark-1440.png | dark appearance at 1440px | Actual document geometry has no horizontal overflow. |
| report-layout-dark-1440.png | Standalone dark report at 1440px | The exported report has no horizontal overflow. |
| layout-dark-900.png | dark appearance at 900px | Actual document geometry has no horizontal overflow. |
| report-layout-dark-900.png | Standalone dark report at 900px | The exported report has no horizontal overflow. |
| layout-dark-768.png | dark appearance at 768px | Actual document geometry has no horizontal overflow. |
| report-layout-dark-768.png | Standalone dark report at 768px | The exported report has no horizontal overflow. |
| layout-dark-540.png | dark appearance at 540px | Actual document geometry has no horizontal overflow. |
| report-layout-dark-540.png | Standalone dark report at 540px | The exported report has no horizontal overflow. |
| layout-dark-390.png | dark appearance at 390px | Actual document geometry has no horizontal overflow. |
| report-layout-dark-390.png | Standalone dark report at 390px | The exported report has no horizontal overflow. |
| layout-dark-320.png | dark appearance at 320px | Actual document geometry has no horizontal overflow. |
| report-layout-dark-320.png | Standalone dark report at 320px | The exported report has no horizontal overflow. |
| report-accent-dark-neutral.png | Standalone dark/neutral palette | Measured text/action contrast is at least 4.5:1; control/focus contrast is at least 3:1. |
| accent-dark-neutral-1440.png | dark/neutral at 1440px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-dark-neutral-900.png | dark/neutral at 900px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-dark-neutral-768.png | dark/neutral at 768px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-dark-neutral-540.png | dark/neutral at 540px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-dark-neutral-390.png | dark/neutral at 390px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-dark-neutral-320.png | dark/neutral at 320px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| report-accent-dark-blue.png | Standalone dark/blue palette | Measured text/action contrast is at least 4.5:1; control/focus contrast is at least 3:1. |
| accent-dark-blue-1440.png | dark/blue at 1440px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-dark-blue-900.png | dark/blue at 900px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-dark-blue-768.png | dark/blue at 768px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-dark-blue-540.png | dark/blue at 540px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-dark-blue-390.png | dark/blue at 390px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-dark-blue-320.png | dark/blue at 320px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| report-accent-dark-violet.png | Standalone dark/violet palette | Measured text/action contrast is at least 4.5:1; control/focus contrast is at least 3:1. |
| accent-dark-violet-1440.png | dark/violet at 1440px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-dark-violet-900.png | dark/violet at 900px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-dark-violet-768.png | dark/violet at 768px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-dark-violet-540.png | dark/violet at 540px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-dark-violet-390.png | dark/violet at 390px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-dark-violet-320.png | dark/violet at 320px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| report-accent-dark-teal.png | Standalone dark/teal palette | Measured text/action contrast is at least 4.5:1; control/focus contrast is at least 3:1. |
| accent-dark-teal-1440.png | dark/teal at 1440px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-dark-teal-900.png | dark/teal at 900px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-dark-teal-768.png | dark/teal at 768px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-dark-teal-540.png | dark/teal at 540px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-dark-teal-390.png | dark/teal at 390px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-dark-teal-320.png | dark/teal at 320px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| report-accent-dark-orange.png | Standalone dark/orange palette | Measured text/action contrast is at least 4.5:1; control/focus contrast is at least 3:1. |
| accent-dark-orange-1440.png | dark/orange at 1440px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-dark-orange-900.png | dark/orange at 900px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-dark-orange-768.png | dark/orange at 768px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-dark-orange-540.png | dark/orange at 540px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-dark-orange-390.png | dark/orange at 390px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-dark-orange-320.png | dark/orange at 320px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| report-accent-dark-rose.png | Standalone dark/rose palette | Measured text/action contrast is at least 4.5:1; control/focus contrast is at least 3:1. |
| accent-dark-rose-1440.png | dark/rose at 1440px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-dark-rose-900.png | dark/rose at 900px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-dark-rose-768.png | dark/rose at 768px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-dark-rose-540.png | dark/rose at 540px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-dark-rose-390.png | dark/rose at 390px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-dark-rose-320.png | dark/rose at 320px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| report-accent-dark-green.png | Standalone dark/green palette | Measured text/action contrast is at least 4.5:1; control/focus contrast is at least 3:1. |
| accent-dark-green-1440.png | dark/green at 1440px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-dark-green-900.png | dark/green at 900px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-dark-green-768.png | dark/green at 768px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-dark-green-540.png | dark/green at 540px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-dark-green-390.png | dark/green at 390px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| accent-dark-green-320.png | dark/green at 320px | Computed palette contrast and document overflow assertions passed for this exact combination. |
| export-HTML.png | HTML report download | Playwright observed this format download without failure. |
| export-PDF.png | PDF report download | Playwright observed this format download without failure. |
| export-JSON.png | JSON report download | Playwright observed this format download without failure. |
| export-SARIF.png | SARIF report download | Playwright observed this format download without failure. |

### ui-model visual checkpoints

| PNG / checkpoint | Feature | Verified behavior |
| --- | --- | --- |
| settings.png | Operator-pinned LLM settings | Enabled assessment is checked, provider is disabled, endpoint is read-only; model and byte budget remain editable. |
| configured.png | Configured model sample | The form uses fixture-model-v2 and a 2048-byte sampling budget. |
| overview.png | Independent sampled LLM score | Four local provider calls produce 90/100; 14 principle rows are displayed. |
| illustration.png | Principle explanation and GIF | Expanded DRY loads the conceptual GIF; a static screenshot does not prove motion. |
| paused.png | Paused principle illustration | Explicit pause replaces the GIF with its static poster. |
| reduced.png | Reduced-motion principle illustration | Operating-system reduced motion selects the static poster. |
| next.png | Next principle page | Next page contains 14 actual principle rows. |
| previous.png | Previous principle page | Previous restores the first principle page. |
| search.png | Principle name search | DRY search leaves one row. |
| empty.png | Principle assessment no-match | Combining DRY and unassessed renders the no-match message. |
| citation.png | LLM citation drill-down | Selecting a citation applies the exact a.ts file filter. |
| export.png | Model review exports | JSON preserves score 90, model, one sampled file and static score 100; HTML includes the LLM sample section. |
| layout-light-1440.png | light appearance at 1440px | Actual document geometry has no horizontal overflow. |
| layout-light-900.png | light appearance at 900px | Actual document geometry has no horizontal overflow. |
| layout-light-768.png | light appearance at 768px | Actual document geometry has no horizontal overflow. |
| layout-light-540.png | light appearance at 540px | Actual document geometry has no horizontal overflow. |
| layout-light-390.png | light appearance at 390px | Actual document geometry has no horizontal overflow. |
| layout-light-320.png | light appearance at 320px | Actual document geometry has no horizontal overflow. |
| layout-dark-1440.png | dark appearance at 1440px | Actual document geometry has no horizontal overflow. |
| layout-dark-900.png | dark appearance at 900px | Actual document geometry has no horizontal overflow. |
| layout-dark-768.png | dark appearance at 768px | Actual document geometry has no horizontal overflow. |
| layout-dark-540.png | dark appearance at 540px | Actual document geometry has no horizontal overflow. |
| layout-dark-390.png | dark appearance at 390px | Actual document geometry has no horizontal overflow. |
| layout-dark-320.png | dark appearance at 320px | Actual document geometry has no horizontal overflow. |

<!-- test-inventory:end -->
