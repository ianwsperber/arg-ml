# SPEC-NOTES

Log of implementation/spec divergences and the index of diagnostic codes emitted by the validator.

The spec at [`spec/argml-spec.md`](./spec/argml-spec.md) is the source of truth. When implementation and spec diverge, log it here with a proposed resolution: (a) fix the implementation, (b) fix the spec, or (c) leave underspecified pending real use cases.

## Divergences

_None yet._

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
