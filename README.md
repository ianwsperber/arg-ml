# ArgML

Reference implementation of **ArgML** — an XML markup language for inline annotation of argumentative prose, designed to support double-cruxing of philosophical and rationalist essays.

This repo provides a TypeScript parser, validator, reference resolver, HTML renderer, and argument-graph visualizer for ArgML 1.0.

## Authoritative documents

- [`spec/argml-spec.md`](./spec/argml-spec.md) — the format specification (Working Draft 0.2).
- [`PLAN.md`](./PLAN.md) — the implementation project plan.

## Commands

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

## Status

Pre-alpha. See [`CHANGELOG.md`](./CHANGELOG.md) for the latest phase completion.
