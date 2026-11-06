# Third-party notices

antislopscan's original code is Apache-2.0, authored by Stephan Coertzen (coertzen.jfs@gmail.com). Third-party components
retain their original licenses; this project does not relicense them.

| Component | Pinned version/source | License and distribution treatment |
| --- | --- | --- |
| SlopScore | 2.7.0 | MIT; upstream notice remains in `node_modules/slopscore/LICENSE`. |
| dmmulroy Anti-Slop | 0.1.2, commit `e8c4880471b23ab7f216fba7b27d173a6ef07d4c` | MIT; unmodified source and original license in `tools/vendor/anti-slop/`. Generated JavaScript, license and provenance are in `dist/vendor/anti-slop/`; no published plugin package is assumed. |
| skew202 AntiSlop | release v0.3.0 | Declares MIT OR Apache-2.0 in Cargo metadata. Distributed as an independent CLI; matching source archive included in `tools/sources/antislop-v0.3.0.tar.gz` by installer. Upstream archive does not ship a standalone license file; its declared license and attribution are preserved here and in its source metadata. |
| miqdadbadjuber Anti-Slop agent policies | evaluated installed skill 3.2.25/current upstream documentation | MIT; no agent executable is bundled. antislopscan's deterministic comment-separator indicator and human-review policies are original implementations informed by the documented policy. |
| ESLint | 10.10.0 | MIT; package notices retained in `node_modules/`. |
| TypeScript | 5.9.3 | Apache-2.0; package notices retained. Used for parsing, not repository compilation. |
| typescript-eslint parser | 8.69.0 | BSD-2-Clause; package license retained. |
| Oxlint / @oxlint/plugins | 1.78.0 / 1.78.0 | MIT; installed package/native binding notices retained. |
| dependency-cruiser | 18.7.2 | MIT; package notices retained. |
| jscpd | 5.4.2 | MIT; Node launcher and platform binary packages retain their licenses. Semantic models are not downloaded or used. |
| Semgrep Community Edition | 1.183.0 | LGPL-2.1; invoked as an independent process with original antislopscan rules. Wheel notices retained; matching source archive in `tools/sources/semgrep-v1.183.0.tar.gz` and license in `tools/notices/SEMGREP-LICENSE` are included by installer. No proprietary engine or licensed registry rules are installed. |
| Gitleaks | 8.30.1 | MIT; original license extracted to `tools/notices/GITLEAKS-LICENSE`; source reference in research documentation. |
| Ruff | 0.17.3 | MIT; Python wheel license metadata retained. |
| Radon | 6.0.1 | MIT; Python package license metadata retained. |
| Fastify | 5.12.8 | MIT; package notices retained. |
| Vue | 3.5.45 | MIT; package notices retained; Vue runtime included in built UI. |
| Ajv | 8.20.0 | MIT; package notice retained. |
| minimatch | 10.2.6 | ISC; package notice retained. |
| Playwright | 1.56.0 | Apache-2.0; package license/NOTICE retained. Chromium revision 1194 includes its own bundled third-party credits. |
| pdf-lib | 1.17.1 | MIT; package license and transitive standard-font/pako notices remain in `node_modules/`. Used only to merge appliance-generated PDF sections and add global page numbers; arbitrary uploaded PDFs are not accepted. |
| Vitest / Vite / Vue Vite plugin | 2.1.9 / 5.4.21 / 5.2.4 | MIT; development/build package notices retained in this source-built image. |
| vue-tsc / Vue language tools | 3.3.14 | MIT; development-only Vue SFC type checker. Installed through the locked dev dependency tree; original notices retained. Not part of the browser runtime or bundled production npm dependencies. |
| Node.js | 22.22.3 | Node distribution and dependency licenses are retained by the base image. |
| Unprivileged Nginx gateway | Nginx 1.30.6, stable-alpine image digest pinned in Compose | Container packaging is Apache-2.0; Nginx uses its upstream BSD-style license. Original notices remain in the independently distributed gateway image. The gateway has no source/history mounts. |
| Debian, Python, Chromium system dependencies | Debian bookworm image package manifest | Their original notices remain in system package/documentation paths. |

The complete npm transitive closure is locked in `package-lock.json`;
`tools/package-lock.json` records the former separate scanner installation.
The npm release bundles production dependencies with their original notices and
copies the verified lockfile to `config/npm-dependencies.lock.json`. It omits
Python/native bundles and Chromium, which remain part of the Docker/full setup.
Python packages are pinned in
`tools/requirements.lock`. `node scripts/tool-inventory.mjs` produces a machine
inventory of installed npm licenses and versions. Preserve license files when
repackaging or pruning dependencies, including those for the bundled Vue runtime.

Semgrep remains replaceable through its fixed independent binary installation.
Recipients must retain LGPL rights and obtain the corresponding source when
redistributing its binaries. The appliance carries the matching archive; extract
it with `docker cp CONTAINER:/app/tools/sources/semgrep-v1.183.0.tar.gz .`.
Keep that archive and its upstream build instructions with redistributed images.
Any modifications to LGPL components must carry the corresponding modified
source and notices. antislopscan does not modify the Semgrep engine.

Optional evaluated tools not installed (Knip, Clippy, PMD, Checkstyle, clang-tidy,
SonarQube) are not redistributed by this appliance. Their licensing and activation
constraints are recorded in `docs/TOOL_RESEARCH.md`.
