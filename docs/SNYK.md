# Snyk dependency and source scanning

Snyk is a required **delivery gate for AntiSlopScan's own checkout**, alongside
the existing offline SAST, secrets, npm-audit and self-audit gates. It follows
the reference project's two-scan approach while retaining all severities and
validating actual completion. It is separate from the appliance scanner catalog:
normal repository audits remain offline-capable and do not transmit source to
Snyk. The CI Code scan sends this project's source to Snyk's hosted service.

## Configure and run

Add a GitHub Actions repository secret named **`SNYK_TOKEN`**, containing a token
authorized for Open Source and Code analysis. Enable Snyk Code for its organization.
Optionally set repository variable **`SNYK_ORG`** to the organization's UUID or
slug. CI and release pass only this secret to their reusable verification workflow;
Docker publication credentials remain confined to the separate publish job.

For local CI, export the token from a secret store or existing shell environment.
Do not put it in a command argument, tracked file or Docker build argument.

```sh
# With SNYK_TOKEN already exported:
npm run ci:docker
```

The Docker build installs the exact CLI binary and upstream license pinned by
version and SHA-256 in [snyk-ci.json](../config/snyk-ci.json). Native CI needs the
same tool installation once:

```sh
sh scripts/install-ci-tools.sh
npm run test:snyk
# Or run every application gate, including Snyk:
npm run ci:local
```

`ANTISLOPSCAN_CI_OUTPUT=/absolute/folder` changes output; the default is
`artifacts/ci/`. Tokens are forwarded to the Snyk stage only. Build, unit tests,
browser fixtures, other scanners and report rendering use sanitized environments.
Docker receives the token at execution time by environment-variable name, never
as a baked image layer or a literal command argument. Snyk cache/configuration
use a temporary directory removed after both scans.

Fork pull requests do not receive repository secrets. Their Snyk stage records
**unavailable** and fails verification; maintainers can verify a reviewed change
on a trusted branch with the configured secret. Do not use `pull_request_target`
or expose credentials to untrusted fork code to bypass this boundary. Missing
credentials, unavailable Code entitlement, authentication/network failure,
unsupported projects, timeout or invalid results block publication.

## What executes and what blocks

The runner checks `snyk --version`, then independently attempts:

```sh
snyk test --file=package.json --dev --ignore-policy --json
snyk code test --json
```

These commands are invoked with a fixed verified binary, argument arrays and no
shell. The dependency scan covers the root npm lockfile including development
dependencies. Code scans supported source files under Snyk's normal supported-file
and ignore behavior, including repository `.gitignore`; generated/dependency
trees are excluded by that existing policy. No broad `.snyk` ignore policy or
finding suppression was introduced. The application never runs this gate against
an operator's submitted repository.

Both scans are attempted even if the first fails. Exit **0** means clean
completion, **1** means completed with findings, and **2/3** mean execution or
project-support failure. JSON/SARIF structure and exit/result consistency are
checked. Code SARIF maps `error` to high, `warning` to medium and `note` to low;
Snyk Code has no critical severity. Unknown severities and malformed results fail
closed. Each scan has a ten-minute deadline; its process group is killed on timeout.

All reported issues remain in evidence. **High or critical** findings in either
scan fail the release gate. Low/medium findings remain visible without blocking
this configured threshold. Dependency counts deduplicate advisory/package/version
combinations while retaining every reported dependency path; Code counts retain
each reported location. No synthetic Snyk repository score is calculated.

## Reports and evidence

- `snyk.json`: run ID, expected/executed version, per-scan execution status,
  duration, exit code, gate decision, severity counts and normalized issues.
- `snyk/dependencies.json`: full original dependency JSON, including fix details.
- `snyk/code.json`: full original Code SARIF, including locations and data flows.
- `snyk/*.log`: version and scan context; failures preserve their raw diagnostic
  artifact instead of claiming a valid result.

The branded `ci-report.html` and `ci-report.pdf` show the Snyk pipeline gate,
separate dependency/Code execution and severity results, remediation versions,
dependency paths, source/data-flow locations and advisory links. Unknown
measurements display **not assessed**, never zero. The collector verifies the run
ID and recomputes normalized findings from current raw artifacts; inconsistent
or stale summaries invalidate report evidence. GitHub retains reports and raw
evidence even after a failed gate.

## Remediation verified during integration

The initial live scan reported three Code path-handling observations (two medium,
one low), one critical esbuild advisory, one high `uri-js` advisory and lower
dependency findings. Regression fixtures reproduced permissive snippet and worker
context file access before hardening. The fixes:

1. Require finding paths to belong to the source inventory. Snippet reads reuse
   the bounded, no-follow, descriptor-checked source reader, rejecting traversal,
   unlisted files and symlinks. Existing scoring and evidence locations are preserved.
2. Restrict the internal worker to its own `context.json`, read as bounded UTF-8
   through the same reader. Its private context budget is 64 MiB; arbitrary CLI
   file paths are rejected. The public audit CLI/API contracts are unchanged.
3. Classify scanner errors into fixed safe metadata instead of reflecting raw
   exception text or trusting its status field. Scanner failures remain visible;
   model/source diagnostics cannot become output paths or reported source text.
4. Upgrade the build toolchain to Vite **7.3.7**, Vue plugin **6.0.10** and the
   locked patched esbuild version. The final Vite patch also removes a newer
   advisory found during the first upgrade attempt.
5. Replace ESLint's Ajv **6.15.0** `uri-js` dependency through an **ESLint/Ajv
   parent-scoped npm override** with `fast-uri` **3.1.9**, already used by the current Ajv stack.
   This changes the actual installed resolver rather than suppressing its
   advisory. The resolvers are not universally identical: this substitution is
   constrained to appliance-owned ESLint schemas and validated with draft-07
   relative references, valid/invalid/missing/extra properties, real lint flows,
   offline package installs and bounded Unicode-separator regressions. Preserve
   the override until an upstream Ajv/ESLint solution is validated; review it
   whenever that parent dependency changes.

The lockfile is generated with the container's npm **10.9.8**, and the native
npm **12.1.0** installation/packaging path is also tested. The parent chain is
`eslint → ajv → uri-js`: it avoids treating the existing Ajv version itself as
a version override, which newer npm rejects in bundled releases. Empty-cache
offline global/local installation tests verify the actual bundled resolver and
CLI behavior, rather than relying only on a clean dependency scan.

After these changes, the live scan reports **zero Code findings**, **zero
high/critical dependency advisories** and **four unique medium dependency
advisory/package/version combinations**. These are observed results, not a
security certification; future service/database updates can change them.
Final end-to-end verification is recorded in [VALIDATION.md](VALIDATION.md).

## Verified references

- [Snyk dependency test commands, exits and npm options](https://docs.snyk.io/developer-tools/snyk-cli/commands/test)
- [Snyk Code commands, exits and SARIF output](https://docs.snyk.io/developer-tools/snyk-cli/commands/code-test)
- [Snyk Code severity mapping](https://docs.snyk.io/developer-tools/snyk-cli/scan-and-maintain-projects-using-the-cli/snyk-cli-for-snyk-code/view-snyk-code-cli-results)
- [Unfixed uri-js infinite-loop advisory](https://security.snyk.io/vuln/SNYK-JS-URIJS-19963963)
- [esbuild insecure-download advisory and fixed versions](https://security.snyk.io/vuln/SNYK-JS-ESBUILD-17750822)
- [Maintained fast-uri API and scope](https://github.com/fastify/fast-uri)
