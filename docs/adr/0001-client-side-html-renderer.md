# ADR 0001: Client-side HTML renderer

- **Status**: Accepted
- **Date**: 2026-05-12
- **Phase**: 4 (HTML renderer)

## Context

`docs/Project.md` originally specified Phase 4 as "Server-side templates + plain CSS" producing HTML whose prose remains readable when CSS (and JavaScript) is disabled. The first ArgML document with marked-up structure made it clear that the interactive surface area is large:

- Inline hover tooltips on terms, claims, inferences, evidence, and notes
- A right-gutter marginalia view of every annotated element, with overflow handling and "show more" expansion
- SVG arrows connecting related claims when the gutter is visible
- A left-gutter argument-graph view with hover-to-highlight and click-to-scroll
- A toolbar to toggle frontmatter / annotations / graph modes

Implementing all of this as pure CSS hover + server-rendered DOM is possible in principle but in practice requires either (a) duplicating every relation as static markup with `:hover` selectors and pre-computed positions, which scales poorly and breaks on any reflow, or (b) accepting that the gutter / graph / arrows are inherently interactive and will need a runtime.

## Decision

`renderHTML` emits a thin HTML5 shell:

- inline `<style>` containing the bundled stylesheet,
- `<script id="argml-source" type="application/xml">` containing the verbatim source XML,
- `<div id="root">` mount point,
- inline `<script>` containing the bundled client renderer (compiled from `src/render/assets/arg-render.ts`).

The client renderer parses the embedded XML via `DOMParser`, walks the tree, and renders the visible document into `#root`. All hover / click / layout logic runs in the browser.

## Consequences

**Positive**

- The interactive surface area (tooltips, gutter, arrows, graph, toolbar) is implemented once in TypeScript with the same strictness rules as the rest of the codebase.
- The HTML output is a single file with no external assets — copies cleanly to email, archive sites, etc.
- The same TypeScript code is reused for the Phase 6 graph viewer.

**Negative — accepted, with mitigations**

- **No-JS readers see a blank shell.** The original "readable when CSS disabled" criterion is violated. Mitigation: tracked as a follow-up to emit a static prose fallback inside `<div id="root">` that the client renderer overwrites on mount. This is bounded work — the same `arg-render-core.ts` pure helpers can run server-side. Until then the SPEC-NOTES entry is the public record.
- **Screen readers / search indexers see only the embedded XML.** Same mitigation path.
- **Two render paths to keep aligned** once a server-side fallback lands. Mitigation: pure-helper extraction (`arg-render-core.ts`) means both paths share their tree-walk logic.

## Alternatives considered

1. **Pure server-side rendering with CSS-only tooltips.** Rejected — the right-gutter overflow handling, SVG arrows, and graph view cannot be expressed in CSS alone, and degrading them away from the v1 design was judged a worse user experience than requiring JavaScript.
2. **Server-side render + JS enhancement (progressive enhancement).** This is the future-state we plan to reach. Rejected for v1 because it doubles the implementation cost in Phase 4 (two render paths from the start). The cost is recoverable later because the pure helpers in `arg-render-core.ts` are render-agnostic.
3. **A framework (React / Preact / lit).** Rejected — overkill for a single, self-contained document renderer, and would bloat the inline `<script>`.

## Revisit triggers

- A user request to render ArgML documents in a no-JS environment (RSS readers, email, archive.org snapshots).
- Phase 6 (graph viewer) or Phase 7 (cross-document references) producing a refactor that touches the same render code — at that point, fold in the progressive-enhancement work.
