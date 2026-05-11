# Changelog

All notable changes to the ArgML reference implementation are recorded here. Each entry corresponds to a phase from [`PLAN.md`](./PLAN.md).

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
- Spec lives at `spec/argml-spec.md` (Working Draft 0.2).
