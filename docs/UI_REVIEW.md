# UI delivery gate

## Snyk CI report extension

Reading: technical CI evidence for developers/reviewers, extending the existing
publication direction at ENERGY 2 / RHYTHM 2 / MOTION 0. The application shell,
palette, mark and topology artwork are reused. Both complete verification runs
reexercised the unchanged workbench through 64 passing cases and 194 required
screenshots.

- Evidence PASS (R-17/R-36/R-38): real Snyk version, exits, timings, severity
  counts, dependency paths and fix information are shown. Code reports zero
  findings; four medium dependency combinations remain visible. Raw scan
  comparison and hostile-HTML tests pass; missing measurements remain explicit.
- Purpose/identity PASS (R-01/R-04/R-06/R-07/R-09/R-14/R-22): the existing
  branded cover identifies the run; compact tables compare the two actual scans,
  and native disclosures hold dependency evidence. Existing typography, source
  monospace and status colors serve the same publication hierarchy.
- Navigation/keyboard PASS (R-24/R-26/R-32/R-39): a real offline browser review
  focused the first Snyk disclosure, opened/closed it with Enter and verified its
  exact Snyk advisory URL. The review PNG is `artifacts/ci/snyk-report-review.png`.
- Safety/accessibility PASS (R-25/R-34/R-40): established light report tokens,
  visible native focus, headings and explicit statuses are retained. HTML/PDF
  use embedded assets, escaped text and the existing restricted CSP; PDF page
  JavaScript and network access are disabled. The application theme/contrast
  matrix remains covered by both successful Playwright scenarios.
- Print/craft PASS (R-03/R-35/C-1/C-3/C-4): the final A4 report cover, pipeline,
  Snyk counts/remediation, scanner table, feature capture, responsive contact
  sheet and final diagnostics were rendered and visually inspected. Print
  severity labels, headers and numeric durations stay readable without overlap.
- Scope PASS (R-02/R-18/R-23/R-27/R-28/R-37): this is an existing report
  extension with established direction, ordinary interface copy, genuine empty
  and unavailable states, and existing authorized branding. It introduces no
  promotional statistics, testimonials, FAQ, navigation or animation.

## Publication reports

The report design read preceded implementation in `DESIGN.md`: technical audit
publication for developers/reviewers, ENERGY 2 / RHYTHM 2 / MOTION 0. This extends
the workbench gate below. No runtime dependency was added.

- Identity PASS: shared palette, seven accents, original icons, brand mark,
  Imagegen topology and four principle posters connect reports to the frontend.
- Purpose PASS: the cover separates exact quality, CI decision, coverage and
  finding counts; conceptual artwork never represents discovered dependencies.
- Hierarchy PASS: restrained cover, chapter numbers, severity donut, category
  meters, ranked evidence, scanner tables and evidence appendices suit their
  content. White A4 pages use a compact brand footer and global page numbers.
- Evidence PASS: static and LLM assessments are independently labeled within
  each principle; sample limits, confidence, citations, recommendations and
  unresolved assessments remain visible. JSON/SARIF contracts are unchanged.
- Accessibility PASS: seven report accents in both modes meet the existing
  text/control/focus contrast assertions. Native disclosures, keyboard-friendly
  controls, labels, visible values and focus indicators supplement graphics.
- Responsive PASS: standalone report geometry passes 320/390/540/768/900/1440px
  in light and dark modes. Saved accent reload and malformed-storage fallback pass.
- Interaction PASS: exact filters, sorting, pagination, dashboard/file/rule
  drill-downs and disclosures still work. Print restores all evidence and uses
  white pages even when the OS is dark. No report animation is introduced.
- Offline/safety PASS: artwork is embedded once, source/model content remains
  escaped, strict CSP is retained, and browser checks detect no external asset
  requests or script exceptions. PDF disables networking and page JavaScript.
- Craft PASS: actual private repository cover, summary, LLM page, principle illustrations,
  citations and finding continuation pages were rendered and visually reviewed.
  Complete-artifact preservation and deployment evidence are in `VALIDATION.md`.

Anti Slop mode: during implementation, selected by the user.
Reading: a software intelligence workspace for developers and reviewers, with
an instrument-panel visual language. ENERGY 2 / RHYTHM 2 / MOTION 2, as recorded
before implementation in [DESIGN.md](../DESIGN.md).

Evidence: the successful `npm run test:e2e` runs an actual 267-finding audit,
checks the Vue workbench and unchanged standalone HTML, and downloads all four
reports. The real private repository result supplies visual review in
`artifacts/intelligence-*-review.png`. It has 13,718 findings, 366 graph nodes,
965 edges and four cycles; no demonstration data replaces its canonical result.
The latest release/deployment evidence is recorded in [VALIDATION.md](VALIDATION.md).
The LLM extension was additionally reviewed using the authentic final private repository
run (13,766 findings/observations), with screenshots in
`local untracked review artifacts`. Its 59/100 model score, 27 graded
principles and 24-file sample remain separate from the unchanged static 96/100.

## Hard gate

- R-02 PASS: authored interface copy uses ordinary punctuation; untrusted source evidence remains escaped.
- R-03 PASS: both themes and all seven accents measured without document overflow at 320, 390, 540, 768, 900 and 1440px. The narrowest tabs use text labels; tables scroll within their containers.
- R-17 PASS: all scores, counts, statuses, geometry inputs and baseline conditions derive from canonical audit data.
- R-18 PASS: no testimonials, avatars or fictional people.
- R-23 PASS: the user explicitly requested branding, backgrounds, icons, navigation and animated principle explanations. Built-in Imagegen generated topology/inspection PNGs and four six-frame principle sheets; exact prompts and GIF assembly provenance are preserved.
- R-24 PASS: existing section anchors, audit query URLs and authenticated report endpoints remain operational.
- R-25 PASS: browser checks require ordinary text, muted text, accents and semantic colors to reach 4.5:1 on every base surface in both modes; controls/focus reach 3:1 and primary-action text reaches 4.5:1.
- R-26 PASS: audit submission, connection, history, pagination, filters, sort, charts, graph/module controls, principle search/domain/status filters, provider/model/budget/consent fields, copying, exports, theme/accent/motion and disclosures perform real actions.
- R-27 PASS: empty review/history, invalid JSON, authentication error, queued/running/completed/failed jobs, absent graphs and no-match filters have explicit states.
- R-28 PASS: no generic FAQ.
- R-32 PASS: native forms/disclosures, skip link, visible focus, keyboard selection, Escape from header settings, assessment/evidence focus and phone history return-to-repository focus were exercised.
- R-33 PASS: features live in Vue/TypeScript/CSS sources; no runtime source-rewriting script. One-time Prettier formatting only improved source readability.
- R-34 PASS: light, dark and system modes plus all seven saved accents pass browser checks; invalid stored accents return to neutral. Existing saved choices remain authoritative.
- R-35 PASS: strict application and Vue template type checks, production build, actual audit interactions and browser exception checks pass.
- R-36 PASS: severity and confidence are qualified; high quality never implies a passing CI gate or confirmed vulnerability status.
- R-37 PASS: direction and purposes were recorded in DESIGN.md before redesign.
- R-38 PASS: controlled provider data appears only in tests; live reviews use authentic persisted private repository results and actual configured local provider inference, with model provenance, sample size and unassessable principles displayed.
- R-39 PASS: labeled native controls, accessible icon names, pointer/hover/active/disabled/focus states, keyboard module selection and reduced-motion rules are present. Nonessential network flow and explanatory GIFs share a pause control, honor document visibility/reduced motion, and stop when their disclosure closes or leaves the page.
- R-40 PASS: PNG/GIF dimensions are explicit; hero assets are eager/high priority, generated artwork is local, and no external font/script blocks rendering. Four small GIFs animate only in open explanations. No unmeasured speed score is claimed.

## Purpose gate

- R-01 PASS: the hero's restrained gradient and illumination distinguish the main quality outcome and blend topology into the surface; no unrelated decorative gradients.
- R-04 PASS: original SVG icons identify concrete actions and domains: files, scans, security, coverage, architecture, settings and exports.
- R-06 PASS: offline system sans supports dense investigation; monospace is limited to code and identifiers, with tabular measured values.
- R-07 PASS: topology and the radial graph are expressly requested systems-intelligence identity; the illustrative background is labeled separately from measured dependencies.
- R-08 PASS: chevrons indicate drill-down/disclosure direction; graph arrows encode actual importer-to-dependency direction.
- R-09 PASS: restrained CI status styling represents the actual gate; no promotional capsules.
- R-10 PASS: opaque surfaces, no glassmorphism or blur stack.
- R-12 PASS: a modest hero shadow establishes summary hierarchy; popover shadows distinguish temporary settings. Ordinary panels use borders.
- R-13 PASS: illumination remains in the hero artwork and background; no simultaneous glowing controls and cards.
- R-14 PASS: KPI summaries, proportional severity arcs, category tracks, ranked lists, evidence disclosures, graph inspection and tables serve different content.
- R-19 PASS: optional SVG path flow supports the scanning identity; small transitions support feedback. Hidden-document simulation, explicit pause/resume and reduced-motion behavior are tested.
- R-22 PASS: Imagegen artwork depicts code inspection, shared authority, module boundaries, interface contracts and bounded feedback specifically; explanations label it conceptual rather than discovered repository topology.

## Liveliness

- Dials PASS: ENERGY 2 / RHYTHM 2 / MOTION 2 are explicit and maintained.
- Focal point PASS: the overall quality gauge anchors the hero; findings lead with evidence and Architecture leads with measured relationships.
- Whitespace PASS: space separates the outcome, investigative summaries and source evidence; neighbor lists and graph rendering are bounded.
- Accent PASS: one user-selected interaction/quality accent sits on neutral navy/graphite or cool white; severity retains separate documented semantics.
- Motif PASS: curved dependency paths, module nodes and code inspection connect the generated artwork to the real architecture explorer.
- Design Read PASS: the declared software intelligence direction preceded implementation.

## Craftsmanship and quality locks

- C-1 PASS: palette, typography, graphics, chart, geometry, radius and motion purposes are written in DESIGN.md.
- C-2 PASS: enabled controls have exercised behavior; failed clipboard access exposes a copyable-text fallback.
- C-3 PASS: every section supports assessment, history, outcome, evidence, coverage, structure or explicit limitations.
- C-4 PASS: dark/light/OS, mobile/tablet/desktop, keyboard and empty/loading/error/result states are covered.
- C-5 PASS: no fabricated claims, metrics, trends, baselines or discovered causal loops.
- R-05 PASS: the shell follows repository investigation; charts, evidence and graph panels follow their actual content rather than a landing-page template.
- R-11 PASS: 8/12/16px radius tokens distinguish controls, panels and hero.
- R-15 PASS: labels name concrete operations such as Run repository audit, Review critical findings and Inspect file findings.
- R-16 PASS: no promotional AI buzzwords.
- R-20 PASS: code-inspection branding, illustrative dependency topology and real graph/evidence investigation establish the product identity.
- R-21 PASS: dark-first follows the user's explicit brief; light/system and existing saved preferences remain supported.
- R-29 PASS: neutral surfaces, one interaction accent, and documented severity/relationship colors form a coherent palette.
- R-30 PASS: references inform polish and depth, without copying their layouts.
- R-31 PASS: major design choices have written purposes and concrete verification.

## Interaction evidence

1. Connect with bearer authentication; load defaults; submit invalid then valid JSON.
2. Run the actual fixture audit; retain exact POST, history, polling and export contracts.
3. Exercise 50-finding pagination and every existing filter/sort; export the complete filtered selection.
4. Expand evidence, remediation, provenance and safe online references; verify successful clipboard text and denied-access fallback.
5. Drill from severity, category/rule/file/scanner summaries and selected graph modules, including a file with no findings.
6. Search actual dependencies and their one-hop neighbors, change selected module, filter runtime edges, and verify no-match state.
7. Search/filter principle assessments without deriving new conclusions.
8. Open/close the assessment with focused input; use native settings disclosures and Escape.
9. Pause/resume background flow, simulate hidden/visible document events and inspect actual animation styles; emulate reduced motion.
10. Exercise seven accents, both modes, six widths, reload persistence, malformed preference fallback and live OS changes. Open phone history and return focus to the selected repository.
11. Download HTML/PDF/JSON/SARIF and verify standalone HTML filtering, disclosures, print and themes remain operational.
12. Reject API provider redirection before any model request; edit model and source budget through the GUI's authoritative JSON, run a real structured HTTP exchange, and display a separate LLM score with citations.
13. Open/close explanatory GIFs, pause/resume, emulate reduced motion, paginate 14-principle pages, filter domains/status/search, and drill from a checked source citation to the file's findings.
14. Verify actual configured local provider inference and sample coverage on private repository, both themes/six widths, configured deployment defaults, zero browser exceptions and no external browser asset requests. Preserve all old audit IDs and report hashes.

No new frontend framework or runtime dependency was introduced. The LLM extension
adds optional review metadata, provider configuration and a separate sample score;
existing deterministic scores, detector behavior, CI thresholds, API routes and
old result readability are preserved. Provider failures remain visible and follow
the existing scanner-error/coverage policy. Pinned MIT `vue-tsc@3.3.14` is a
development type checker. Static graph geometry is tested for determinism,
evidence preservation, self-loops, filtering, bounds and input immutability.
