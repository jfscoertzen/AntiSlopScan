# Security boundaries and operation

antislopscan treats repositories and scanner output as untrusted data. It never
executes audited package scripts, installs audited dependencies, imports their
configuration, runs Git hooks, builds projects, or invokes arbitrary commands.
Adapters come from a compiled allowlist; JSON cannot supply a command or binary.

## Source handling

The snapshot reader skips symlinks and excluded dependency/build directories.
VCS internals, `.codex`, `.agents`, `.aws`, and `.npm-cache` directories are
always excluded as private metadata, credentials, or installation caches.
Their contents are outside scan coverage, including secret detection. This also
avoids traversing protected agent metadata mounts that may change during a session.
Explicit architecture-document paths cannot enter these excluded directories.
Regular-file reads use `O_NOFOLLOW`, descriptor checks, and Linux `/proc/self/fd`
containment. Size changes and partial reads fail visibly. Entry count, file count,
individual size, total source/document size, and scanner output are bounded.
Non-UTF-8/binary files and unsupported extensions are counted as excluded.

Only recognized source files are copied. Architecture documents are read through
the same confinement boundary. Package JSON is parsed only for dependency names;
scripts, executable settings, tsconfigs, ignore files, and scanner configs are not
copied. Vue script blocks are parsed without evaluating them. The original source
is never written, and report destinations inside it are rejected.

Scanners and LLM source sampling use a separate comment-masked code snapshot.
Comments are outside the scan policy, including credential patterns appearing
only in comments. Original hashes and optional report context remain available;
comments are never used to satisfy a requirement or assign a principle grade.
The code snapshot adds at most one repository-sized temporary copy, retains
source locations and is removed with the original snapshot. If constructing the
code view fails, the audit fails visibly. This is analysis preprocessing, not a
way to make repository executables safe.

This is not an atomic filesystem snapshot of a repository being edited by another
process. Use a stable checkout or read-only filesystem snapshot for reproducible
audits. A read-only container mount prevents container writes, not host edits.

## Execution and limits

Scanners run in separate process groups with fresh environment variables. API
keys, user homes, `NODE_OPTIONS`, Python import paths, and shell state are not
inherited. Node heap limits, Linux CPU/open-file/output-file limits, wall-clock
deadlines, and bounded stdout/stderr protect the owning process. Scanner stderr
is counted but not persisted because it may contain code or credentials.

These controls do not create a per-scanner native-memory sandbox. Use the
documented Docker memory/CPU/PID/tmpfs controls to bound the complete appliance.
All subprocess descendants are killed when their parent scanner exceeds a limit.
An audit deadline bounds scanning. PDF rendering has separate browser launch,
content-load, and print deadlines; a print deadline closes the owning browser.

Container execution does not make arbitrary repository executables safe. Cargo
checks can execute build scripts/macros; Knip plugins may load configs. Their
adapters remain unavailable until a safe, verified integration exists.

## Network and browser behavior

Use `--network none` for offline CLI scans. Compose defaults to an internal network and loopback
host port exposed by a fixed unprivileged Nginx gateway. The application/scanner
container only joins the internal network. The gateway joins both networks, has
no source/history mounts, and can proxy only to the application. Local CLI execution does not independently disable scanner networking;
an environment variable or container alone is not an egress firewall. The default
tools use local rules, have telemetry/version checks disabled where supported,
and receive no repository-supplied network configuration.

AI requires explicit provider connectivity. Setting
`ANTISLOPSCAN_NETWORK_INTERNAL=false` enables outbound appliance access, including
scanner networking; it is not a per-process egress policy. This checkout's private
`.env` explicitly opts into that mode for the user's existing local provider Ollama endpoint.
Distributed `.env.example` defaults remain isolated and AI-disabled. Restarting
the Compose network preserves history when `down` is used without `-v`.

PDF generation uses only appliance-authored HTML, escaped evidence, disabled
JavaScript, and blocked requests. Local Chromium sandboxing defaults on. The
container sets `ANTISLOPSCAN_CHROMIUM_SANDBOX=false` because the default unprivileged
Docker seccomp profile can prevent Chromium user-namespace sandbox creation. It
does not add privileges or disable the container's security controls. Preserve
the trusted-template, no-script, no-network boundary if changing this setting.

Optional AI requires explicit source-transmission consent, an explicit model, and
operator-controlled connectivity. API deployments pin provider protocol, URL and API-key
environment-variable name; audit clients cannot use AI requests to extract other
environment credentials or redirect them to another server. Redaction is a best-effort data-minimization
measure, not proof that a source sample contains no confidential information.
Do not enable external AI when source transmission is unacceptable. AI responses
are bounded/validated and have no tool access. The model selects appliance-owned
source-reference IDs; paths, line ranges and quotes are resolved from the bounded,
redacted source catalog. This verifies citations, not semantic correctness.
Model risk findings are informational by default. A separate sample-based LLM
architecture score requires cited evidence and sufficient estimated confidence;
unassessable principles and partial execution never receive a passing aggregate.
Core deterministic scores and numeric CI thresholds remain separate. Requested
AI execution failure still participates in scanner-error/coverage CI policy.

## API and history

The API confines source paths to `ANTISLOPSCAN_SOURCE_ROOT`, rejects cross-origin
browser requests and unexpected hosts, and supports bearer tokens. The Compose
port is local by default. Put an authenticated TLS reverse proxy in front of any
remote deployment and set its explicit public origin. Do not expose an unauthenticated
appliance on an untrusted network. Tokens remain outside logs and persistent UI
storage.

The queue accepts at most five jobs and processes one at a time. API requests are
size- and time-bounded. Pagination is bounded, SQLite queries use parameters and
supporting indexes, and retention deletes old records and artifacts. One process
owns the database. Pending/running records become failed after restart. Graceful
shutdown cancels queued work, aborts active scanners, waits for cleanup, and then
closes SQLite.

Reports can contain source snippets when explicitly enabled and may contain
architecture documents or sensitive project names. Store the report/data volume
accordingly. HTML evidence is escaped; no repository HTML is evaluated. Downloads
use attachment headers. Security findings withhold snippets and matched secret
values. A report is not a security certification.

Report publication acquires an exclusive `.antislopscan-report.lock` in its output
directory, preventing concurrent CLI writers from interleaving artifacts. If the
process is forcibly killed during publication, remove a stale lock only after
confirming that no writer is using that directory. API jobs use unique output
directories. A requested report that fails removes its stale prior artifact.

For vulnerabilities, report the affected version, reproducible input, boundary
crossed, and expected behavior privately to coertzen.jfs@gmail.com. Do not include
live credentials in issue reports.
