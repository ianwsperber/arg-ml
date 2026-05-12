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
| `PARSE010` | warning | A `<head>` child appears out of spec order (metadata → provenance → imports → terms → assumptions → takeaways). Element is still parsed in place. |
| `PARSE011` | warning | `<argument>` is missing the required `mode` attribute. Stored with empty mode. |
| `PARSE012` | warning | `<takeaway>` is missing the required `ref` attribute. Stored with empty ref (which then triggers ARGML023 at validation). |
| `PARSE013` | warning | `<generator>` is missing the required `id` attribute. |
| `PARSE014` | error | `<reader-overlay>` is missing the required `reader` attribute. |
| `PARSE015` | error | `<attitude>` is missing `target`/`kind` or carries an unknown `kind` value. |
| `PARSE016` | error | `<substitution>` is missing `target` or `use`. |

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
| `ARGML017` | warning | Unknown `mode` value on `<claim>` (spec §6.7 lists the recommended vocabulary). |
| `ARGML018` | error | `mode="restated"` requires a `same-as` attribute (spec §6.10). |
| `ARGML019` | warning | `mode="reductio-target"` SHOULD be paired with `defeasible="false"` on the licensing inference. |
| `ARGML020` | warning | `mode="attributed"` SHOULD carry `attributed-to` (spec §6.9). |
| `ARGML021` | error | `<argument>` may not carry `attacks` or `attack-type` (spec §6.8.3). The parser records disallowed attribute names on `ArgumentNode.disallowedAttrs`; the validator emits this code when that list is non-empty. |
| `ARGML022` | warning | Unknown `pattern` value on `<inference>` (spec §10.2 lists the recommended vocabulary). |
| `ARGML023` | error | `<takeaway ref=…>` must resolve to a local `<claim>` (cross-doc refs disallowed). |
| `ARGML024` | warning | Duplicate `<takeaway>` for the same claim with the same priority. |
| `ARGML025` | error | `provenance=…` references a generator id that is not declared in `<provenance>`. |
| `ARGML026` | warning | `same-as=…` reference does not resolve (local id missing or undeclared cross-doc prefix). |
| `ARGML027` | warning | `same-as` cycle detected within the document. |
| `ARGML028` | warning | `<argument supports=…>` target must resolve to a `<claim>`. |
| `ARGML029` | warning | `<inference from=…>` references an `<argument>`; allowed only for `pattern="argument-by-cases"`. |
| `ARGML030` | warning | Unknown `mode` value on `<argument>` (spec §6.8.1 lists the recommended vocabulary). |

### Reader-overlay diagnostics (Phase 4.3)

Emitted by `validateOverlay` (`src/validator/overlay.ts`) on `<reader-overlay>` documents. The dispatching `validateAny` routes by `document.kind`.

| Code | Severity | Description |
| ---- | -------- | ----------- |
| `OVERLAY001` | error | Duplicate `<attitude>` targeting the same id. |
| `OVERLAY002` | error | `<attitude kind="reject">` is missing the required `rejection-type` attribute. |
| `OVERLAY003` | warning | `<attitude kind="accept">` (or `"open"`) carries a `rejection-type` (only meaningful on `reject`). |
| `OVERLAY004` | error | Attitude `target` uses an undeclared `<import prefix=…>`. |
| `OVERLAY005` | warning | Attitude `target` has no `prefix:` segment; overlay references should be cross-document (spec §13.3). |
| `OVERLAY006` | error | `<substitution>` `target` or `use` uses an undeclared import prefix. |
| `OVERLAY007` | warning | Same `target` is substituted by more than one `<substitution>`. |
| `OVERLAY008` | warning | Numeric `credence` on `<attitude>` is outside [0, 1] or carries more than two decimal places. |

Cross-document references (`prefix:id`) are only checked structurally for prefix-declaration here; actual resolution against the imported document is a Phase 7 concern.

## 0.2 Additions — Reserved Diagnostic Code Ranges

Working Draft 0.2 (ratified in Phase 4.1) introduces new structural and semantic constructs that will surface in Phases 4.2–4.4. The following ranges are reserved so phases can pick stable codes without renumbering:

| Range | Owner | Notes |
| ----- | ----- | ----- |
| `PARSE010`–`PARSE013` | Phase 4.2 | Parse-stage diagnostics for new head ordering and missing required attributes on `<argument>`/`<takeaway>`/`<generator>`. |
| `PARSE014`–`PARSE016` | Phase 4.3 | Parse-stage diagnostics for the `<reader-overlay>` root and its `<attitude>`/`<substitution>` children. |
| `ARGML017`–`ARGML030` | Phase 4.2 | Validator diagnostics for `mode`, `<argument>`, `<takeaway>`, `<provenance>`/`<generator>`, `same-as`, `pattern`, and `attributed-to` attributes. (Range reserved through `ARGML040` for Phase 4.4.) |
| `OVERLAY001`–`OVERLAY008` | Phase 4.3 | Validator diagnostics for `<reader-overlay>` documents (attitudes, substitutions, `target` resolution). Range reserved through `OVERLAY010`. |

Codes outside these ranges remain free for unrelated work. Each phase MUST update the canonical tables above when it introduces a new code.
