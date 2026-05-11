# SPEC-NOTES

Log of implementation/spec divergences and the index of diagnostic codes emitted by the validator.

The spec at [`spec/argml-spec.md`](./spec/argml-spec.md) is the source of truth. When implementation and spec diverge, log it here with a proposed resolution: (a) fix the implementation, (b) fix the spec, or (c) leave underspecified pending real use cases.

## Divergences

### Presentational inline tags are flattened, not preserved

Spec §`<body>` permits `<em>`, `<strong>`, `<code>`, `<a>` "as presentational"
markup that the ArgML semantics layer ignores. The parser implements this by
recursing into such elements and inlining their children as if the wrapper
were absent — no AST node is produced for the wrapper and no `PARSE005`
warning is emitted. Resolution: (a) fix the implementation, done. A future
revision may introduce an AST node so renderers can preserve emphasis.

## Diagnostic codes

Stable codes (`ARGML001`, `ARGML002`, …) emitted by the validator. Each code has a fixed meaning across releases.

Phase 1 parse-stage diagnostics (`PARSE…`) are listed below; Phase 2 will introduce the `ARGML…` validation codes.

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
