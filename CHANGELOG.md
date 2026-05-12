# Changelog

All notable changes to the ArgML reference implementation are recorded here. Each entry corresponds to a phase from [`PLAN.md`](./PLAN.md).

## Phase 4 — HTML Renderer

- Added `renderHTML(doc, options): string` in `src/render/html.ts`. Output is a self-contained HTML5 document that embeds (a) the raw ArgML XML inside a `<script type="application/xml" id="argml-source">` payload, (b) the bundled stylesheet inline, and (c) a bundled client renderer script inline. No external assets are fetched. Re-exported from `src/index.ts`.
- The visible reading experience is produced **client-side** by `src/render/assets/arg-render.ts`, which parses the embedded XML via `DOMParser`, walks the tree, and mounts the rendered document into `<div id="root">`. Features:
  - Visual encoding: dotted-underline terms; numbered claim anchors; color-coded credence and strength badges; defeasible inferences as left-bordered block asides (double-border for strict); conflicts as bordered asides with attacker → target pair and optional response; evidence as hoverable superscripts; `<epistemic-status>` banner at the top.
  - Interactive reader: hover tooltips for terms / claims / inferences / evidence / notes; a right-gutter marginalia view with glosses and SVG arrows linking related claims; a left-gutter graph view of the argument structure with hover-to-highlight; a toolbar to toggle frontmatter / annotations / graph modes.
  - Cross-document `<term ref="prefix:id">` references render with an `argml-external` marker pending Phase 7 resolution (logged in `SPEC-NOTES.md`).
- **Architectural divergence from the original PLAN.** Project.md §Phase 4 specified server-side templates with markup that remains readable when CSS is disabled. This phase ships a JS-driven client renderer instead — the body is parsed and rendered in the browser. With JavaScript disabled the page is a blank shell. Recorded in `SPEC-NOTES.md` and `docs/adr/0001-client-side-html-renderer.md`; Project.md §Phase 4 acceptance criteria have been updated to match.
- Client renderer is TypeScript (`src/render/assets/arg-render.ts`) compiled by a dedicated `tsconfig.client.json` to a single browser-targeted script, then baked into `src/render/assets.generated.ts` by `scripts/generate-render-assets.ts`. The generator runs automatically via `pretest` / `prebuild`, so the inlined bundle cannot silently drift from its source.
- Pure rendering helpers (`escape`, `parseList`, `mdLinks`, `refLabel`, `buildClaimGloss`, `buildTermGloss`, `buildInferenceGloss`, `buildEvidenceGloss`, `renderFrontmatter`) live in `src/render/assets/arg-render-core.ts` so they can be unit-tested without a DOM.
- Replaced the Phase 3 `runRender` stub in `src/cli/render.ts`: loads the document, renders, writes to `--output <path>` or stdout; non-zero exit on parse failure or file write error.
- Implemented `pnpm render-examples` (script at `scripts/render-examples.ts`) — iterates `examples/*.argml.xml`, runs parse + validate + renderHTML, writes `examples/rendered/*.html`, exits non-zero on parse failure.
- New dev dependencies: `tsx` (run TypeScript scripts), `happy-dom` (DOM environment for renderer tests).
- Tests: pure-helper unit tests in `src/render/assets/arg-render-core.test.ts`; integration tests in `src/render/assets/arg-render.test.ts` that mount the renderer in `happy-dom` against the worked example and assert document structure (header, prose annotations, gloss gutter, graph nodes, parsererror fallback, external-ref handling). Existing tests in `src/render/{escape,html}.test.ts` and `src/cli/render.test.ts` retained.

## Phase 3 — CLI Tool

- Added `argml` CLI in `src/cli/` (built via `tsc` to `dist/cli/main.js`, wired through `package.json` `bin`).
- Subcommands:
  - `argml validate <file>` — runs parser + validator; prints diagnostics as `path:line:col: severity code message`; exits 1 if any errors, 0 otherwise; ends with an `N errors, M warnings` summary line.
  - `argml summary <file>` — structural counts (terms, assumptions, claims, inferences, conflicts, sections, paragraphs), import declarations, and unique cross-document references with their declared-prefix / UNKNOWN PREFIX status.
  - `argml deps <file> --target <id>` — ASCII trees rooted at the target for "rests on", "supports", and "supported by"; cross-doc references render as `[external]`; cycles render as `[cycle]`.
  - `argml graph <file> [--format json|dot]` — cytoscape-shaped JSON (default) or Graphviz DOT. Nodes cover claims, assumptions, inferences, conflicts, and external (cross-doc) references; edges cover supports, attacks (with attack-type), rests-on, via-inference, and inference from/to.
  - `argml render <file> [--output <html>]` — stub for Phase 4; prints `render: not yet implemented (Phase 4)` and exits 0.
- Added `commander@^12.1.0` as a production dependency.
- Unit tests per subcommand plus a clean run against `examples/morality-without-consciousness.argml.xml`.
- CLI modules import only from `src/index.ts` (public API); no deep imports into parser/validator internals.

## Phase 2 — Validation

- Added `validate(doc: ArgMLDocument): Diagnostic[]` in `src/validator/` — a pure, single-pass semantic check over the AST. Never throws; emits diagnostics with stable codes and source positions.
- Introduced diagnostic codes `ARGML001`–`ARGML016` covering: duplicate ids, unresolved local references, undeclared import prefixes, missing inference premises, numeric `credence` / `strength` range and spurious-precision (spec §12.2), empty term aliases, `rests-on` / inference `from` kind mismatch, inference `to` kind, conflict `<attacker>` / `<target>` kind, `strength="deductive"` / `defeasible` coherence, undercut against non-defeasible inferences, term-ref resolution, `via` resolution, and `supports` / `attacks` resolution. Documented in `SPEC-NOTES.md`.
- Cross-document references (`prefix:id`) are checked structurally for prefix declaration only; remote resolution is deferred to Phase 7.
- Diagnostics are returned sorted by `(line, column, code)` for stable test output.
- Added `raw: string` to the numeric variant of `BucketOrNumericValue` (preserves the original lexical form so the validator can detect spurious precision and the serializer can round-trip numeric attributes losslessly).
- Public API: `validate`, `Diagnostic`, `DiagnosticCode`, `ARGML_CODES` re-exported from `src/index.ts`.
- Unit tests cover each `ARGML…` code, the clean-validation of the worked example, and stable diagnostic ordering.

## Phase 1 — Core Data Model and Parser

- Added typed AST in `src/ast/` covering every element in spec §7, with discriminated unions for inline body nodes and distinct kinds for declaration-form (`term-decl`) vs reference-form (`term-ref`) `<term>`.
- Implemented `parseArgML(xml)` in `src/parser/` on top of `fast-xml-parser` (`preserveOrder` + `captureMetaData`), returning a `ParseResult` with a typed document and a diagnostic array (never throws on user input).
- Source positions on every AST node, sourced from the parser's `startIndex` metadata and a precomputed `LineMap`. Covers at least `<claim>`, `<term>` (both forms), `<inference>`, and `<conflict>` per Phase 1 acceptance.
- Whitespace handling: preserved inside prose-bearing elements (`<p>`, `<claim>`, body-form `<term>`, `<gloss>`, `<inference>` warrant, etc.); ignored between structural elements.
- Initial diagnostic codes: `PARSE001` (malformed XML), `PARSE002` (wrong namespace on `<post>`), `PARSE003` (root not `<post>`), `PARSE004` (missing `<head>` or `<body>`), `PARSE005` (unknown element warning). Logged in `SPEC-NOTES.md`.
- Lightweight serializer in `src/parser/serialize.ts` for round-trip testing.
- Added `examples/morality-without-consciousness.argml.xml` (Appendix B worked example).
- Added unit tests covering parse, source positions, and parse → serialize → parse round-trip.
- Public API surface in `src/index.ts` (`parseArgML`, `serializeArgML`, AST types, diagnostic types).

## Phase 0 — Project Scaffolding

- Initialized pnpm + TypeScript + Vitest + Biome toolchain.
- Added GitHub Actions CI running typecheck, lint, and tests on push and PR.
- Added `README.md`, `SPEC-NOTES.md`, `CHANGELOG.md`, and `PLAN.md`.
- Spec lives at `spec/argml-spec.md` (Working Draft 0.1).
