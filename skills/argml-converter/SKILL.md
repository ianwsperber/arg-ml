---
name: argml-converter
description: Convert a blog post or Markdown essay into ArgML — an XML markup language for inline annotation of argumentative prose, supporting double-cruxing of philosophical and rationalist arguments. Use when the user provides a URL or Markdown text and asks to convert it to ArgML, formalize it, mark it up structurally, or extract its claims and inferences. Trigger phrases include "convert this to ArgML", "argml this post", "argml [URL]", "mark up this post", "formalize this post", "give me the ArgML for [URL]", and "extract claims and inferences from this". Also trigger when the user provides a URL and mentions argumentation structure, claims, inferences, formal annotation, or double-cruxing — even without saying "ArgML" explicitly. Produces a validated .argml.xml file ready for review.
---

# ArgML Converter

Convert a blog post or essay into ArgML — an XML markup language for inline annotation of argumentative prose. The output is a **draft for the user to review and refine**, never a finished artifact. Always end by inviting feedback on what to adjust.

## What this skill does

Takes a blog post (by URL) or a Markdown document (pasted directly) and produces a validated ArgML document. The conversion is *annotation, not translation* — the body prose is preserved verbatim, with inline `<term>`, `<claim>`, `<inference>`, and `<conflict>` tags wrapping the relevant spans. A `<head>` block declares terms, assumptions, and any cross-document imports.

## The latest spec

ArgML is under active development. Always fetch the current specification before converting, because the schema, recommended scheme names, and credence buckets may have evolved since this skill was written:

```
https://raw.githubusercontent.com/ianwsperber/arg-ml/main/spec/argml-spec.md
```

Read sections 5 (Head), 6 (Body), 7 (Element Reference), 11 (Defeasibility and Conflict Types), and 12 (Epistemic Markers). Skim section 8 (Attribute Reference) for the precise attribute list on each element. Skip the appendices unless you need to validate the schema in detail.

If the spec fetch fails (404, network error, repo moved), tell the user and ask whether to proceed with a cached understanding or wait. Don't silently fall back — the spec may have moved.

## Workflow

1. **Fetch the spec** via `web_fetch` using the raw GitHub URL above.
2. **Fetch the post** via `web_fetch` (if the user gave a URL) or use the Markdown directly (if pasted).
3. **Extract post content**: title, author, date, body prose, footnotes. Discard navigation, comments (unless asked for), and platform chrome.
4. **Pass 1 — Concept extraction**. Read the entire post and identify:
   - Terms that appear multiple times or carry domain-specific meaning
   - Aliases (multiple surface forms for the same concept — e.g. "consciousness", "phenomenal consciousness", "qualia" all referring to the same thing)
   - Assumptions the author treats as foundational (signalled by phrases like "let us suppose", "assume that", "I take for granted")
   - References to other posts that could become `<import>` declarations
   - The document's overall epistemic status, if signalled

   Compose the `<head>` block.
5. **Pass 2 — Inline annotation**. Walk the body and wrap relevant spans with `<term>`, `<claim>`, `<inference>`, and `<conflict>` tags. Assign credence and strength markers where the author's hedging language warrants it.
6. **Validate**. Check the document is well-formed XML; every `id` is unique within the document; every internal `ref`, `supports`, `attacks`, `rests-on`, `via`, `from`, `to` resolves; the namespace is `urn:argml:v1`.
7. **Save and present**. Write to `/mnt/user-data/outputs/argml-<slug>.argml.xml` and use `present_files` to share it.

## Conservatism rules

The cardinal sin of this conversion is over-marking. False markup creates noise; missing markup is easy for the user to add by hand. When in doubt, leave unmarked.

- **Don't mark a term** unless it appears more than once OR has a clearly technical sense in the post. "Consciousness" in a philosophy-of-mind post is a term. "Argument" used colloquially is not.
- **Don't mark a claim** unless the author argues for it OR uses it as a premise for another claim. Descriptive statements, scene-setting, and rhetorical questions are not claims.
- **Don't assert a credence** the author doesn't signal. Absence of a `credence` attribute means "unspecified" — that is the correct value when the author hasn't hedged. Do not fill in defaults.
- **Don't invent canonical URLs**. If the term has an obvious Stanford Encyclopedia of Philosophy entry, use it (`https://plato.stanford.edu/entries/<slug>/`). Otherwise set `scope="local"` with a `<gloss>` derived from the text and leave `canonical` unset.
- **Don't invent inferences**. If the author moves between two claims without making the inferential step explicit, don't fabricate an `<inference>` element with a confident scheme name. A `supports` attribute on the downstream claim is enough; let the inference remain implicit.

## Calibration heuristics

Map the author's hedging language to credence buckets only when present. These are heuristics — apply judgement, especially when multiple signals conflict.

| Surface signal                                          | Credence       |
|---------------------------------------------------------|----------------|
| "I suspect", "perhaps", "might", "possibly"             | `speculative`  |
| "I think", "I'd guess", "It seems to me"                | `tentative`    |
| "I believe", "I hold that", with reasoning provided     | `considered`   |
| "I will defend", "I am confident that"                  | `confident`    |
| "Clearly", "obviously" (sparingly — these are often rhetorical) | `near-certain` |

For inference strength, similar mapping:

| Surface signal                                | Strength       |
|-----------------------------------------------|----------------|
| "suggests", "hints at"                        | `weak`         |
| "because", "since", "this is reason to think" | `moderate`     |
| "this means", "this shows", "implies"         | `strong`       |
| "this entails", "deductively follows"         | `deductive` (also set `defeasible="false"`) |

If the author offers no signal, omit the attribute. Unspecified is correct when calibration is absent.

## Cross-references

Posts often reference other posts (typically via Markdown links). When the post is *responding to* or *building on* another post:

- If **responding**, identify a few key claims of the original post that this post attacks. Declare an `<import prefix="...">` in the head and reference them as `prefix:claim-id`. Use **placeholder ids** like `linch:dualism-premise` and add an XML comment noting that the target post has not yet been marked up — the imports are aspirational but the references are well-formed.
- If **building on**, the same pattern using `rests-on` instead of `attacks`.

Don't fetch the referenced posts unless the user asks. The cross-document plumbing is for the user to finalize later.

When a post cites a series or sequence of related posts, declare a single `<import>` with a meaningful prefix (e.g. `seq`, `series`) bound to a representative URL.

## Handling footnotes

Posts often have substantive footnotes. Treat them as follows:

- **Citation-style footnotes** (a single reference) become `<evidence ref="..."/>` on the supported claim.
- **Substantive footnotes** (the author elaborating on a point) become a `<note>` element inline within the relevant claim or paragraph. Preserve the footnote's text.
- **Footnote backlinks and "↑" symbols** in the rendered HTML are discarded.

## Output requirements

The file written to `/mnt/user-data/outputs/` must:

- Have a filename `argml-<slug>.argml.xml` where `<slug>` matches the URL's slug (e.g. `argml-morality-without-consciousness.argml.xml`).
- Begin with `<?xml version="1.0" encoding="UTF-8"?>`.
- Use the `urn:argml:v1` namespace on the root `<post>` element.
- Include `<source>` in `<metadata>` pointing at the original URL.
- Add an XML comment near the top noting:
  ```xml
  <!-- Generated by argml-converter skill on YYYY-MM-DD. Draft — review before use. -->
  ```
- Preserve the original prose intact (modulo `<p>` wrapping). Stripping all ArgML tags from `<body>` should reproduce the original Markdown prose.

## After conversion

Briefly summarize for the user:

- Counts: terms, claims, inferences, assumptions, conflicts.
- Any cross-references to other posts that are placeholder-only and need follow-up.
- Any sections where you were uncertain and erred toward unmarked — call these out by section heading or paragraph so the user knows where they might want to add markup manually.
- Any spec ambiguities encountered that may be worth logging in `SPEC-NOTES.md`.

This is a draft. Always end by inviting the user to flag what needs adjusting before the file is "real."

## Worked example

For a passage like:

> A recent post by Linch gets at an important implication of consciousness — namely, that we ought to suspect further aspects of reality. The author assumes that we could not explain consciousness through physicalism. This is already a strong claim, one with which about half of surveyed philosophers disagree.

Pass 1 identifies `consciousness` and `physicalism` as recurring terms (declared in the head with SEP canonical references; `consciousness` carries aliases `phenomenal consciousness` and `qualia`). Pass 2 produces:

```xml
<p>A recent post by Linch gets at an important implication of
<term ref="consciousness">consciousness</term> — namely, that we ought to
suspect further aspects of reality.</p>

<p><claim id="C1.1" attacks="linch:dualism-premise" attack-type="undermine"
credence="confident">The author assumes that we could not explain
<term ref="consciousness">consciousness</term> through
<term ref="physicalism">physicalism</term>.</claim>
<claim id="C1.2" supports="C1.1" credence="near-certain">This is already a
strong claim, one with which about half of surveyed philosophers
disagree<evidence type="survey"
ref="https://survey2020.philpeople.org"/>.</claim></p>
```

Note that `linch:dualism-premise` is aspirational — the target post hasn't been marked up — but the structure is in place for when it is. An XML comment near the `<import>` declaration flags this.

## Edge cases

**Very long posts (>10k words)**: Convert in full; most essays don't exceed Claude's working capacity. If a post is so long that quality suffers, tell the user and offer to split by section.

**Posts that are mostly narrative/anecdotal**: Some posts are stories or experience reports rather than arguments. Mark them lightly — a few terms in the head, minimal claim markup. Tell the user the post may not benefit much from ArgML and ask whether to proceed.

**Posts with extensive embedded equations or code**: Pass these through unchanged inside `<p>` elements. ArgML has no opinion on inline math or code; markdown's `$...$` and triple-backtick fences are preserved as-is.

**Posts with images**: Note their presence in an XML comment at the point they appear; ArgML 0.2 has no image element.

**Posts where the URL is broken or returns a login wall**: Tell the user. If they have the Markdown locally, ask them to paste it.
