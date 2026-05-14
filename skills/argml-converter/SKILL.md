---
name: argml-converter
description: Use when converting argumentative prose into ArgML — orchestrates source preparation and LLM-driven annotation, then deterministically substitutes annotations into the source to produce a validated ArgML draft for human review.
---

# ArgML Converter (orchestrator)

## What this skill does

Dispatches two specialist subagents — a source-prep subagent that fetches and normalizes the input document, and a converter subagent that reads the latest ArgML spec and emits an annotation manifest — then runs a deterministic substitution engine that applies the manifest to the prepared source to produce a validated ArgML draft. Source fidelity is mechanical: the engine preserves every unannotated character by construction, so the orchestrator never audits the body prose. The output is always a draft for the user to review and refine.

## When to use

- The user provides a URL, a local Markdown file, or pasted Markdown for a piece of argumentative prose and wants it converted to ArgML.
- The user wants output suitable for `argml validate`, `argml graph`, `argml propagate`, or the viewer.
- The user references "argml-converter", asks to "convert a post to ArgML", "mark up this post", "formalize this essay", or "extract the argument structure".

## Architecture

The skill is an orchestrator that delegates judgment-heavy work to two subagents and runs deterministic tools between them. The orchestrator never sees raw HTML, the full prepared source body, the spec text, or the full manifest XML — only structured summaries plus file paths.

```
   user request
        │
        ▼
┌──────────────────────┐
│ Orchestrator (this)  │
│ • dispatch subagents │
│ • run engine         │
│ • retry on failure   │
│ • summarize          │
└─┬───────┬────────────┘
  │       │
  ▼       ▼
source-prep      converter
subagent         subagent
(general-        (general-
 purpose)         purpose)
  │       │
  ▼       ▼
prepared.md   manifest.xml
metadata.json
        │
        ▼
   substitution engine (pnpm argml assemble / apply_manifest.py)
        │
        ▼
   final ArgML document
```

Longer-form architecture lives in `skills/argml-converter/README.md` and the project plan; this section is a sketch.

## Workflow

1. **Receive the user's input.** The input is one of: a URL, a local file path, or pasted Markdown. If it is ambiguous (e.g. the user types only a title), ask exactly one clarifying question. Derive a slug from the URL's final path segment or the filename stem; use it for all `/tmp/argml-*-<slug>.*` paths below.

2. **Resolve the skill base directory.** Subagent prompts reference instruction files inside this skill; the directory layout differs across installs (repo checkout vs. plugin marketplace), so discover it at runtime instead of hardcoding it. Run with Bash:
   ```
   find . ~/.claude/plugins ~/.claude/skills -path '*argml-converter*' -name SKILL.md -print 2>/dev/null | head -1 | xargs -r dirname
   ```
   Use the result as `{{skill-base}}` when substituting the subagent prompt templates below. If the discovery returns nothing, fall back to `skills/argml-converter` (the repo-relative path); subagents can also locate the directory themselves with the same `find` command if a passed-in path doesn't resolve.

3. **Dispatch the source-prep subagent** with the Agent tool, `subagent_type: "general-purpose"`. Pass the prompt template in §"Source-prep subagent prompt" verbatim, with the user's input, slug, and skill-base substituted. Wait for completion. The subagent returns paths to the prepared source plus a metadata sidecar, plus a small summary (title, author, date, word count, section/paragraph counts, notable items). If the subagent reports failure, see §"Failure recovery".

4. **Dispatch the converter subagent** with the Agent tool, `subagent_type: "general-purpose"`. Pass the prompt template in §"Converter subagent prompt (fresh)" with the paths from step 3, the skill-base, and the output manifest path `/tmp/argml-manifest-<slug>.xml` substituted. Wait for completion. The subagent returns the manifest path plus a structured summary (spine sketch, counts, modes, sections left unmarked, ambiguities). Do not ask it to paste the manifest content into its reply.

5. **Run the substitution engine** via Bash. Prefer the TS CLI when `pnpm` is on PATH:
   ```
   pnpm argml assemble /tmp/argml-manifest-<slug>.xml /tmp/argml-prepared-<slug>.md --output <user-output-path>
   ```
   Fall back to the Python helper directly on surfaces without the TS toolchain:
   ```
   python3 {{skill-base}}/scripts/apply_manifest.py \
     --manifest /tmp/argml-manifest-<slug>.xml \
     --source /tmp/argml-prepared-<slug>.md \
     --output <user-output-path>
   ```
   Default `<user-output-path>` is `./<slug>.argml.xml` unless the user named one.

6. **If the engine exits non-zero**, branch on the code:
   - **Exit 1** (preconditions failed) or **exit 2** (postconditions failed): capture the structured JSON error report from stderr. Re-dispatch the converter subagent using the §"Converter subagent prompt (fix mode)" template, passing the prior manifest path, the engine errors, and a new output path `/tmp/argml-manifest-<slug>-retry-<n>.xml`. Re-run step 5 against the new manifest. Allow up to 2 retries; on the third failure, present the most recent manifest path plus the engine errors to the user and stop.
   - **Exit 3** (IO/parse error): surface stderr to the user; do not retry.
   - **Exit 4** (python3 not found on a surface using the TS CLI): tell the user to install Python 3.9+; do not retry.

7. **Optionally surface semantic warnings** when `pnpm` is available (Claude Code):
   ```
   pnpm argml validate <user-output-path>
   ```
   Pass any diagnostics through to the user as draft warnings, not blockers — the engine has already established structural well-formedness and source fidelity.

8. **Summarize for the user.** Combine the converter's structured summary with the engine outcome:
   - Output file path.
   - Spine sketch (the converter's grouped list of spine claim ids and one-line descriptions).
   - Counts (terms, claims by mode, arguments by mode, inferences, conflicts, takeaways).
   - Sections where the converter erred toward unmarked.
   - Any spec ambiguities the converter surfaced.
   - Any `argml validate` diagnostics (if step 7 ran).
   End by inviting the user to flag what needs adjusting before the file is "real."

## Source-prep subagent prompt

Pass this verbatim with placeholders filled.

```
You are the source-preparation subagent for the argml-converter skill.

Your job: fetch the source document (URL, local file path, or pasted Markdown), normalize it to a clean Markdown body plus structured metadata, run the prepare_source.py helper to produce a paragraph-numbered view, and return ONLY paths plus a short structured summary to me. Do NOT include raw HTML, the prepared Markdown body, or excerpts of the prose in your reply.

Read your instructions in full before doing anything else:
  {{skill-base}}/instructions/source-prep-instructions.md

If that file is not found, locate it yourself with Bash:
  find . ~/.claude/plugins ~/.claude/skills -path '*argml-converter*' -name source-prep-instructions.md -print 2>/dev/null | head -1

Input:
  {{user-input}}

Slug to use for output filenames:
  {{slug}}

Output files to write:
  /tmp/argml-prepared-{{slug}}.md     (paragraph-numbered view)
  /tmp/argml-source-meta-{{slug}}.json (metadata sidecar)

The prepare_source.py helper lives at:
  {{skill-base}}/scripts/prepare_source.py

When finished, return a summary in the format described by §8 of your instructions: paths, title, author, date, source kind, word count, section count, paragraph count, notable items (footnotes, images, code blocks). Nothing else — no body excerpts, no HTML, no debug output.

If fetching or extraction fails, return a clear error message naming the failure mode and do NOT write partial output files. See §9 of your instructions.
```

## Converter subagent prompt (fresh)

Pass this verbatim with placeholders filled.

```
You are the converter subagent for the argml-converter skill.

Your job: read the prepared Markdown source, the source metadata, and the latest ArgML specification; produce an ArgML manifest XML (head + edits) that, when applied to the source by the substitution engine, yields a valid ArgML document. Return ONLY a structured summary to me; the manifest goes to a file path. Do NOT paste the manifest content into your reply.

Read your instructions in full before doing anything else:
  {{skill-base}}/instructions/converter-instructions.md

If that file is not found, locate it yourself with Bash:
  find . ~/.claude/plugins ~/.claude/skills -path '*argml-converter*' -name converter-instructions.md -print 2>/dev/null | head -1

Fetch the latest ArgML spec from the canonical URL — do NOT assume a local copy or a particular spec version:
  WebFetch: https://raw.githubusercontent.com/ianwsperber/arg-ml/main/spec/argml-spec.md
Read the version reported in the spec's frontmatter / Status section and emit a matching `spec-version` attribute on the manifest root.

Inputs:
  Prepared source:   /tmp/argml-prepared-{{slug}}.md
  Metadata sidecar:  /tmp/argml-source-meta-{{slug}}.json
  Output manifest:   /tmp/argml-manifest-{{slug}}.xml

Workflow (per your instructions):
  - Read the spec sections you need (§§4–6, §6.7–6.10, §7, §8, §10–12).
  - Pass 1: identify provenance, imports, terms, assumptions, takeaways → emit <head>.
  - Pass 2a (in an extended-thinking block): identify the spine — takeaways,
    load-bearing premises, substantive attacks/defenses, engaged attributions.
    Target 10–25 spine claims for a 3000-word essay.
  - Pass 2b: walk the body and emit <inline>, <wrap>, and <insert> edits.
  - Verify the manifest is well-formed XML before writing it to disk.

Return a structured summary per §3 / §18 of your instructions:
  - manifest_path
  - spine_sketch (grouped by role: takeaway / load-bearing premise / attack-defense pair / engaged-attribution)
  - counts (terms, claims by mode, arguments by mode, inferences, conflicts, takeaways, assumptions, imports)
  - modes_assigned
  - patterns_assigned
  - arguments_used_for_supporting_prose
  - attributed_claims
  - cross_references
  - sections_left_unmarked
  - spec_ambiguities

DO NOT include the manifest XML content in your reply.
```

## Converter subagent prompt (fix mode)

When the engine reports preconditions or postconditions failed, re-dispatch with this shorter template.

```
You are the converter subagent for the argml-converter skill, invoked in FIX MODE.

The substitution engine rejected your previous manifest. Read the engine errors below, apply TARGETED corrections to the prior manifest (do not rewrite it whole, do not change unrelated edits, the head, or the spine), and write the corrected manifest to the new output path.

Read your instructions in full before doing anything else, and follow §4 "Fix-mode protocol":
  {{skill-base}}/instructions/converter-instructions.md

If that file is not found, locate it yourself with Bash:
  find . ~/.claude/plugins ~/.claude/skills -path '*argml-converter*' -name converter-instructions.md -print 2>/dev/null | head -1

If you need to consult the spec while fixing, fetch the latest:
  WebFetch: https://raw.githubusercontent.com/ianwsperber/arg-ml/main/spec/argml-spec.md

Inputs:
  Prior manifest:    {{prior-manifest-path}}
  Engine errors:     {{engine-stderr-json}}
  Prepared source:   /tmp/argml-prepared-{{slug}}.md
  Metadata sidecar:  /tmp/argml-source-meta-{{slug}}.json
  New output path:   /tmp/argml-manifest-{{slug}}-retry-{{n}}.xml

Return a short summary:
  - manifest_path (the new path)
  - fixed: list of edits you changed, one line per edit (by edit index or section/paragraph reference)
  - untouched: affirm the rest of the manifest is byte-identical to the prior version
  - escalations (optional): flag any error that points at a deeper misjudgement so I can decide whether to surface it to the user
```

## Failure recovery

- **Source-prep failure** (fetch error, login wall, broken extraction): the subagent returns an error message and writes no output files. Surface the error to the user and offer to ask them to paste the Markdown body directly. If they do, re-dispatch source-prep with the pasted content as a local file.
- **Converter persistent failure** (engine still rejects after 2 retries): present the most recent manifest path, the latest engine error report, and the converter's last fix-mode summary to the user. Stop. Do not invent annotations to fill gaps.
- **Engine exit 3** (IO/parse error): surface stderr to the user. The manifest may be malformed XML or the source may have moved; do not retry blindly.
- **Engine exit 4 / python3 missing**: tell the user `argml assemble requires python3 (>= 3.9). Install it and retry.` Do not attempt the TS-CLI path again until it's resolved.

## Cross-surface notes

- **Claude Code** (this surface): full toolset. Use the Agent tool to dispatch both subagents. Use `pnpm argml assemble` for the engine and `pnpm argml validate` for optional semantic warnings. Resolve `{{skill-base}}` via Bash discovery (step 2 of the workflow).
- **Other surfaces** (Claude.ai chat, future deployments): if the Agent tool is unavailable, the orchestrator runs the same prep and conversion steps inline, sequentially. In that fallback, each phase reads only from disk (the prepared source, the metadata sidecar, the prior manifest) — never paste their contents into the orchestrator's context. The substitution engine runs via `python3 {{skill-base}}/scripts/apply_manifest.py` directly; `pnpm` may not be present. The manifest and prepared source always live on disk; the orchestrator only ever passes paths between phases.

## Output requirements

The skill produces:

- A final ArgML document at the user-requested output path (or `./<slug>.argml.xml` by default). The file passes the engine's preconditions and postconditions by construction; semantic warnings from `argml validate` are surfaced separately.
- A summary to the user containing: output path, spine sketch, counts, sections left unmarked, spec ambiguities, and any validation warnings. End by inviting the user to flag what needs adjusting before the file is treated as "real."
