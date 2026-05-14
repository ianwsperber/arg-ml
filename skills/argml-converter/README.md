# argml-converter skill

A Claude Skill that converts argumentative prose (URL, local Markdown file, or
pasted Markdown) into a valid ArgML document — fetching the latest spec
version from the canonical URL at runtime. The output is always a **draft for
human review**, never a finished artifact.

## What this skill does

Takes a URL, a local Markdown file, or pasted Markdown and produces a
`<post>` document with `<head>` declarations (provenance, terms, assumptions,
takeaways) and an inline-annotated `<body>` (`<term>`, `<claim>`,
`<argument>`, `<inference>`, `<conflict>`). The conversion is annotation, not
translation: every character of source prose is preserved verbatim. The
skill's contribution lives in tag placement and attribute choices, not in
rewording.

## Architecture

The skill is an orchestrator (`SKILL.md`) that dispatches two general-purpose
subagents — a **source-prep** subagent (loads
`instructions/source-prep-instructions.md`; fetches the URL or file,
normalises to Markdown, paragraph-numbers it, emits a metadata sidecar) and
a **converter** subagent (loads `instructions/converter-instructions.md`,
fetches the latest ArgML spec from the canonical URL, identifies the argument
spine, emits a manifest
XML) — then runs the **substitution engine** (`scripts/apply_manifest.py`,
also exposed via `pnpm argml assemble`) between them. The orchestrator
never sees raw HTML, the prepared body, the spec text, or the manifest XML
— only paths and structured summaries.

Source fidelity is enforced by construction: the engine can only substitute
spans that are present verbatim in the source, so the assembled `<body>`
strips back to the source byte-for-byte. Phase 5 of
[`docs/project/Project.md`](../../docs/project/Project.md) records the
high-level rationale and acceptance criteria.

## Layout

| Path | Role |
| --- | --- |
| `SKILL.md` | Orchestrator skill that Claude Code loads when the user asks for a conversion. Dispatches subagents, runs the engine, handles up-to-2 retries on engine failure, and summarises for the user. |
| `instructions/source-prep-instructions.md` | Loaded by the source-prep subagent. Covers URL fetching, Markdown extraction, paragraph numbering with `[¶S.P]` markers, and the metadata sidecar shape. |
| `instructions/converter-instructions.md` | Loaded by the converter subagent. Contains the bulk of the conversion judgment — spine identification, mode/pattern vocabulary, manifest format, edit-kind rules, the fix-mode protocol. |
| `scripts/prepare_source.py` | Source-prep helper. Reads raw Markdown, builds a section/paragraph tree, prepends `[¶S.P]` markers, emits the metadata sidecar. |
| `scripts/markdown_tree.py` | Shared parser for the paragraph tree used by both `prepare_source.py` and `apply_manifest.py`. |
| `scripts/apply_manifest.py` | The substitution engine. Parses the manifest, validates 8 preconditions, applies edits, and validates 4 postconditions on the assembled XML. |
| `scripts/test_apply_manifest.py` | Engine unit tests (30 tests). |

A symlink at the repo root, `.claude/skills/argml-converter` → `skills/argml-converter`,
makes the skill discoverable in Claude Code sessions rooted at this repo.

## Running the skill

**In Claude Code**: invoke from chat. Ask Claude to "convert this LessWrong
post to ArgML" with a URL or pasted Markdown. The skill orchestrates the
subagents and runs the engine end-to-end.

**Via the CLI** (manifest already produced):

```bash
pnpm argml assemble examples/manifests/morality-without-consciousness.manifest.xml \
                    examples/consciousness-without-morality.md \
                    --output examples/morality-without-consciousness.argml.xml \
                    --validate
```

Or call the engine directly without the TS toolchain:

```bash
python3 skills/argml-converter/scripts/apply_manifest.py \
  --manifest examples/manifests/morality-without-consciousness.manifest.xml \
  --source   examples/consciousness-without-morality.md \
  --output   out.argml.xml
```

Exit codes: 0 success; 1 preconditions failed; 2 postconditions failed;
3 IO/parse error; 4 `python3` not found.

## Manifest format

The skill emits an XML manifest in the `urn:argml-manifest:v1` namespace.
The root `<argml-manifest>` carries a `<source>` record (for traceability),
a verbatim `<head>` block (inserted into the final `<post>` as-is), and a
flat `<edits>` sequence of `<inline>` (replace a substring of a paragraph),
`<wrap>` (wrap a paragraph range in a block element), and `<insert>`
(insert an element at a paragraph boundary) directives. The engine sorts
edits by `(phase, section, paragraph, find-position)` and applies them
sequentially.

The full schema, addressing rules, and edit-kind semantics live in
[`instructions/converter-instructions.md`](./instructions/converter-instructions.md)
(§2 "The manifest format you must produce"). A worked example manifest is
at [`examples/manifests/morality-without-consciousness.manifest.xml`](../../examples/manifests/morality-without-consciousness.manifest.xml).

## Testing

Run the engine's Python unit tests:

```bash
python3 -m pytest skills/argml-converter/scripts/test_apply_manifest.py -v
# or, without pytest:
python3 skills/argml-converter/scripts/test_apply_manifest.py
```

Run the TS CLI tests:

```bash
pnpm test src/cli/assemble.test.ts
```

The engine tests cover each precondition, each postcondition, and the
integration path against the MWC fixture. The CLI tests cover the happy
path, the `--output` and `--validate` flags, and the missing-Python branch.

## Historical

[`docs/project/historical/argml-skill-v0.2-proposal.md`](../../docs/project/historical/argml-skill-v0.2-proposal.md)
is the v0.2 proposal that preceded this implementation. It is preserved for
reference but does NOT describe the live skill — the live skill is the
present `SKILL.md` plus the two instruction files. Phase 5 was redesigned
around a manifest + substitution architecture rather than the originally-
planned programmatic Anthropic SDK approach; see Project.md §5 for the
rationale.
