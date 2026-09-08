# ArgML

Reference implementation of ArgML — an XML markup language that binds argumentative prose to a Bayesian belief network in the SBBN Workbench format, so that a claim's credence is a computed posterior rather than an author's assertion.

## What this repo is

The TypeScript reference implementation of ArgML. Two files are authoritative:

- `spec/argml-spec.md` — the format specification (currently Working Draft 0.3, namespace `urn:argml:v2`). Source of truth for syntax, semantics, and conformance. The previous draft, 0.2, is archived at `spec/historical/argml-spec-0.2.md`.
- `PLAN.md` — the implementation project plan (points at `docs/project/Project.md`, which is local and gitignored). Defines phases, deliverables, and acceptance criteria.

**Transition state.** The spec is 0.3 but the code in `src/` still implements 0.2. Phases 7–10 bring the code up to 0.3 (prune the 0.2 vocabulary; model layer; inference and diff; skill). Until Phase 7 lands, the CLI, tests, and `argml-converter` skill operate on 0.2 documents and the skill fetches the archived 0.2 spec. Check the latest `CHANGELOG.md` entry before assuming which vocabulary a module speaks.

Read the relevant sections of the spec and plan before making non-trivial changes. Don't load them into context preemptively — they are large.

## The 0.3 model in one paragraph

An essay plugs into one SBBN topic (`bn.xml`, augmented XMLBIF). Its head embeds a verbatim snapshot of the subgraph it argues over inside `<model topic="…"><BIF xmlns="">…</BIF></model>`. A `<claim node="…" state="…">` is a proposition whose credence is P(node = state | snapshot observations), computed by exact inference; a `<claim edge="parent child">` asserts a dependency the child's table encodes. Full CPTs are required. Edges keep SBBN's `relation` sign and the validator checks it against the table. There is no asserted credence, no support/attack graph, no reader overlay. See `docs/adr/0002-bayesian-semantics-over-sbbn.md` and `docs/adr/0003-out-of-process-inference.md`.

## Commands

- `pnpm install` — install dependencies
- `pnpm test` — run vitest
- `pnpm typecheck` — strict TypeScript checks
- `pnpm lint` — biome check (lint + format)
- `pnpm lint:fix` — biome with auto-fixes
- `pnpm build` — compile to `dist/`
- `pnpm render-examples` — regenerate `examples/rendered/` (0.2 renderer; removed in Phase 7)

Run `pnpm typecheck && pnpm test && pnpm lint` before every commit.

## Code conventions

- TypeScript with `strict: true`. No `any` — use `unknown` and narrow.
- Biome for both lint and format. Don't add ESLint or Prettier.
- Vitest for tests. Co-locate: `foo.ts` next to `foo.test.ts`.
- Named exports only. No default exports.
- Diagnostic codes are stable strings (`PARSE…`, `MODEL…`, `ARGML…`, `DIFF…`) and documented in `SPEC-NOTES.md`. Retired codes are never reused.
- Parser and validator return diagnostic arrays, never throw on user input. Internal bugs throw.

## Working with the spec

When implementation and spec diverge:

1. Log the divergence in `SPEC-NOTES.md` with a description and a proposed resolution.
2. Resolve to one of: (a) fix the implementation, (b) propose a spec amendment, (c) explicitly leave underspecified pending real use cases.
3. Never silently drift.

The SBBN Workbench specification (https://github.com/kristoforusbryant/sbbn-workbench, `docs/specs/v0.3-spec.md`) is authoritative for the network format inside `<model>`; ArgML's spec restates only what a processor must understand. When they disagree about the network format, SBBN wins and the divergence is logged.

Substantive design decisions get ADRs in `docs/adr/NNNN-title.md`.

## Phase discipline

Phases in `PLAN.md` proceed in order; Phase N depends on N-1's deliverables. Each phase ends with a PR containing tests, a CHANGELOG entry, and any SPEC-NOTES updates. Current phase status is the latest CHANGELOG entry.

The `argml-converter` skill is the adoption-critical path; treat its instruction files as production code (versioned, reviewed, evaluated against the worked example).

## Specific rules

- **Browser compatibility**: code in `src/` must run in both Node and browser unless explicitly marked Node-only. `src/cli/` is Node-only. Anything under `src/model/` (Phase 8) must stay browser-safe; `argml validate` must never need Python.
- **Python**: inference shells out to pgmpy via a script under `python/` (Phase 9). Locate the interpreter via `ARGML_PYTHON`, then `.venv/bin/python`, then `python3`, then `python`; mirror the child's exit code; batch all queries into one spawn. Tests that need pgmpy skip with a printed reason unless `ARGML_REQUIRE_PGMPY=1`. Never vendor code from the SBBN repo (it has no license); write fresh glue and credit SBBN as the reference design.
- **Snapshot fidelity**: the `<BIF>` subtree is copied verbatim. Export it by slicing the source text and removing only `xmlns=""`; never re-serialise it. The worked example's embedded snapshot must byte-match `examples/celebrity-smoking-status/bn.xml`.
- **Numbers**: never hand-estimate a posterior in docs, fixtures, or tests. Compute with pgmpy and record in `expected-posteriors.json`.
- **LLM output is a draft**: never auto-publish. Every conversion run produces a file the human reviews.
- **Imports in tests**: import from the package's public API, not internal paths. Internal refactors should not break tests.

## Don't do

- Don't add npm dependencies without justification in the PR description.
- Don't modify `spec/argml-spec.md` without bumping its version and recording the change in its Status section.
- Don't skip tests for new public functions.
- Don't use Node-only APIs (`fs`, `path`, `child_process`) outside `src/cli/` and scripts.
- Don't loosen `strict` or other TypeScript settings to make code compile. Fix the code.
- Don't invent nodes, edges, or CPT values in the converter skill. If the topic lacks a node for a sentence, leave the claim unbound and say so; new structure goes through SBBN's `bn-revise`.
- Don't touch the owner's untracked scratch files in the repo root (`wildfire-*`, `post-pr14-review.sh`).

## Useful files

- `spec/argml-spec.md` — the format specification (WD 0.3)
- `spec/historical/argml-spec-0.2.md` — the previous draft the current code implements
- `PLAN.md` — pointer to the implementation plan
- `SPEC-NOTES.md` — log of implementation/spec divergences and the diagnostic-code tables
- `CHANGELOG.md` — phase completion log
- `docs/adr/` — architecture decision records
- `examples/celebrity-smoking-status/` — the 0.3 worked example (essay, ArgML document, topic `bn.xml`, drifted variant, expected posteriors)
- `examples/*.argml.xml`, `examples/rendered/` — 0.2 examples and rendered output (moved to `examples/historical/` in Phase 7)

When asked about an ArgML element, attribute, or constraint, read the relevant section of `spec/argml-spec.md` first rather than answering from memory.
