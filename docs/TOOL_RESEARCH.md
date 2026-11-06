# Tool verification and integration decisions

Primary repositories/documentation were reviewed on 2026-11-05. Installed help,
package metadata, and actual output were checked before adapter construction.
Versions are intentionally pinned; a newer upstream release is not an automatic
upgrade. Node and Python locks record transitive dependencies. Native downloads
and vendored source provenance are in `scripts/install-native-tools.sh` and
`tools/vendor/PROVENANCE.json`.

| Tool and primary source | Installation, language coverage, outputs | Appliance decision |
| --- | --- | --- |
| [SlopScore](https://github.com/Vinay-O/slopscore) | `slopscore@2.7.0` through `package-lock.json`; Node CLI, multi-language regex/heuristic rules; JSON/SARIF/HTML/Markdown/JUnit. MIT. | Execute `scan SNAPSHOT --json --out PRIVATE_FILE --fail-on never --preset backend` (library preset when requested). The verified UTF-8 file option avoids truncation from immediate `process.exit`; bound file size before parsing. Normalize actual `fileCount` and `findings`; discard upstream snippets. No init/fix/history commands run. |
| [Oxlint Anti-Slop](https://github.com/dmmulroy/anti-slop/tree/e8c4880471b23ab7f216fba7b27d173a6ef07d4c) | Vendored MIT source 0.1.2 at fixed commit; this is not a published npm dependency. JS/TS rules through Oxlint JS plugins. | Register appliance-owned absolute plugin paths in generated JSON. Pair Oxlint and `@oxlint/plugins` at 1.78.0. Enable 14 of the 15 exported generic rules; exclude the safety-comment requirement under the code-only policy. Effect profile separately enables the exported service-constructor-import rule and requires a declared `effect` dependency. No audited repository is edited. |
| [AntiSlop Rust CLI](https://github.com/skew202/antislop/releases/tag/v0.3.0) | Verified release binary 0.3.0, independent of development main's 1.0.0 metadata. MIT OR Apache-2.0. Tree-sitter and pattern checks across supported source languages; human/JSON/SARIF. | Execute `--format sarif --profile APPLIANCE_PROFILE --no-filename-check --max-size KB SNAPSHOT`. The standard profile is not embedded in the binary: vendored v0.3.0 profile extends its embedded core. No remote profiles. Archive checksums and matching source are retained. |
| [Anti-Slop agent policies](https://github.com/miqdadbadjuber/anti-slop), [coding policy](https://github.com/miqdadbadjuber/anti-slop/blob/main/skills/antislop-code/SKILL.md) | Agent instructions/skills, MIT, not a static-analysis executable. Coding policy concerns comment hygiene; visual/copy rules require design context. | Preserve these policies as advisory guidance. Comment-hygiene findings are disabled by the code-only policy; do not pretend a skill ran as a CLI. |
| [ESLint CLI/API](https://eslint.org/docs/latest/integrate/nodejs-api) | ESLint 10.10.0, MIT, typescript-eslint parser 8.69.0, BSD-2-Clause. JS/TS/JSX syntax, correctness/complexity/unsafe constructs; Linter API messages. | Isolated worker uses `Linter.verify` on text with explicit extension matching and inline configuration disabled. No project lookup or plugins. TypeScript filenames remain TypeScript; Vue script lines are preserved. |
| [Oxlint](https://oxc.rs/docs/guide/usage/linter/cli) | 1.78.0, MIT, JS/TS; CLI SARIF/JSON and other formats. | `--config GENERATED --disable-nested-config --no-ignore --threads 1 --format sarif SNAPSHOT`. Configuration contains only trusted appliance rules/plugins. |
| [Knip](https://knip.dev/reference/cli) | Evaluated 6.44.1, ISC; JS/TS unused files/exports/dependencies; JSON reporter available. | Explicit unavailable adapter. Auto-detected framework plugins can load executable configs/compilers. No unreviewed `--reporter json` invocation is claimed safe; a future adapter needs a verified data-only plugin policy. |
| [jscpd](https://github.com/kucherenko/jscpd) | 5.4.2, MIT; current package uses `run-jscpd.js` and platform Rust binary packages. Multi-language clones; JSON/SARIF/HTML and other reporters. | Use `--reporters sarif,json --output DIR --workers 1 --config GENERATED --no-gitignore --skip-comments --min-tokens 50 --min-lines 6 --threshold N`. Comment skipping is verified by the installed CLI help and actual comment-only/real-code fixtures. Normalize SARIF and the JSON analyzed-source count; zero eligible sources reduces coverage. No model downloads, blame, Git, or source execution. |
| [dependency-cruiser CLI](https://github.com/sverweij/dependency-cruiser/blob/main/doc/cli.md) | 18.7.2, MIT; JS/TS import analysis, JSON and graph reporters. | Appliance JSON forbids circular dependencies and enables TS precompilation dependencies. Execute `--config GENERATED --output-type json .` within the sanitized snapshot. Normalize actual violations. Independent graph engine remains available regardless of this scanner. |
| [Semgrep CLI](https://semgrep.dev/docs/cli-reference), [license](https://github.com/semgrep/semgrep/blob/v1.183.0/LICENSE) | CE 1.183.0, LGPL-2.1; broad languages, JSON/SARIF. Python lock pins installed closure. | Local antislopscan rules only: Python eval/shell and JS dynamic Function construction. `scan --config APPLIANCE_JSON --sarif --metrics off --disable-version-check --no-git-ignore --jobs 1 --max-memory MB SNAPSHOT`. No registry, login, proprietary engine, or auto config. Matching source archive included for redistribution. |
| [Gitleaks](https://github.com/gitleaks/gitleaks/tree/v8.30.1) | 8.30.1, MIT, source/text secrets; JSON/CSV/JUnit/SARIF. Native SHA-256 verified. | `dir SNAPSHOT --config APPLIANCE_TOML --report-format sarif --report-path - --redact=100 --ignore-gitleaks-allow`. Trusted default rules extended; source-only snapshot deliberately excludes Git history and config files. Matched values are never retained. |
| [TypeScript compiler](https://www.typescriptlang.org/docs/handbook/compiler-options.html) | 5.9.3, Apache-2.0; TS/JS parsing and compilation. CLI `tsc --noEmit`, diagnostics. | Compiler API parses source as data. Full project type-check adapter is unavailable: dependencies and compiler settings are absent/untrusted, so a real project compilation would be misleading. No package installation is performed. |
| [Radon](https://radon.readthedocs.io/en/latest/commandline.html) | 6.0.1, MIT, Python complexity/maintainability/raw/Halstead; JSON via `cc --json`. | Execute `cc --json SNAPSHOT` from a clean home/CWD. Syntax-error entries fail normalization. Compare actual complexity to operator limits. |
| [Ruff](https://docs.astral.sh/ruff/configuration/) | 0.17.3, MIT, Python correctness/security and other checks; JSON output. | `check --isolated --no-cache --output-format json --select E4,E7,E9,F,B,S SNAPSHOT`. No repository `pyproject.toml`, plugins, or executable imports. |
| [Clippy](https://github.com/rust-lang/rust-clippy) | MIT OR Apache-2.0; Rust compiler lints via `cargo clippy`, Cargo JSON diagnostics. | Unavailable, not bundled. Cargo builds can execute `build.rs` and procedural macros even for checks. Containerization does not authorize repository code execution. |
| [PMD / CPD](https://pmd.github.io/pmd/pmd_userdocs_cli_reference.html) | BSD-3-Clause; Java/Apex and other PMD languages, broad CPD tokenization. `pmd check -d PATH -R RULESET -f json`; CPD separate command/reporters. | Unavailable; JRE and reviewed appliance rules are not bundled. Evaluated, not installed or claimed to execute. jscpd is a separate explicitly named clone scanner. |
| [Checkstyle](https://checkstyle.org/cmdline.html) | LGPL-2.1; Java style via a Java archive, `-c CONFIG`, XML/plain/SARIF options in current docs. | Unavailable; no reviewed JRE/configuration/JAR bundle. Never load repository-defined check classes. |
| [clang-tidy](https://clang.llvm.org/extra/clang-tidy/) | Apache-2.0 WITH LLVM-exception; C/C++, compile database and compiler flags; diagnostics and exported YAML fixes. | Unavailable; trusted compiler options, headers, and compilation database are required. No source-provided compiler plugins or build scripts. |
| [SonarScanner](https://docs.sonarsource.com/sonarqube-server/analyzing-source-code/scanners/sonarscanner) | External SonarQube deployment; scanner licensing/runtime varies by distribution. | Optional unavailable external adapter. Not installed or contacted by default. No fabricated server results. |

Unavailable adapters are disabled by default unless an operator explicitly enables
them. An enabled unavailable adapter reports `unavailable`, lowers applicable tool
execution coverage, and fails the default execution gate. A language mismatch is
`unsupported`; explicit disabled settings and quick-mode exclusions are `skipped`.
Failed or timed-out scans do not contribute clean findings or category coverage.

The installed toolchain was exercised against actual JS/TS and Python fixtures.
See `tests/adapters.test.ts` and the validation record. Language declarations here
describe tool capabilities, not proof that every upstream rule has been benchmarked.

## Additional tool raised during implementation

[scanaislop's aislop CLI](https://github.com/scanaislop/aislop) is a distinct,
MIT-licensed tool with local deterministic scanning and JSON/SARIF output. Its
[documentation](https://scanaislop.com/docs/) describes delegation to tools such
as Knip and Cargo. It is **not installed or integrated** in this version. An
adapter would need verified control over delegated engines, configuration lookup,
network behavior, and source execution before entering the appliance allowlist.
The hosted scanaislop service is not contacted during audits.

## PDF assembly and issue references (2026-11-06)

[pdf-lib](https://github.com/Hopding/pdf-lib), pinned to npm `pdf-lib@1.17.1`,
is MIT licensed. Registry version/license/integrity, the shipped declarations,
and the [PDFDocument API](https://pdf-lib.js.org/docs/api/classes/pdfdocument)
were verified before use. `PDFDocument.load`, `copyPages`, `addPage`, standard
Helvetica embedding, page `drawText`, metadata setters, and `save` merge only
appliance-generated Chromium sections. This resolves the observed large-document
print failure without dropping findings. There is no new scanner, executable,
or arbitrary PDF upload surface.

Curated reference destinations in `src/review.ts` were checked against primary
ESLint/Oxlint/Ruff rule documentation, OWASP code-injection guidance, and the
upstream SlopScore, Anti-Slop, Rust AntiSlop, Gitleaks, Radon, jscpd,
dependency-cruiser, and Semgrep repositories/docs. Canonical rule aliases map to
known ESLint pages; unmapped rules use a scanner reference index. Repository
content never supplies a URL or external search query. The documentation can
track a newer release than the pinned detector version shown in the audit.
