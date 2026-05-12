# ArgML

**ArgML** is an XML markup language for inline annotation of argumentative prose — designed to make the structure of philosophical and rationalist essays explicit enough to support double-cruxing, dependency tracing, and automated argument-graph analysis.

This repository is the TypeScript reference implementation of **ArgML 1.0**: parser, validator, CLI, and (in progress) HTML renderer and argument-graph visualizer.

> Status: **pre-alpha**. The spec is at Working Draft 0.2 and the implementation is mid-roadmap (see [Status & roadmap](#status--roadmap)). APIs and on-disk formats may change without notice until 1.0.

## Table of contents

- [What is ArgML?](#what-is-argml)
- [Install](#install)
- [Quickstart (CLI)](#quickstart-cli)
- [Library usage](#library-usage)
- [Examples](#examples)
- [Use with Claude](#use-with-claude)
- [Documentation](#documentation)
- [Status & roadmap](#status--roadmap)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## What is ArgML?

ArgML lets you annotate prose with a small vocabulary of argumentative elements — `<claim>`, `<assumption>`, `<inference>`, `<conflict>`, `<term>`, and a few others — and connect them with typed relations (`supports`, `attacks`, `rests-on`, …). The result is a document that is still readable as prose but is also a machine-checkable argument graph.

Concretely, ArgML aims to enable:

- **Validation** — catch unresolved references, kind mismatches, undeclared imports, and other structural mistakes before publishing.
- **Inspection** — view the dependency tree behind any claim; see what an essay actually rests on.
- **Visualization** — render an essay's argument graph as JSON, DOT/Graphviz, or HTML.
- **Cross-document linking** — reference claims in other ArgML documents by stable id, so debates can be conducted at the level of specific propositions.

The format is defined in [`spec/argml-spec.md`](./spec/argml-spec.md). When the implementation and the spec disagree, the divergence is logged in [`SPEC-NOTES.md`](./SPEC-NOTES.md) and resolved deliberately, not silently.

## Install

Requires **Node.js ≥ 22** and **pnpm**.

```sh
git clone https://github.com/ianwsperber/arg-ml.git
cd arg-ml
pnpm install
pnpm build
```

To put the `argml` CLI on your `PATH`:

```sh
pnpm link --global
```

The package is not yet published to npm.

## Quickstart (CLI)

All commands take a path to an `.argml.xml` file. Exit code is `0` on success and non-zero on validation errors or bad input — suitable for use in CI.

| Command | What it does |
|---|---|
| `argml validate <file>` | Parse and validate; print diagnostics as `path:line:col: severity code message`. |
| `argml summary <file>` | Structural counts (claims, assumptions, inferences, conflicts, …), import declarations, and cross-document references. |
| `argml deps <file> --target <id>` | ASCII dependency tree for a target id: what it `rests on`, what `supports` it, and what it `supports`. |
| `argml graph <file> [--format json\|dot]` | Emit the argument graph as Cytoscape-shaped JSON (default) or Graphviz DOT. |
| `argml render <file> [--output <html>]` | HTML render — stub until Phase 4 lands. |

### Example session

```sh
# Check a document
argml validate examples/morality-without-consciousness.argml.xml

# See what's in it
argml summary examples/morality-without-consciousness.argml.xml

# Trace what a claim depends on
argml deps examples/morality-without-consciousness.argml.xml --target c1

# Export to Graphviz and render
argml graph examples/morality-without-consciousness.argml.xml --format dot > arg.dot
dot -Tsvg arg.dot > arg.svg
```

If you haven't run `pnpm link --global`, substitute `pnpm exec argml …` or `node dist/cli/main.js …`.

## Library usage

The public API is exported from the package root. Internal paths are not stable — import only from `argml`.

```ts
import { parseArgML, validate } from "argml";

const source = await readFile("essay.argml.xml", "utf8");
const { document, diagnostics: parseDiagnostics } = parseArgML(source);

const diagnostics = [
  ...parseDiagnostics,
  ...(document ? validate(document) : []),
];

for (const d of diagnostics) {
  console.log(`${d.line}:${d.column}: ${d.severity} ${d.code} ${d.message}`);
}
```

Parser and validator return diagnostic arrays; they never throw on user input. Diagnostic codes (`ARGML001`, `ARGML002`, …) are stable identifiers documented in [`SPEC-NOTES.md`](./SPEC-NOTES.md).

Code in `src/` is written to run in both Node and the browser; modules under `viewer/` are the only browser-only ones.

## Examples

Hand-marked sample documents live in [`examples/`](./examples/). The most complete one is [`examples/morality-without-consciousness.argml.xml`](./examples/morality-without-consciousness.argml.xml), with the underlying prose in [`examples/consciousness-without-morality.md`](./examples/consciousness-without-morality.md). Rendered HTML output will be regenerated into `examples/rendered/` once Phase 4 lands.

## Use with Claude

This repo ships a Claude skill (`argml-converter`) that converts a blog post or pasted Markdown into ArgML. The skill source is [`skills/argml-converter/SKILL.md`](./skills/argml-converter/SKILL.md). It works in both Claude Code and Claude.ai.

**Claude Code** — install via the bundled marketplace:

```text
/plugin marketplace add ianwsperber/arg-ml
/plugin install argml@argml
```

Once installed, ask Claude to "argml this post" and paste a URL or Markdown. The skill fetches the live spec from `main` before converting and writes a draft `.argml.xml` for review.

**Claude.ai** — zip the skill directory and upload via Settings → Capabilities → Skills:

```sh
( cd skills && zip -r ../argml-converter.zip argml-converter )
```

The plugin manifest is [`.claude-plugin/marketplace.json`](./.claude-plugin/marketplace.json). See Anthropic's [skills docs](https://code.claude.com/docs/en/skills) and [plugin marketplaces docs](https://code.claude.com/docs/en/plugin-marketplaces) for the underlying mechanics.

## Documentation

- [`spec/argml-spec.md`](./spec/argml-spec.md) — the format specification (Working Draft 0.2). Source of truth for syntax, semantics, and conformance.
- [`CHANGELOG.md`](./CHANGELOG.md) — phase-by-phase completion log.
- [`SPEC-NOTES.md`](./SPEC-NOTES.md) — log of implementation / spec divergences and diagnostic-code reference.
- [`docs/adr/`](./docs/adr/) — architecture decision records.
- [`PLAN.md`](./PLAN.md) — pointer to the implementation project plan.

## Status & roadmap

| Phase | Deliverable | Status |
|---|---|---|
| 1 | Core data model + parser | ✅ |
| 2 | Validator with stable diagnostic codes | ✅ |
| 3 | `argml` CLI (`validate`, `summary`, `deps`, `graph`, `render` stub) | ✅ |
| 4 | HTML renderer | 🚧 next |
| 5 | LLM-assisted Markdown → ArgML conversion | planned |
| 6 | Interactive argument-graph viewer | planned |
| 7 | Cross-document reference resolution | planned |
| 8 | 1.0 hardening | planned |

The most recent completed phase is at the top of [`CHANGELOG.md`](./CHANGELOG.md).

## Development

```sh
pnpm install         # install dependencies
pnpm test            # run vitest
pnpm typecheck       # strict TypeScript checks
pnpm lint            # biome check (lint + format)
pnpm lint:fix        # biome with auto-fixes
pnpm build           # compile to dist/
pnpm render-examples # regenerate examples/rendered/ (Phase 4+)
```

Run `pnpm typecheck && pnpm test && pnpm lint` before every commit.

Conventions in brief:

- TypeScript `strict: true`. No `any` — use `unknown` and narrow.
- Biome for lint + format. No ESLint, no Prettier.
- Vitest, with tests co-located next to their source (`foo.ts` / `foo.test.ts`).
- Named exports only.
- Tests import from the package's public API, not internal paths.

The full set of project conventions is in [`CLAUDE.md`](./CLAUDE.md).

## Contributing

Issues and pull requests are welcome. Before opening a non-trivial PR:

1. Read the relevant section of [`spec/argml-spec.md`](./spec/argml-spec.md) and the current phase in [`CHANGELOG.md`](./CHANGELOG.md).
2. If your change implies a change to the spec, propose it in [`SPEC-NOTES.md`](./SPEC-NOTES.md) first.
3. Substantive design decisions get an ADR in [`docs/adr/`](./docs/adr/).
4. Every PR should include tests, a `CHANGELOG.md` entry, and any necessary `SPEC-NOTES.md` updates.

Phases proceed in order; please check that your change fits the current phase's scope before investing significant work.

## License

[MIT](./LICENSE) © 2026 Ian Walker-Sperber.
