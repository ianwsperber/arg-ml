# ADR 0002 — LLM-assisted Markdown-to-ArgML conversion pipeline

Status: Accepted (Phase 5)
Date: 2026-05-12

## Context

Hand-marking ArgML is too high-friction to bootstrap a corpus. Phase 5 of `PLAN.md` makes the format approachable by adding a `convert` subcommand that takes a Markdown source (file or URL) and returns a validated ArgML draft for human review.

Three forces shaped the design:

1. **The LLM must annotate, not translate.** Prose is preserved verbatim; only ArgML structural elements are added. This is the user's hard requirement, and the project's adoption-critical guarantee — without it, "convert" becomes "rewrite", which is unsafe to publish.
2. **Prompt quality is the bottleneck, not architecture.** The scaffolding is comparatively easy; making the prompts produce conservative, accurate markup against real posts is the actual work. The system must be cheap to iterate on.
3. **URL ingestion is a high-leverage feature** because the canonical test corpus lives on LessWrong, and asking a user to paste 3k words of Markdown is enough friction to suppress adoption.

## Decision

### 1. Two-pass conversion (Pass 1 → Pass 2)

A single-pass prompt is brittle on non-trivial posts because the LLM has to simultaneously decide *what* to mark and *with which ids*. Splitting concept extraction (head) from inline annotation (body) lets the second pass operate against a stable identifier scheme.

- **Pass 1** reads the full Markdown and proposes `<head>`: terms, aliases, assumptions, imports, takeaways, provenance, epistemic-status.
- **Pass 2** receives the Pass-1 head verbatim plus the original Markdown and emits `<body>`, using only the term ids declared in the head.

A `--single-pass` flag exists for fast iteration during prompt development; it is not the production path.

### 2. Verbatim is enforced, not requested

A "please don't edit the prose" instruction in the system prompt is necessary but not sufficient. Every output is post-processed by `verbatimCheck(source, ast)`, which compares the source's readable text (after stripping markdown structural marks) against the body's stripped-tags text. Any token-level divergence is a hard failure — the pipeline triggers a repair pass, and if retries are exhausted, the document is written but the CLI exits non-zero and the unresolved diagnostics print to stderr.

This guarantee is the single most important property of the pipeline and is the reason the conversion can be trusted as a starting point rather than a destination.

### 3. URL ingestion: structured API first, readability fallback

For LessWrong (the primary corpus), the LW2 GraphQL endpoint returns the post's internal Markdown directly — strictly higher fidelity than scraping HTML. For other hosts, Mozilla Readability extracts the main article and Turndown converts to Markdown. The dispatcher picks LessWrong by host, falls back to readability if the API errors. URL ingestion requires an explicit `--allow-network` flag (security parity with the planned Phase 7 import resolver — fetching arbitrary URLs needs opt-in).

### 4. Disk-resident response cache

Identical conversion runs must be cheap. The cache key is `sha256(PROMPT_VERSION, step-tag, model, system, user)`. Bumping `PROMPT_VERSION` invalidates the cache wholesale, which is the right behaviour: a prompt edit produces different output, and stale cached responses would mask that. Cache lives at `~/.argml/llm-cache/` and is opt-out via `--no-cache`.

### 5. Eval-driven prompt iteration

Prompt iteration is impossible to track by eyeball alone. The eval framework runs the pipeline against `eval/gold/<slug>/{source.md, expected.argml.xml}` directories and computes:

- **Supervised**: `head.edit_distance` (normalised Levenshtein on serialised head tokens), `body.span_f1` (precision/recall/F1 on (element-kind, normalised-span-text) tuples).
- **Unsupervised**: `validator.pass`, `verbatim.pass`, structural counts, terms-per-1k-words and claims-per-1k-words as conservatism proxies, fraction of claims/inferences with credence/strength markers, hedge-language coverage.
- **Cost**: USD plus tokens.

Reports land in `eval/results/<run-id>.json`. The acceptance threshold for closing Phase 5 is: on the seed gold doc, `verbatim.pass = true`, `validator.pass = true`, `body.span_f1 ≥ 0.6`, `head.edit_distance ≤ 0.3`. These are guardrails; the real signal is iteration trends across prompt versions.

### 6. The system prompt and the in-chat skill share intent

`src/llm/prompts/system.ts` and `skills/argml-converter/SKILL.md` encode the same conservatism rules, calibration heuristics, vocabulary, and verbatim guarantee, on two different surfaces (CLI vs Claude chat). They are maintained in parallel: editing one without the other is a behavioural divergence that should be flagged in the CHANGELOG.

## Alternatives considered

- **Single combined prompt.** Rejected for the production path due to id-consistency failures across decisions-about-marking and decisions-about-references. Retained as `--single-pass` for development.
- **Generic HTML scraping for LessWrong.** Rejected — the GraphQL API returns the canonical Markdown the author wrote, with footnotes/math/code preserved. HTML scraping would strip the structure we care about.
- **In-memory cache only.** Rejected — eval iteration involves restarting the process repeatedly; disk cache is the only way to make re-runs cheap.
- **Auto-publishing converted output.** Categorically rejected. Every conversion is a draft. The CLI writes the file but flags errors prominently; the human is always in the loop.

## Consequences

- The pipeline can be exercised end-to-end in tests without an API key (`LLMClient` and `ResponseCache` are injectable; `runPipeline` accepts both).
- Adding a new gold fixture is purely mechanical (drop a directory under `eval/gold/`).
- Prompt edits *require* bumping `PROMPT_VERSION` to invalidate the cache; forgetting to bump will silently reuse stale outputs. A future tooling improvement could derive the version from a content hash of `src/llm/prompts/*`.
- The verbatim check normalises markdown structural marks. New markdown idioms we encounter in real posts may require widening the equivalence class; each widening should be tracked in `SPEC-NOTES.md`.
