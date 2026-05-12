# ArgML Implementation Project Plan

**Working Draft — to be executed by Claude Code**

| Field         | Value                                   |
| ------------- | --------------------------------------- |
| Date          | 12 May 2026                             |
| Plan version  | 0.2                                     |
| Spec version  | ArgML 1.0 Working Draft 0.2             |
| Spec location | `./spec/argml-spec.md` (sibling file)   |
| Status        | In progress — Phases 0–4 complete       |

**Changes from 0.1 (plan)**: Added Phase 5 (LLM-Assisted Markdown-to-ArgML Conversion). The original Phases 5, 6, and 7 are renumbered to 6, 7, and 8 respectively. The "markdown-to-ArgML compiler" item is removed from the Out-of-Scope list since it is now Phase 5. Test corpus and first-week task references updated accordingly.

**Changes from 0.2 (plan)**: After Phase 4 completed, the spec was extended to Working Draft 0.2 (new structural elements `<takeaways>`, `<provenance>`, `<argument>`; new attributes including `mode`, `same-as`, `pattern`; new `<reader-overlay>` document type; normative propagation semantics). Four intermediate phases (4.1, 4.2, 4.3, 4.4) are inserted between Phase 4 and Phase 5 to bring the implementation up to 0.2 before downstream work begins. The original Phases 5–8 are unchanged in number and content; their prompts, viewer, and resolver assume the 0.2 vocabulary.

## 0. Overview

### 0.1 Goal

Build a working reference implementation of ArgML 1.0 (Working Draft 0.1): a parser, validator, reference resolver, HTML renderer, and argument-graph visualizer. The implementation should be good enough to mark up a real LessWrong post end-to-end, render it back to readable HTML with structural annotations visible on hover, and produce a navigable argument-graph view that supports double-crux-style exploration ("if I reject this claim, what else falls?").

This is a reference implementation, not a production system. Correctness against the spec and clarity of the codebase take priority over performance.

### 0.2 North Star

A reader can:

1. Open a rendered ArgML post in a browser.
2. Hover over any tagged term to see its gloss and canonical reference.
3. Click any tagged claim to see its supports, attackers, and dependencies.
4. View the document's full argument graph as a navigable diagram.
5. Toggle "if I rejected this claim/assumption" to see downstream highlighting.

### 0.3 Out of Scope for v1

- LessWrong/Substack platform integration (depends on third parties; speculative).
- A fully-featured structural authoring editor (deferred to Phase 8 and beyond).
- Bayesian network propagation of credences (explicitly excluded by the spec).
- Cross-document corpus-wide analytics (Phase 7 lays groundwork; v2 territory).
- A fully-autonomous markdown-to-ArgML pipeline. LLM-assisted conversion (Phase 5) always produces a draft for human review, not a finished artifact.

### 0.4 Spec Conformance Discipline

The spec at `./spec/argml-spec.md` is the source of truth. When implementation and spec diverge, fix the spec or fix the implementation — but flag the divergence explicitly in a `SPEC-NOTES.md` file at the repo root. Do not silently drift.

---

## 1. Architecture and Tech Stack

### 1.1 Language and Runtime

**TypeScript on Node 22+**. Reasons: web-targetable (the eventual viewer runs in a browser); strong typing helps a parser/AST codebase; good XML library ecosystem; Claude Code is fluent in it. Bun is acceptable as a runtime alternative but the canonical scripts target Node.

### 1.2 Key Dependency Choices

| Concern             | Choice                            | Rationale                                                                                                                                            |
| ------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| XML parsing         | `fast-xml-parser`                 | Maintained, modern, no DOM overhead, preserves attribute order optionally.                                                                           |
| Schema validation   | Hand-rolled validator (initially) | RelaxNG support in JS is poor; the schema is small enough to validate by AST walk. Migrate to `libxmljs2` if hand-rolled validator becomes unwieldy. |
| CLI scaffolding     | `commander`                       | Standard, light, well-typed.                                                                                                                         |
| HTML rendering      | Server-side templates + plain CSS | No framework needed at v1. Adopt React only if Phase 4 interactivity demands it.                                                                     |
| Graph visualization | `cytoscape.js`                    | Standard for argument-graph layouts; rich built-in layouts and styling.                                                                              |
| Testing             | `vitest`                          | Modern, TS-native, fast, sensible defaults.                                                                                                          |
| Package manager     | `pnpm`                            | Workspaces, fast, disk-efficient.                                                                                                                    |
| Linting             | `biome`                           | Single tool for format + lint; less config than ESLint + Prettier.                                                                                   |

### 1.3 Repository Layout

A single repository, optionally upgraded to a monorepo if the boundaries justify it. Start simple:

```
argml/
├── spec/
│   └── argml-spec.md
├── src/
│   ├── ast/             # Type definitions for the ArgML AST
│   ├── parser/          # XML → AST
│   ├── validator/       # AST → validation diagnostics
│   ├── resolver/        # Reference resolution (intra- and inter-document)
│   ├── render/
│   │   ├── html.ts      # AST → HTML string
│   │   └── graph.ts     # AST → graph data (cytoscape JSON)
│   ├── cli/             # CLI entry points
│   └── index.ts
├── viewer/              # Web app for graph viewing (Phase 4)
├── examples/            # Sample .argml.xml documents
├── test/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── package.json
├── tsconfig.json
├── biome.json
└── README.md
```

If a monorepo turns out to be wanted (e.g., the viewer becomes large), promote `src/` to `packages/core/` and `viewer/` to `packages/viewer/` at that point. Don't pre-optimize.

---

## 2. Phased Plan

Each phase has a goal, deliverables, acceptance criteria, and explicit dependencies on earlier phases. Phases are intended to be executed in order; within a phase, tasks may be parallelizable.

### Phase 0: Project Scaffolding

**Goal**: A working dev environment.

**Tasks**:

1. Initialize repository with pnpm, TypeScript, Vitest, Biome.
2. Set up CI (GitHub Actions): typecheck, lint, test on push.
3. Add the spec file to `./spec/`.
4. Write a minimal README pointing at the spec and stating project intent.
5. Create a `SPEC-NOTES.md` for tracking implementation/spec divergences.

**Acceptance criteria**:

- `pnpm install && pnpm test` succeeds on a clean clone (with no tests yet, but the harness runs).
- `pnpm typecheck` and `pnpm lint` both pass.
- CI runs on PRs.

---

### Phase 1: Core Data Model and Parser

**Goal**: Parse a conformant ArgML document into a typed AST.

**Tasks**:

1. Define TypeScript types for the ArgML AST in `src/ast/`. Each element in Section 7 of the spec gets a corresponding interface. Use discriminated unions on a `kind` field for inline elements (`{ kind: 'term-ref' } | { kind: 'claim' } | …`).
2. Define a separate type for the _parse result_ including source-position metadata (line, column ranges) on every node — needed for diagnostics later.
3. Implement `parseArgML(xml: string): ParseResult` in `src/parser/`. Use `fast-xml-parser` with attribute preservation enabled. Map XML elements to AST nodes; reject elements not in the `urn:argml:v1` namespace.
4. Handle whitespace correctly: prose-bearing elements (`<p>`, `<claim>`, `<term>` reference form, `<gloss>`, `<inference>` warrant) preserve internal whitespace; structural elements ignore it.
5. Distinguish declaration-form `<term>` (in `<terms>`) from reference-form `<term>` (in `<body>`) at parse time, since they have different content models. Emit distinct AST node kinds.

**Acceptance criteria**:

- A unit test parses each example in `examples/` and produces a non-empty AST.
- A round-trip test: parse, walk the AST, reconstruct an equivalent (not necessarily byte-identical) XML string, re-parse, get an equivalent AST. Equivalence is structural, not textual.
- Source positions on AST nodes correctly point back to the source XML for at least claim, term, inference, and conflict nodes.

**Deliverable**: A library function `parseArgML` that produces a typed AST, plus accompanying types in `src/ast/`.

---

### Phase 2: Validation

**Goal**: Detect every constraint violation described in the spec, with actionable diagnostics.

**Tasks**:

1. Implement `validate(ast: ArgMLDocument): Diagnostic[]` in `src/validator/`. Each diagnostic includes severity (`error` | `warning`), source position, a message, and a stable code (e.g. `ARGML001`).
2. Implement structural checks: required elements present, content models obeyed, attribute types correct (e.g., `defeasible` is `"true"` | `"false"`; `credence` is a bucket or a decimal in [0,1]).
3. Implement identifier checks: every `id` unique within the document; every local reference (`ref`, `supports`, `attacks`, `rests-on`, `via`, `from`, `to`, `idref`) resolves to a declared identifier.
4. Implement spec-specific constraints:
   - Every alias declared on a term must be a non-empty string.
   - `strength="deductive"` implies `defeasible="false"` (warning if both are set inconsistently).
   - `attack-type="undercut"` requires the targeted inference to be `defeasible="true"` (warning).
   - Numeric `credence` and `strength` values outside [0, 1] are errors.
   - Numeric credence with more than 2 decimal places emits a "spurious-precision" warning per spec §12.2.
5. Cross-document references (`prefix:id`) are _not_ resolved at this phase — they pass structural validation if the prefix is declared in `<imports>`. Actual resolution is Phase 5.

**Acceptance criteria**:

- A "golden bad documents" fixture set: each fixture is a deliberately-invalid ArgML document accompanied by the expected diagnostic codes. The validator must match.
- All examples in `examples/` validate clean.
- Every diagnostic has a unique code documented in `SPEC-NOTES.md`.

**Deliverable**: `validate` function plus a fixture-driven test suite.

---

### Phase 3: CLI Tool

**Goal**: A usable command-line tool for working with ArgML documents.

**Tasks**:

1. `argml validate <file>` — runs the validator, prints diagnostics in a clean format (file:line:col: severity code message). Exits non-zero if any errors.
2. `argml summary <file>` — prints a structural summary: term count, claim count, inference count, conflict count, assumption count, plus a list of unresolved cross-document references.
3. `argml deps <file> --target <id>` — given a claim or assumption id, prints the transitive dependency tree (everything `<target>` rests on, supports, or is supported by). ASCII tree output.
4. `argml graph <file> [--format json|dot]` — emits the argument graph for downstream tooling.
5. `argml render <file> [--output <html>]` — placeholder for Phase 4; wired but emits a stub for now.

**Acceptance criteria**:

- Running each subcommand against `examples/morality-without-consciousness.argml.xml` produces sensible output.
- `argml validate` exits 0 on valid files, non-zero on invalid.
- The CLI is wired into `package.json` `bin` so `pnpm link --global` makes `argml` available system-wide.

**Deliverable**: A working CLI binary.

---

### Phase 4: HTML Renderer

**Goal**: Convert an ArgML document into readable HTML with structural annotations visible on hover and credence/strength visually indicated.

**Tasks**:

1. Implement `renderHTML(ast: ArgMLDocument): string` in `src/render/html.ts`. Output a complete HTML document with embedded CSS (no external dependencies at v1; can be split later).
2. Prose flows naturally; markup is invisible by default.
3. Hover over a `<term>` reference: tooltip showing the term's gloss, canonical reference, and any declared aliases.
4. Hover over a `<claim>`: tooltip showing the claim id, what it supports/attacks/rests-on, credence (if marked), and "via" inference.
5. Hover over an `<inference>` warrant: tooltip showing premises (`from`), conclusion (`to`), scheme, defeasibility, and strength.
6. Visual encoding:
   - Terms get a subtle dotted underline.
   - Claims get a numbered margin marker (`C1.1`, `C3`).
   - Credence buckets render as a small badge (`speculative`, `tentative`, etc.); numeric credences as `0.7`.
   - Defeasible inferences render warrants with a left border; strict inferences get a distinct style.
   - Assumptions referenced via `rests-on` get a margin indicator on the claim.
7. The document-level `<epistemic-status>` renders as a styled banner at the top of the post.
8. Generate a CSS file (or inline `<style>` block) using a minimal palette: terms in one accent color, claims in another, inferences in a third. Ensure adequate contrast in both light and dark mode.

**Acceptance criteria**:

- Rendering `examples/morality-without-consciousness.argml.xml` produces HTML that renders cleanly in Chrome and Firefox.
- Hovering over each markup type produces the expected tooltip.
- The HTML validates as HTML5.
- The rendered output is readable as prose when CSS is disabled (i.e., markup is non-destructive).

**Deliverable**: `renderHTML` function plus a `examples/rendered/` directory of rendered example outputs (regenerated by `pnpm render-examples`).

---

## Intermediate Phases 4.1–4.4: ArgML 0.2 Upgrade

After Phase 4 completed, the spec was extended to Working Draft 0.2. Four intermediate phases bring the implementation up to 0.2 before continuing with the original Phase 5. The full plan lives at `~/.claude/plans/i-have-drafted-a-fizzy-rocket.md` (or the active plan file referenced from there) and is summarized below.

### Phase 4.1: Spec Ratification (WD 0.2)

**Goal**: Promote `docs/project/argml-spec-0.2-updates.md` into `spec/argml-spec.md` as authoritative WD 0.2; archive the proposal; bump versions across project docs.

**Tasks**: integrate the proposal into the spec with the agreed section structure (new §§5.2, 5.6, 6.7–6.10, 10.2, 13; merged §§7, 8 reference tables; appended §14 Lineage; merged §15 References; merged Appendix A schema; replaced Appendix B). Move the proposal to `docs/project/historical/argml-spec-0.2-proposal.md`. Update CLAUDE.md, CHANGELOG.md, SPEC-NOTES.md (reserved diagnostic-code ranges).

**Acceptance**: spec internally consistent (every element/attribute referenced in §§4–6 has a §7/§8 entry); no code changes; existing test suite remains green.

### Phase 4.2: Post-Document 0.2 Extensions

**Goal**: Implement everything inside `<post>` end-to-end (parse → validate → render → CLI).

**Tasks**: extend AST (`ClaimNode.mode/attributedTo/sameAs/source/provenance`; `InferenceNode.pattern/provenance`; `provenance` on conflict/term-decl/assumption; new `GeneratorNode`, `ProvenanceNode`, `TakeawayNode`, `TakeawaysNode`, `ArgumentNode`); extend `HeadNode` with optional `provenance` and `takeaways`; extend `BlockOrInline` with `ArgumentNode`. Extend the parser (new `buildProvenance`, `buildGenerator`, `buildTakeaways`, `buildTakeaway`, `buildArgument`; new attribute parsing on existing builders; new `PARSE010`–`PARSE013` diagnostics). Extend the validator with `ARGML017`–`ARGML030` covering: unknown mode/argument-mode/pattern (warnings), `same-as` cycles and unresolved references, `mode="restated"` requires `same-as`, takeaway resolves to a claim, provenance ids resolve to generators, `<argument>` cannot carry `attacks`. Extend the HTML renderer with mode badges, argument blocks, takeaways banner, provenance markers, same-as ↔ links, pattern in inference tooltips, attribution. Extend CLI (`summary`, `graph`, `deps`, `walk`). Replace the worked example with the 0.2 form from spec Appendix B; regenerate `examples/rendered/`.

**Acceptance**: the 0.2 worked example parses, validates clean, renders with all new constructs visually represented, and round-trips. All new diagnostic codes have positive and negative test fixtures. 0.1-style claims (no mode) continue to validate as `asserted` (backwards compat).

### Phase 4.3: Reader-Overlay Document Type

**Goal**: Support `<reader-overlay>` as a second root document type.

**Tasks**: new AST file `src/ast/overlay.ts` (`ReaderOverlayDocument`, `AttitudeNode`, `SubstitutionNode`); top-level discriminated union `ParsedDocument = ArgMLDocument | ReaderOverlayDocument`. Parser dispatches on root element name; new `src/parser/overlay-builder.ts`; `PARSE014`–`PARSE016` diagnostics. New `src/validator/overlay.ts` with `OVERLAY001`–`OVERLAY008` (duplicate attitudes, missing rejection-type, undeclared prefixes, etc.). CLI: existing `validate` and `summary` dispatch on root; new `argml overlay show <file>` subcommand. Add `examples/morality-without-consciousness.overlay.xml` from spec Appendix B.2.

**Acceptance**: the Appendix B.2 overlay parses and validates clean. All `OVERLAY00x` codes have positive and negative test fixtures.

### Phase 4.4: Local Propagation Engine

**Goal**: Implement spec §13.5 (the renumbered §7.5 from the proposal) — the four-status propagation classification (`endorsed` / `supported` / `provisional` / `blocked`).

**Tasks**: new `src/propagation/` module (`equivalence.ts` for `same-as` classes, `graph.ts` for the normalised DAG, `propagate.ts` as entry point with `PropagationResult`). Algorithm: backwards DFS over `supports`, `rests-on`, `via`, inference `from`, with arguments-as-nodes; mode-aware filtering (rejected `anticipated-objection` / `reductio-target` / `attributed` / `conceded` do not block; rejected `<inference>` breaks support through that inference; rejected `<argument>` breaks support to its target). Status assignment: `blocked` if any blocking rejection sits on every path to T; `provisional` if no rejection but at least one `open` ancestor; `supported` otherwise; `endorsed` if T itself has an `accept` attitude. New CLI `argml propagate <post> --overlay <overlay>`; extend `argml validate` to accept `--overlay` for cross-pair checking.

**Acceptance**: integration test against spec Appendix B.1 + B.2 produces the expected table (`C6.7: provisional`, `C4.9: provisional`, `C3.6: blocked`). Property tests confirm monotonicity (a `reject` never upgrades; an `accept` never downgrades).

---

### Phase 5: LLM-Assisted Markdown-to-ArgML Conversion

**Goal**: Given a Markdown document, produce a valid ArgML draft via the Anthropic API, suitable for human review and refinement. This is the unlock that makes the format usable at all — hand-marking is too high-friction to drive adoption, and a well-prompted LLM can produce a competent first pass.

**Design principles**:

- The LLM produces a _draft_, never a finished artifact. The human author always reviews.
- The LLM should err on the side of marking less rather than more. Over-marking creates noise; under-marking is easy to fix by hand.
- The conversion is _not_ a translation. Markdown prose carries over into the ArgML body verbatim; the LLM's job is to _annotate_, not rewrite.

**Tasks**:

1. **Prompt design** (`src/llm/prompts/`). Build the conversion prompt in three layers:
   - **System prompt**: a distilled version of the ArgML spec, focused on Sections 5 (Head), 6 (Body), and 12 (Epistemic Markers). Include explicit guidance on what to mark and what to leave unmarked.
   - **Few-shot examples**: two or three worked conversions of short Markdown passages into ArgML. Hand-author these against the test corpus.
   - **User prompt**: the input Markdown plus an optional `--style` hint (`minimal` | `standard` | `aggressive`) controlling marking density.

2. **Anthropic API client** (`src/llm/client.ts`). Use `@anthropic-ai/sdk`. Default model `claude-sonnet-4-6`; allow override to `claude-opus-4-7` for higher-quality conversion of difficult posts. Stream the response. Implement standard retry-on-overload with exponential backoff.

3. **Multi-pass strategy**. A single-pass conversion is brittle for non-trivial posts. Implement two passes:
   - **Pass 1: Concept extraction**. Read the entire Markdown; identify recurring terms, propose canonical references (default to SEP for philosophy, Wikipedia/Wiktionary otherwise), propose assumptions the author treats as foundational. Output: a draft `<head>` block.
   - **Pass 2: Inline annotation**. Given the `<head>` from Pass 1 plus the Markdown body, produce the `<body>` with inline `<term>`, `<claim>`, `<inference>`, and `<conflict>` markup. The Pass 2 prompt includes the term declarations so the LLM can reference them by id consistently.

   A `--single-pass` flag SHOULD also be supported for fast iteration during development.

4. **Validation loop**. Pipe the LLM output through the Phase 2 validator. If errors are present, optionally re-prompt the LLM with the diagnostics for self-correction, up to a configurable max-retries (default 2). After max retries, emit the best-available output with diagnostics attached so the human can fix manually.

5. **Calibration guidance in the prompt**. For credence and strength markers, include explicit guidance: map hedging language to buckets (`"I suspect"` → `speculative`; `"I think"` → `tentative` or `considered`; `"I will defend"` → `confident`; `"clearly"`, `"obviously"` → `near-certain`). For strength: map inference cue words similarly (`"because"`, `"since"` → `moderate`; `"this means that"` → `strong`; `"this entails"` → `deductive`, with `defeasible="false"`).

6. **Conservatism guardrails**. The prompt explicitly instructs:
   - Do not mark a term unless it appears more than once OR has a technical sense in the document.
   - Do not mark a claim unless the author argues for it OR uses it as a premise.
   - Do not assert a credence if the author does not signal one; leave the attribute off.
   - Do not invent canonical URLs; if uncertain, use `scope="local"` with a `<gloss>` derived from the text and leave `canonical` unset.

7. **CLI integration**: `argml convert <markdown-file> [--model sonnet|opus] [--style minimal|standard|aggressive] [--single-pass] [--max-retries N] [--output <argml-file>]`.

8. **Cost and call logging**. Every API call logs input tokens, output tokens, model, and estimated cost to `~/.argml/usage.jsonl`. The CLI prints a one-line cost summary after each conversion.

9. **Response caching**. Cache the prompt + input → output mapping in `~/.argml/llm-cache/`, keyed by a hash of (prompt-version, model, input). Identical re-runs return cached output. Cache is opt-out via `--no-cache`.

10. **Side-by-side diff view** (CLI MVP). `argml convert ... --diff` prints the Markdown alongside the produced ArgML with markup color-highlighted in the terminal. This is the minimum review tool; a richer web-based diff is a Phase 8 candidate.

**Acceptance criteria**:

- Running `argml convert examples/morality-without-consciousness.md` produces a valid ArgML document (passes Phase 2 validation).
- The Pass 1 head block contains at least the terms `consciousness`, `physicalism`, and `preference`, with aliases capturing the surface forms used in the post (`phenomenal consciousness`, `qualia`, etc.).
- The Pass 2 body marks at least the major claims identified in the post's "Recap" section.
- A human-readable diff between the input Markdown and the output ArgML is producible via `--diff`.
- Cost per conversion of a typical 3000-word post is under USD 0.50 on Sonnet, under USD 2 on Opus.
- The conversion is non-destructive: stripping all ArgML tags from the output `<body>` reproduces the original Markdown prose (modulo paragraph wrapping).

**Deliverable**: A `convert` subcommand on the CLI, the prompts under version control in `src/llm/prompts/`, the API client and cache utilities in `src/llm/`, and a `examples/converted/` directory of LLM-produced ArgML for the test corpus.

**Risks**:

- **Prompt quality is the work**. The prompt will require multiple iterations against real posts. Budget significant time for prompt evaluation; do not consider Phase 5 complete after a single working version.
- **Hallucinated structure**. The LLM may mark relations the text does not actually support. The conservatism guardrails partially mitigate; the human review step is the real safety net.
- **Inconsistent identifiers across passes**. The Pass 2 prompt must include the Pass 1 head verbatim and instruct the LLM to use only declared term ids. A validation check after Pass 2 catches any reference to undeclared ids and re-prompts.
- **Long posts**. Input tokens scale with post length; very long posts (10k+ words) may need chunked processing. Defer chunking until needed — most LessWrong posts fit comfortably.
- **Model drift**. Newer model versions may behave differently against the same prompt. Pin the model version in the cache key; record the model version in the produced ArgML as an XML comment for provenance.

---

### Phase 6: Argument-Graph Export and Web Viewer

**Goal**: A browser-based view of the argument graph supporting double-crux exploration.

**Tasks**:

1. Implement `toGraphJSON(ast: ArgMLDocument): GraphData` in `src/render/graph.ts`. Output conforms to cytoscape.js's node/edge JSON format.
2. Node types: `claim`, `assumption`, `term`. Edge types: `supports`, `attacks` (with sub-type rebut/undermine/undercut), `rests-on`, `via-inference`. Edges carry the `defeasible` and `strength` properties from the source inference.
3. Build a small static web viewer in `viewer/`:
   - HTML page + cytoscape.js + a small vanilla TypeScript module.
   - File picker: load any local ArgML file or a URL.
   - Default layout: hierarchical (DAG-style) with assumptions at the bottom, conclusions at the top.
   - Click a claim node to highlight its direct neighbors and show its prose in a side panel.
   - Toggle: "Reject this claim" — recursively grey out everything that transitively depends on it.
   - Filter: show only claims above a credence threshold, or only defeasible inferences.
4. Build the viewer as a static bundle (esbuild or vite) deployable to any static host.

**Acceptance criteria**:

- Loading `examples/morality-without-consciousness.argml.xml` in the viewer displays a connected graph with all claims, inferences, and conflicts.
- The "reject this claim" toggle correctly identifies the downstream subgraph.
- Side panel shows claim text including inline `<term>` highlights.
- The viewer runs offline (no external CDN dependencies at runtime).

**Deliverable**: A static web viewer in `viewer/dist/` plus the `toGraphJSON` library function.

---

### Phase 7: Cross-Document Import Resolution

**Goal**: Resolve `prefix:id` references against external ArgML documents.

**Tasks**:

1. Implement `Resolver` class in `src/resolver/` with methods: `resolve(ref: string): Promise<ResolvedReference | UnresolvedReference>`.
2. Honor `<import>` declarations: fetch the imported document via HTTP (with a `--allowed-hosts` CLI flag for safety), parse it, and index its identifiers.
3. Implement caching: imported documents stored under `~/.argml/cache/` keyed by URL + ETag. Configurable cache directory.
4. Handle failure modes gracefully: network failure, malformed import target, missing identifier in imported document. Each produces a specific diagnostic, not a crash.
5. Optional: transitive resolution up to a configurable depth (spec §9.3 makes this optional; implement with default depth 1).
6. Extend the validator: with the resolver enabled, unresolved cross-document references become warnings (not errors); fully resolvable references become silent.
7. Extend the HTML renderer: cross-document references render with a small icon indicating "external"; hover shows the imported document title and the referenced identifier's text.
8. Extend the viewer: imported claims/assumptions appear as distinct (e.g., dashed-border) nodes in the graph with a click-through to the source document.

**Acceptance criteria**:

- An integration test marks up a small ArgML document that imports from another small ArgML document; the resolver correctly fetches and resolves references.
- Cache invalidation works: change the source, get a fresh fetch.
- Offline mode (no network) falls back to cache without throwing.

**Deliverable**: A working resolver plus integration tests using a local HTTP fixture server.

---

### Phase 8: Structural Authoring Tooling (Deferred)

**Goal**: Reduce the cost of producing and refining ArgML markup beyond what the LLM conversion of Phase 5 provides.

This phase is deliberately deferred. Phase 5 makes the format approachable from MVP onward; this phase tackles the _editing_ experience — what a writer does to polish, correct, or extend an LLM-produced draft. Possible directions: a VS Code extension with autocomplete against declared terms and imported documents; a structural editor in the web viewer with click-to-mark interactions; a richer side-by-side review UI for Phase 5 output. **Do not start this phase until Phases 0–7 are complete and the LLM-assisted pipeline has been used to convert at least three real LessWrong posts.**

---

## 3. Testing Strategy

### 3.1 Unit Tests

Each module (`parser`, `validator`, `resolver`, `render/html`, `render/graph`) has a co-located test file. Coverage target: 80% on `src/`, enforced in CI.

### 3.2 Fixture-Based Tests

A `test/fixtures/` directory contains:

- `valid/` — documents that should validate clean.
- `invalid/` — documents paired with expected diagnostic codes (one `.argml.xml` plus one `.expected.json`).
- `render-golden/` — input ArgML plus expected HTML output, compared structurally (not byte-identical, to allow safe formatting changes).

### 3.3 Integration Tests

End-to-end pipeline: parse → validate → resolve → render. Run against the example corpus. A test fails if any stage errors or if the rendered output regresses structurally.

### 3.4 Test Corpus

Build the test corpus in two stages, mirroring the real intended workflow:

**Stage 1 (during Phases 1–4)**: Hand-mark short fragments of the following documents for unit and integration testing. Hand-marking exposes spec ambiguities that synthetic fixtures hide.

**Stage 2 (during Phase 5)**: Run the LLM conversion against the full Markdown source of each document; review and correct the output. The corrected output becomes the canonical test fixture from that point forward.

The three test documents:

1. **`morality-without-consciousness`** — Ian's own LessWrong post. Primary test fixture. A Markdown source will be provided.
2. **`the-fourth-world`** — the post being responded to. Required for testing cross-document imports in Phase 7.
3. **A short Sequences post on physicalism** — for testing the canonical-reference layer (the post becomes a target that other documents import from).

Reviewing the LLM-converted output of these documents also serves as the primary evaluation signal for the Phase 5 prompt. Track edit distance between the LLM output and the human-corrected version as a quality metric; iterate the prompt until edit distance is small for at least the first two documents.

---

## 4. Risks and Open Questions

### 4.1 Schema validation approach

The spec ships a RELAX NG Compact schema as informative-only. JS-land RelaxNG support is weak (`libxmljs2` works but requires native compilation). The plan is to hand-roll the validator initially. **Risk**: as the spec evolves, keeping the hand-rolled validator in sync with the prose becomes a maintenance burden. **Mitigation**: keep the validator's structural-check logic close to the spec's element reference table, with each constraint linked back to the spec section number in a comment.

### 4.2 Import resolution security

Fetching arbitrary URLs on behalf of a document is a security surface. **Mitigation**: default to `--allowed-hosts` requiring explicit user opt-in; never auto-fetch in the renderer by default; in the viewer, fetch only via the user's browser (same-origin policy applies).

### 4.3 The bootstrap problem

ArgML is only useful at scale once a non-trivial corpus exists. The first dozen documents have to be marked up by hand, which is slow. **Mitigation**: in parallel with implementation, mark up the three test-corpus documents — this both validates the spec and seeds the corpus. Do not attempt to mark up dozens before the tooling is good enough to make it bearable.

### 4.4 Spec drift

Implementation will surface ambiguities that the spec didn't anticipate. **Mitigation**: every such case is logged in `SPEC-NOTES.md` with a proposed spec amendment; resolve to one of (a) fix the implementation, (b) fix the spec, (c) explicitly leave underspecified pending real use cases.

### 4.5 LLM conversion quality

Phase 5 is the adoption-critical path, and prompt quality is the bottleneck. The LLM may over-mark, under-mark, hallucinate inference relations, propose wrong canonical references, or assert credences the text does not support. **Mitigations**: the conservatism guardrails baked into the prompt; the always-required human review step; tracking edit distance between LLM output and human-corrected output as a quality metric across prompt iterations; pinning model versions in the cache key so prompt evaluation is reproducible. **Acceptance bar**: Phase 5 is not "done" after the first working prompt — only after the LLM output for at least two of the three test-corpus documents requires minimal human correction.

### 4.6 LLM cost at scale

API costs scale with input length and call volume. The two-pass strategy doubles the input tokens. **Mitigations**: response caching (identical inputs are free on re-run); a `--single-pass` flag for fast iteration; default to Sonnet rather than Opus; document expected per-conversion costs in the README so users are not surprised. At scale (hundreds of conversions), this becomes a real cost; out of scope for v1.

### 4.7 Performance

A graph view of a heavily-marked-up document may have hundreds of nodes. cytoscape.js handles this fine, but layout may be slow. **Mitigation**: not a v1 concern. Profile only if the example corpus produces noticeably slow renders.

---

## 5. First-Week Tasks

The following are concrete starting tasks that can be executed without further planning. They should produce a usable Phase 0 + early Phase 1 within five working days.

1. **Day 1**: Repo scaffolding. Initialize pnpm, TypeScript, Vitest, Biome, GitHub Actions. Stub `package.json` with workspace name `argml`. Commit the spec to `./spec/`. Write a one-paragraph README. **Acceptance**: `pnpm install && pnpm test && pnpm typecheck && pnpm lint` all pass on a fresh clone; CI runs and is green.

2. **Day 2**: AST type definitions in `src/ast/`. Every element from Section 7 of the spec gets an interface. Discriminated unions for inline body elements. **Acceptance**: Each AST type is reachable from a single `ArgMLDocument` type and the file compiles with no `any` types.

3. **Day 3**: Parser skeleton in `src/parser/`. Wire `fast-xml-parser`. Implement just enough of the parser to handle `<post>`, `<head>`, `<metadata>`, `<body>`, and one `<p>` containing plain text. **Acceptance**: A minimal example doc parses to the expected AST shape; a unit test asserts this.

4. **Day 4**: Extend the parser to handle `<terms>` declarations, `<assumptions>`, and inline `<term ref="…">`. **Acceptance**: A document with three terms, two assumptions, and three term references parses correctly; test asserts identifier resolution within the AST (without yet validating reference targets).

5. **Day 5**: Extend the parser to handle `<claim>`, `<inference>`, and `<conflict>`. Begin the validator: implement just the "every id is unique" and "every intra-document reference resolves" checks. Start the example corpus by hand-marking the opening sections of "Morality without Consciousness". **Acceptance**: The partial example parses and validates clean; introducing a duplicate id produces the expected diagnostic.

By end of week one, the project has: scaffolding, CI, AST types, a parser that handles all the major elements, the start of a validator, and the start of a hand-marked example corpus. This is roughly Phases 0 plus 60% of Phase 1.

---

## 6. Communication and Decision Recording

Each phase's completion produces:

- A PR with the phase's deliverables and tests.
- A `CHANGELOG.md` entry summarizing what was added.
- A `SPEC-NOTES.md` entry for every spec ambiguity surfaced during the phase.

Substantive design decisions made during implementation (e.g., a chosen approach to handling whitespace in mixed-content elements) are recorded as architecture decision records in `docs/adr/NNNN-title.md` using the standard ADR template.

When in doubt, prefer:

1. Conformance to the spec over convenience.
2. Clear diagnostics over silent acceptance.
3. Small, readable code over clever code.
4. Working software over comprehensive features.

Ask for clarification rather than guessing on any of: spec ambiguities affecting multiple phases, security-sensitive design choices (especially around import fetching), or scope expansions beyond what this plan describes.

---

_End of ArgML Implementation Project Plan._
