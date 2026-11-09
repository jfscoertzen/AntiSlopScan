# AntiSlopScan 1.0.0-alpha.2

This alpha adds an ordered, fail-closed delivery pipeline, Snyk dependency and
Code scanning, and branded CI reports with detailed test and screenshot evidence.

## Changes

- Jest functional and regression suites for the backend, API, CLI and offline
  package. Playwright drives the real frontend and captures 194 required visual
  checkpoints across assessment, history, investigation, exports and appearance.
- The same verification gates run locally and in GitHub Actions before Docker
  images or executable archives can be published. Failed, missing and skipped
  checks remain visible.
- Standalone branded HTML and A4 PDF CI reports include every test's assertions,
  gate timings, scoped coverage, scanner results, Snyk findings and screenshots.
  GitHub retains viewable reports and raw evidence, with links in the job summary.
- Pinned Snyk CLI scans production/development npm dependencies and supported
  source files. High/critical findings or unavailable scans block release.
- Source snippets now require inventoried regular files; internal workers accept
  only their private bounded context file. Scanner errors use safe metadata.
- Updated Vite/esbuild and a scoped, compatibility-tested ESLint URI resolver.
  Production Vue comment spans remain masked during code-only analysis.
- Original author headers and the frontend footer use the open-source identity.
  Local agent instructions, private configuration and article drafts are excluded
  from release artifacts.

## Verification and remaining issues

The release pipeline runs 64 Jest cases, Playwright screenshot checks, SAST,
history/working-tree secrets scans, dependency advisories, the appliance self-audit
and both Snyk scans, followed by archive and executable verification. Actual
results and diagnostics are available in the release workflow's CI report artifact.

The preceding live Snyk verification reported zero Code findings, zero
high/critical dependency findings and four medium advisory/package/version
combinations. Those medium findings remain visible. These are observed scan
results, not a security certification; the hosted run uses the current advisory
database and enforces the same thresholds.

## Install

```sh
docker pull jfscoertzen/antislopscan:1.0.0-alpha.2
docker run --rm --network none \
  -v /absolute/source:/workspace:ro \
  -v /absolute/reports:/reports \
  jfscoertzen/antislopscan:1.0.0-alpha.2 cli --source /workspace --output /reports
```

The container runs as UID/GID 1000; the reports directory must be writable by
that user. The `alpha` image tag follows the latest alpha. Release attachments
include the Linux x86_64 executable archive, installable npm tarball and
`SHA256SUMS`. The npm tarball can be installed locally or globally with
`npm install --global --ignore-scripts ./antislopscan-1.0.0-alpha.2.tgz`.

Linux x86_64/glibc is the current distribution target. This is an alpha release.
Optional AI review remains opt-in, and normal appliance audits remain
offline-capable. Snyk is a cloud-backed delivery gate for this project's own
checkout, separate from the runtime scanner catalog.
