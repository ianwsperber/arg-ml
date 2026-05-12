# SPEC-NOTES

Log of implementation/spec divergences and the index of diagnostic codes emitted by the validator.

The spec at [`spec/argml-spec.md`](./spec/argml-spec.md) is the source of truth. When implementation and spec diverge, log it here with a proposed resolution: (a) fix the implementation, (b) fix the spec, or (c) leave underspecified pending real use cases.

## Divergences

### Phase 4 HTML renderer is client-side, not server-side

Project.md §Tech Stack picks "Server-side templates + plain CSS", and Project.md §Phase 4 acceptance includes "rendered output is readable as prose when CSS is disabled (markup is non-destructive)". The implementation that shipped in Phase 4 instead embeds the source XML inside a `<script type="application/xml">` payload and renders it client-side via `src/render/assets/arg-render.ts`. With JavaScript disabled the page is a blank shell. Rationale, trade-offs, and the path back to progressive enhancement are recorded in [`docs/adr/0001-client-side-html-renderer.md`](./docs/adr/0001-client-side-html-renderer.md). Resolution: (c) accept the divergence for now; revisit when the LLM-conversion phase (5) and graph viewer (6) settle the desired interactive surface area. Project.md §Phase 4 was amended to match.

### Unresolved cross-document `term ref` rendered with external marker

Phase 7 will resolve `prefix:id` term references against imported documents.
Until then, the Phase 4 HTML renderer marks any `<term ref="prefix:id">` whose
prefix is declared but whose target cannot be looked up locally with the
`argml-external` class and a tooltip noting the import is not resolved. The
surface form is preserved verbatim. Resolution: (c) leave as-is until Phase 7
wires up real resolution.

### Presentational inline tags are flattened, not preserved

Spec §`<body>` permits `<em>`, `<strong>`, `<code>`, `<a>` "as presentational"
markup that the ArgML semantics layer ignores. The parser implements this by
recursing into such elements and inlining their children as if the wrapper
were absent — no AST node is produced for the wrapper and no `PARSE005`
warning is emitted. Resolution: (a) fix the implementation, done. A future
revision may introduce an AST node so renderers can preserve emphasis.

## Diagnostic codes

Stable codes emitted by the parser (`PARSE…`) and the validator (`ARGML…`). Each code has a fixed meaning across releases.

### Parse-stage diagnostics

| Code | Severity | Description |
| ---- | -------- | ----------- |
| `PARSE001` | error | Malformed XML (well-formedness failure or parser exception). Document is `null`. |
| `PARSE002` | error | Root `<post>` does not declare `xmlns="urn:argml:v1"`. Document is `null`. |
| `PARSE003` | error | Document root element is not `<post>`. Document is `null`. |
| `PARSE004` | error | `<post>` is missing a `<head>` or `<body>` child. Document is `null`. |
| `PARSE005` | warning | Unknown element encountered inside a recognized parent (e.g. inside `<head>`, `<term>`, or `<body>`). The element is dropped from the AST. |
| `PARSE006` | warning | `<head>` is missing a `<metadata>` child. An empty placeholder is substituted. |
| `PARSE007` | warning | Enum-typed attribute (`attack-type`, `defeasible`) has a value outside its allowed set. The attribute is treated as absent. |
| `PARSE008` | warning | `<heading level=…>` is not a valid integer. Defaults to 1. |
| `PARSE009` | warning | `<conflict>` is missing a required `<attacker>` or `<target>` child. Empty-`idref` placeholders are substituted. |

### Validator diagnostics

| Code | Severity | Description |
| ---- | -------- | ----------- |
| `ARGML001` | error | Duplicate `id` within document. |
| `ARGML002` | error | Unresolved local reference (intra-document id is not declared). |
| `ARGML003` | error | Cross-document reference `prefix:id` uses an undeclared `<import prefix=…>`. |
| `ARGML004` | error | `<inference>` has no `from` premises. |
| `ARGML005` | error | Numeric `credence` is outside the closed interval [0, 1]. |
| `ARGML006` | error | Numeric `strength` is outside the closed interval [0, 1]. |
| `ARGML007` | error | Empty `<alias>` text on a `<term>` declaration. |
| `ARGML008` | warning | Reference target kind mismatch: `rests-on` or inference `from` must resolve to a `<claim>` or `<assumption>`. |
| `ARGML009` | warning | `<inference to=…>` target must resolve to a `<claim>`. |
| `ARGML010` | warning | `<conflict>` `<attacker>` / `<target>` must resolve to a `<claim>` or `<inference>`. |
| `ARGML011` | warning | `strength="deductive"` is inconsistent with `defeasible="true"` (spec §10/§11 — deductive implies non-defeasible). |
| `ARGML012` | warning | `<conflict attack-type="undercut">` targets an `<inference>` whose `defeasible="false"` (only defeasible inferences can be undercut per spec §11). |
| `ARGML013` | warning | Numeric `credence` / `strength` carries more than two decimal places (spurious precision per spec §12.2). |
| `ARGML014` | warning | `<term ref=…>` does not resolve to a declared `<term>` in the document head (and is not a cross-document reference). |
| `ARGML015` | warning | `via=…` on a `<claim>` does not resolve to an `<inference>`. |
| `ARGML016` | warning | `supports` / `attacks` target must resolve to a `<claim>`. |

Cross-document references (`prefix:id`) are only checked structurally for prefix-declaration here; actual resolution against the imported document is a Phase 7 concern.
