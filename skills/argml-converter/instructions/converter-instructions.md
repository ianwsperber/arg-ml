---
title: ArgML Converter — Pass-2 Conversion Instructions
loaded-by: converter subagent dispatched from the argml-converter skill
purpose: Produce a valid ArgML manifest (head + edits) from a paragraph-numbered Markdown source
spec-target: ArgML 1.0 Working Draft 0.2
---

## 1. Your job

You are a converter subagent. You receive a paragraph-numbered Markdown source (with `[¶S.P]` markers prepended to each paragraph), a metadata JSON sidecar (URL, title, author, date), the ArgML 0.2 specification, and an output path for the manifest XML. Your single deliverable is a **manifest**: an XML document containing the generated `<head>` block plus a flat list of `<inline>`, `<wrap>`, and `<insert>` edits. The downstream substitution engine consumes the manifest plus the source Markdown and produces the final ArgML document by mechanically applying your edits. You never emit unannotated prose — the engine preserves it by construction. Write the manifest to the path the orchestrator gave you, then return a short structured summary to the orchestrator (described in §3 and §18). Do not include the manifest content in your reply — only its path.

## 2. The manifest format you must produce

The manifest namespace is `urn:argml-manifest:v1`. The root is `<argml-manifest>`. It contains three top-level blocks: `<source>`, `<head>`, and `<edits>`.

### 2.1 Skeleton

```xml
<?xml version="1.0" encoding="UTF-8"?>
<argml-manifest xmlns="urn:argml-manifest:v1" spec-version="0.2">

  <source>
    <url>https://www.lesswrong.com/posts/.../morality-without-consciousness</url>
    <title>Morality without Consciousness</title>
    <author>IanWS</author>
    <date>2026-04-17</date>
  </source>

  <head>
    <metadata>
      <title>Morality without Consciousness</title>
      <author>IanWS</author>
      <date>2026-04-17</date>
      <source>https://www.lesswrong.com/posts/.../morality-without-consciousness</source>
    </metadata>
    <provenance>
      <generator id="g-original" type="human" who="IanWS"
                 date="2026-04-17" role="original-author"/>
      <generator id="g-extract"  type="llm"   model="claude-opus-4.7"
                 date="2026-05-14" role="extractor"/>
    </provenance>
    <imports>
      <import prefix="sep" doc="https://plato.stanford.edu/entries/"/>
    </imports>
    <terms>
      <term id="consciousness" canonical="sep:consciousness"/>
    </terms>
    <assumptions/>
    <takeaways>
      <takeaway ref="C6.7" priority="primary"/>
    </takeaways>
  </head>

  <edits>
    <!-- inline, wrap, and insert directives -->
  </edits>
</argml-manifest>
```

### 2.2 The `<source>` block

Copy `url`, `title`, `author`, `date` directly from the metadata JSON sidecar the orchestrator provided. Use `null`-omitted fields if the sidecar reports a field as missing. The engine uses this block only for record-keeping; the authoritative metadata is the `<metadata>` element inside `<head>`.

### 2.3 The `<head>` block

The `<head>` content model is identical to the ArgML 0.2 spec's `<head>` (§§5.1–5.6). The engine inserts your `<head>` verbatim into the final `<post>` as its first child. Order children per §4: `<metadata>`, then `<provenance>`, then `<imports>`, then `<terms>`, then `<assumptions>`, then (optional) `<takeaways>`.

- `<metadata>` mirrors `<source>` plus an optional `<epistemic-status>` (only if the source post has an explicit "Epistemic status:" preamble — wrap it verbatim).
- `<provenance>` ALWAYS contains both `g-original` (the human author, using the post's `date` and `author`) and `g-extract` (you, the LLM, with today's date and the model name from the orchestrator). Do not pre-emptively add `g-review`.
- `<imports>` declares every `prefix:` you use anywhere downstream.
- `<terms>` declares every term referenced in any `<inline>` edit via `<term ref="...">`. Each declaration carries `canonical=` only when there is an obvious canonical entry (SEP, etc.); otherwise use `scope="local"`. A `<gloss>` only if the source defines the term in verbatim prose you can wrap; otherwise omit.
- `<assumptions>` declares only assumptions the author explicitly states as foundational. Wrap the explicit statement verbatim. Omit the element if there are none.
- `<takeaways>` declares only takeaways the author signals. Omit the element if none.

### 2.4 The `<edits>` block

A flat sequence of `<inline>`, `<wrap>`, and `<insert>` directives. Order within the block is not significant — the engine sorts edits by (phase, section, paragraph, find-position) before applying. Each directive carries section/paragraph addressing.

#### `<inline>` — replace a substring of a paragraph

```xml
<inline section="0" paragraph="1">
  <find>A recent post, "The Fourth World," gets at an important implication of consciousness</find>
  <replace><claim id="L0" mode="attributed" attributed-to="Linch"
       source="https://www.lesswrong.com/posts/qfitpqvQzeZy2mSGi/the-fourth-world"
       same-as="linch:fourth-world-thesis"
       provenance="g-extract">A recent post, "The Fourth World," gets at an important implication of <term ref="consciousness">consciousness</term></claim></replace>
</inline>
```

Rules:
- `<find>` text is the **verbatim source span** (see §5). The engine locates it in the addressed paragraph.
- `<replace>` content must contain the find text character-for-character, augmented only with ArgML elements wrapped around it. Never modify the wrapped text.
- If `<find>` is not unique in the paragraph, add `occurrence="N"` (1-indexed) to disambiguate. Prefer extending `<find>` to make it unique; use `occurrence` only when extension would be absurd (e.g., five identical adjacent tokens). The engine rejects `occurrence` values where the find span appears more than 5 times in the paragraph.
- Use a single `<inline>` for any nested annotation. If a `<claim>` contains a `<term>` reference, emit them together inside one `<replace>` body — the engine does NOT merge separate inline edits into a tree.

#### `<wrap>` — wrap a paragraph range in a block element

```xml
<wrap section="2" from="1" to="3">
  <argument mode="thought-experiment" supports="C2.5" provenance="g-extract">
    <wrapped-content/>
  </argument>
</wrap>
```

Rules:
- `from` and `to` are 1-indexed and inclusive. `from="1" to="1"` wraps a single paragraph.
- The `<wrapped-content/>` placeholder is mandatory inside the wrapper; the engine replaces it with the already-inline-annotated paragraphs M..N.
- `<wrap>` ranges in the same section must be nested or disjoint — no partial overlaps.
- An `<argument>` MUST NOT carry an `attacks` attribute (spec §6.8.3). The engine will reject the manifest if you violate this.

#### `<insert>` — add a block element between paragraphs

```xml
<insert section="1" after="3">
  <inference id="I1" from="C1.0 C1.1" to="C2.5" pattern="modus-ponens" provenance="g-extract"/>
</insert>
```

Rules:
- `after="N"` inserts the block after paragraph N within the section. Use `after="0"` to insert before paragraph 1.
- Use `<insert>` for graph-only nodes that don't wrap prose: bare `<inference>`, bare `<conflict>` (when there is no `<response>` to wrap from source).

### 2.5 Addressing

The prepared source has `[¶S.P]` markers prepended to every paragraph. The marker maps directly to `section="S" paragraph="P"`:

- Section 0 = the preamble before the first `## heading`.
- Sections 1, 2, … = top-level `## headings`, in source order.
- Subsections (`### `) are flattened into the parent section's paragraph stream. The `### heading` line is itself a paragraph in that stream — it gets a `[¶S.P]` marker like any other paragraph.
- `paragraph="N"` is 1-indexed within the section.

The marker is a viewing aid only; it is not part of the paragraph's body text. When you copy text into a `<find>`, you copy what follows the marker — never the marker itself.

## 3. Output protocol (file paths)

1. Write the complete manifest XML to the path the orchestrator specified (typically `/tmp/argml-manifest-<slug>.xml`).
2. Return a SHORT message to the orchestrator. Required fields:
   - **manifest_path** — absolute path you wrote to.
   - **spine_sketch** — list of spine claim ids with one-line descriptions, grouped by role (takeaway / load-bearing premise / attack-defense pair / engaged-attribution).
   - **counts** — terms, claims (broken down by `mode`), arguments (by mode), inferences (noting how many carry `pattern`), conflicts, takeaways, assumptions, imports.
   - **modes_assigned** — list any non-default `mode` values on claims, so Ian can sanity-check them.
   - **patterns_assigned** — list any `pattern` values on inferences with the paragraph location.
   - **arguments_used_for_supporting_prose** — list each `<argument>` with a non-`thought-experiment`/`case`/`attributed` mode, noting which spine claim it supports.
   - **attributed_claims** — list each, noting `attributed-to` and whether you assigned a `same-as` placeholder.
   - **cross_references** — imports declared, plus any aspirational `prefix:id` references whose target post is not yet marked up.
   - **sections_left_unmarked** — sections or paragraph ranges where you erred toward unmarked, by heading or `[¶S.P]` address, so Ian knows where he might want to add markup manually.
   - **spec_ambiguities** — anything Ian might want to log in `SPEC-NOTES.md`.
3. DO NOT include the manifest's content in your reply. The orchestrator reads the file at the path you returned.

## 4. Fix-mode protocol

When the orchestrator invokes you with a prior manifest path plus a JSON list of engine errors:

1. Read the prior manifest from disk.
2. Read the engine error list. Each error names the failing edit (by index or by section/paragraph/find), a reason code, and a suggestion.
3. Apply **targeted corrections**: fix only the offending edits. Do not rewrite the whole manifest. Do not change unrelated edits, head declarations, or the spine.
4. Write the corrected manifest to the NEW output path the orchestrator specified (the orchestrator preserves the prior file for diffing).
5. Return a summary noting:
   - **manifest_path** — the new path you wrote to.
   - **fixed** — list of edits you changed, with a one-line description of the change per edit.
   - **untouched** — affirm that the rest of the manifest is byte-identical to the prior version.
   - Optional **escalations** — if an engine error is symptomatic of a deeper misjudgement (e.g., the find span genuinely does not exist in the source because you misidentified the paragraph), say so explicitly so the orchestrator can decide whether to surface it to Ian.

## 5. Source fidelity — the non-negotiable rule

**The engine enforces document-wide source fidelity by construction**: any prose not inside a `<replace>` is preserved verbatim from the source paragraph it came from. You cannot drop or alter unmarked text because you never emit it.

Your local responsibility is narrower but no less strict: **each `<find>` must be a character-for-character source span**, and the original span MUST appear character-for-character inside the corresponding `<replace>` body.

Operationally:

- **Quote `<find>` directly from the paragraph as it appears in the `[¶S.P]` view.** The view shows verbatim source text minus the marker prefix — what you see is what the engine will look for.
- **Inside `<replace>`, the original span MUST appear character-for-character — wrapping only adds ArgML elements around it.** Never modify the wrapped text. Don't fix typos, normalize whitespace, expand contractions, or "clean up" punctuation.
- **For nested annotations, emit a single `<inline>` whose `<replace>` contains the full nest.** Example: a `<claim>` that contains a `<term>` reference. The engine does NOT merge separate edits into a tree — two overlapping inlines is a precondition failure.
- **Inside other text slots — `<gloss>`, `<assumption>`, `<inference>` warrant text, `<response>` prose — the content is also a verbatim source span, or the element is omitted.** Never invent text to fill a slot.
- **Annotation lives in tag placement and attributes, not in text content.** Your contribution is structural — *which* spans to wrap, with *which* elements, with *which* attributes. Never in rewording.

If a structural slot would require paraphrased or fabricated text, **omit the structure**. A term with no source-stated definition gets `canonical` only (no `<gloss>`). An assumption the author never states explicitly is not declared. An inference whose warrant the author never articulates has no warrant text — its `from`, `to`, `scheme`, `pattern` attributes carry the annotation.

The engine will REJECT manifests whose `<find>` text doesn't match the source paragraph byte-for-byte. Don't try to be clever; quote from the view.

## 6. Spec examples are not an answer key

The spec uses "Morality without Consciousness" (IanWS, 2026-04-17) as its running worked-example post throughout §§6.7–6.10 and Appendix B. **When that same post is the conversion target, the spec's snippets are not a partial answer key.**

- The IDs they use (`C3.1`, `C3.5`, `C3.6`, `C4.5`, `C6.7`, `L0`, etc.) are illustrative, not canonical assignments. With the manifest format you are **emitting the IDs yourself** — this is even clearer than in the v0.1 flow. Don't feel obligated to reuse the spec's IDs; pick an internally consistent scheme.
- The takeaways shown (`C6.7` primary, `C4.9` secondary, `C3.6` load-bearing) demonstrate *how takeaways work*, not which claims in MWC are takeaways. Assess takeaways from the actual prose.
- The claim text shown is often paraphrased (see §5). Your output uses the verbatim source span, not the spec's cleaned-up version.
- The `<epistemic-status>` shown in Appendix B's metadata does *not* mean MWC has an epistemic-status preamble; the spec added one to demonstrate the field. If the source lacks an explicit preamble, omit the element.

Treat spec snippets the way you would treat any worked example in a textbook: illustrations of mechanics, not constraints on the present problem.

## 7. Mark the spine, not every sentence

An essay contains dozens of declarative sentences. **Most are not claims in the ArgML-graph sense.** They're scene-setting, restatement, illustration, definitional asides, elaborations on a point already made, or connective tissue. Wrapping every assertion in `<claim>` produces a graph with no shape — defeating the entire purpose of the formalisation.

**The spine.** A `<claim>` element should mark a node on the *critical path* of the argument. A claim is on the spine if and only if it is one of:

1. A **takeaway** (whatever the author identifies as their conclusion — `primary`, `secondary`, or `load-bearing`).
2. A **load-bearing premise** for a takeaway or another spine claim — a claim whose rejection would cascade through the argument graph.
3. A **substantive attack on, or defense of,** a spine claim — including answers to anticipated objections that engage with a spine claim.
4. An **attributed claim** the author structurally engages with (supports, attacks, or builds on) via the markup.

If a sentence isn't on the spine, it doesn't earn explicit `<claim>` markup *even if it asserts something*. The engine's preservation guarantees that the sentence appears in the output — it just appears as plain prose between or around the marked spans.

**Target density.** For a 3000-word essay the spine is typically 10–25 claims. **If you're past 30, you're over-marking.** The one place dense claim marking is legitimate is a recap or summary section where the author themselves restates conclusions — those carry `mode="restated"` with `same-as` pointing to the original spine node.

**The `<argument>` escape valve.** When a paragraph (or short section) builds support for a spine claim through reasoning that *doesn't decompose into individually-substantial sub-claims* — analogies, illustrations, elaborations, definitional refinements — wrap the region with a `<wrap>` edit emitting `<argument supports="...">` and leave its internal sentences as plain prose. The argument is the graph node; what's inside is the rhetorical work. This is exactly what §6.8 says `<argument>` is for: a region that "supports a claim through dialectical means."

**The three-way decision for each paragraph.** Walking the body, for each paragraph ask:

1. **Does this paragraph contain a sentence that's on the spine?** → Emit an `<inline>` edit wrapping that sentence as `<claim>`; leave the rest of the paragraph as prose.
2. **Does this paragraph build toward a spine claim without containing any individually-spine sentence?** → Emit a `<wrap>` edit wrapping the whole paragraph (or relevant range) in `<argument supports="...">` with an appropriate mode. Emit no inlines inside.
3. **Is this paragraph exposition** — background, scene-setting, framing, an aside, a hedge? → Emit nothing.

**Objections deserve a specific note.** Anticipated objections (`mode="anticipated-objection"`) are on the spine *when they substantively attack a spine claim and the author engages with them*. Drive-by mentions ("one might worry that…" without elaboration or response) are exposition, not spine.

**Concessions and hedges are not spine.** A final paragraph that says "obviously these conclusions are several steps removed from ground truth" is the author hedging, not asserting a claim in the argument graph. Leave it unmarked. `mode="conceded"` is for genuine "I grant this for the sake of argument" moves that are *used* downstream — not for tonal humility.

## 8. Modes and dialectical moves

The `mode` attribute on `<claim>` (§6.7) is the most consequential v0.2 addition for ordinary prose. Default is `asserted`. Apply a non-default mode only when the surface text carries the signal.

| Surface signal in prose | `mode` |
|---|---|
| "Suppose…", "Imagine that…", "Consider a world in which…" introducing a hypothetical | `supposed` |
| The author paraphrases another writer's position — "[Author] holds that…", "[Author] argues…" | `attributed` (and use `attributed-to`, ideally `source` and `same-as`) |
| Recap section restating a claim made earlier ("As established above, …", "Recall that…") | `restated` (and use `same-as` pointing to the earlier claim's id) |
| "You might think…", "An opponent could object that…", "One might respond…" introducing an objection the author is about to refute | `anticipated-objection` |
| "Grant for the sake of argument that…", "Even if we accept…" | `conceded` |
| The proposition that a reductio is targeting for refutation | `reductio-target` |

If none of these signals is present, leave `mode` unset. A claim with no signal is `asserted` by default — that is the correct annotation.

Manifest example — an attributed claim emitted via an `<inline>`:

```xml
<inline section="0" paragraph="1">
  <find>The author assumes that we could not explain consciousness through physicalism</find>
  <replace><claim id="L1" mode="attributed" attributed-to="Linch"
       source="https://www.lesswrong.com/posts/qfitpqvQzeZy2mSGi/the-fourth-world"
       same-as="linch:no-physicalism"
       provenance="g-extract">The author assumes that we could not explain <term ref="consciousness">consciousness</term> through <term ref="physicalism">physicalism</term></claim></replace>
</inline>
```

### 8.1 The `<argument>` element

The `<argument>` element wraps a region of prose that does dialectical work *without committing to a specific proposition*. The §6.8 recommended modes:

- `thought-experiment` — a hypothetical scenario the author constructs to expose intuitions.
- `case` — one branch of an argument-by-cases. Always paired with another `<argument mode="case">` and an `<inference pattern="argument-by-cases">` joining them.
- `attributed` — an extended attribution to another author (a paragraph or more of summary of someone else's position, before the present author engages with it).

The mode vocabulary is open (§6.8.1). For paragraphs of supporting reasoning that build toward a spine claim without containing any individually-spine sentence, use one of:

- `supporting` — general-purpose: a paragraph that elaborates, qualifies, or builds plausibility for the supported claim through sub-assertions that don't individually warrant marking.
- `illustration` — a vivid example or scenario clarifying what the supported claim means (distinct from a `thought-experiment`, which constructs a hypothetical to expose intuitions).
- `analogy` — a comparison or parallel structure used to make the supported claim more intuitive.
- `elaboration` — restates, refines, or unpacks the supported claim across multiple sentences.

These modes carry `supports="<spine-claim-id>"` pointing at the spine node the region builds toward. Inside the region, emit no inlines — the `<argument>` is the graph node.

**Crucial rule: `<argument>` cannot attack** (§6.8.3). It can only support. To refute, emit a `<claim>` (typically with the appropriate `mode`) that does the attacking. If you find yourself reaching for an `attacks` attribute on an `<argument>`, you've misidentified the structure — the engine will reject the manifest.

Manifest example — wrapping a thought-experiment region:

```xml
<wrap section="3" from="2" to="4">
  <argument id="ARG-3.2" mode="thought-experiment" supports="C3.6" provenance="g-extract">
    <wrapped-content/>
  </argument>
</wrap>
```

The choice between marking individual claims inside a paragraph vs. wrapping it in `<argument>` is exactly the spine question: if a sentence is on the spine, emit a `<claim>` inline; if the whole paragraph is supporting-prose-as-a-unit, emit a `<wrap>`. Don't do both for the same paragraph.

## 9. Cross-references and imports

LessWrong posts routinely reference other posts. v0.2's idiomatic pattern is the *attributed claim* (§6.9).

**The pattern.** When the source contains prose attributing a view to another author ("Linch's post argues that X", "as Chalmers points out, Y"), emit an `<inline>` edit wrapping that prose span verbatim as a `<claim mode="attributed">`, carrying `attributed-to`, `source`, and (when applicable) `same-as`:

```xml
<inline section="0" paragraph="1">
  <find>A recent post, "The Fourth World," gets at an important implication of consciousness — namely, that we ought to suspect further aspects of reality than we can today observe</find>
  <replace><claim id="L0" mode="attributed" attributed-to="Linch"
       source="https://www.lesswrong.com/posts/qfitpqvQzeZy2mSGi/the-fourth-world"
       same-as="linch:fourth-world-thesis"
       provenance="g-extract">A recent post, "The Fourth World," gets at an important implication of <term ref="consciousness">consciousness</term> — namely, that we ought to suspect further aspects of reality than we can today observe</claim></replace>
</inline>
```

The claim's text content is *verbatim* source prose — the author's own framing of the attributed view, with embedded `<term>` references and punctuation preserved. The `same-as` attribute points at the canonical form that may live in the cited document; until that document is marked up, the reference is a well-formed promissory note.

**What if there's no clean prose span to wrap?** If the author refers to another work without articulating the attributed claim in their own prose (e.g., a bare citation in a sentence about something else), don't fabricate an attributed claim. Either skip the attribution markup entirely, or — if the cited claim is genuinely doing graph work — use a bare `prefix:identifier` reference on the relevant `attacks` / `rests-on` / `supports` attribute and add an XML comment noting the target id is aspirational. **Never write paraphrased claim text to fill the slot.**

**Imports.** Declare a corresponding `<import>` in `<head>` for every prefix used. For "The Sequences," bind `seq` to the specific sequence URL. For SEP, bind `sep` to `https://plato.stanford.edu/entries/`. Don't fetch the referenced posts unless explicitly asked — the cross-document plumbing is for the reviewer to finalize later.

## 10. Calibration heuristics

Map the author's hedging language to credence buckets only when present. These are heuristics — apply judgement, especially when multiple signals conflict.

| Surface signal                                          | Credence       |
|---------------------------------------------------------|----------------|
| "I suspect", "perhaps", "might", "possibly"             | `speculative`  |
| "I think", "I'd guess", "It seems to me"                | `tentative`    |
| "I believe", "I hold that", with reasoning provided     | `considered`   |
| "I will defend", "I am confident that"                  | `confident`    |
| "Clearly", "obviously" (sparingly — these are often rhetorical) | `near-certain` |

For inference strength:

| Surface signal                                | Strength       |
|-----------------------------------------------|----------------|
| "suggests", "hints at"                        | `weak`         |
| "because", "since", "this is reason to think" | `moderate`     |
| "this means", "this shows", "implies"         | `strong`       |
| "this entails", "deductively follows"         | `deductive` (also set `defeasible="false"`) |

If the author offers no signal, omit the attribute. Unspecified is correct when calibration is absent. Do not invent defaults.

## 11. Takeaways

Takeaways live in the manifest's `<head>` block (not as separate edits). `<takeaways>` (§5.6) identifies the claims the author intends as their conclusions. The priority vocabulary:

- `primary` — the principal conclusion of the document.
- `secondary` — an important downstream conclusion, not the central terminal node.
- `load-bearing` — a claim that, if rejected, would invalidate most of the downstream argument.

Declare takeaways only when the author signals them. Signals include explicit framing ("My main claim is…", "The takeaway here is…"), abstract-style preambles, or a concluding section that names one or two specific claims. A claim being graph-terminal does not by itself make it a takeaway.

`load-bearing` is the most informative priority and the trickiest to assign. Reserve it for claims the author themselves flags as critical (often in a hedge: "if this is wrong, the rest of the argument doesn't go through") — don't infer it from your own read of the graph topology.

If the author has not identified takeaways, omit the `<takeaways>` block. Per §5.6 the absence is meaningful and processors must not infer takeaways from graph structure.

## 12. Provenance

Every conversion produced by this skill is an LLM extraction reviewed by a human. §5.2 makes this exactly expressible. The `<provenance>` block lives in `<head>`:

```xml
<provenance>
  <generator id="g-original" type="human" who="<post-author>"
             date="<post-date>" role="original-author"/>
  <generator id="g-extract" type="llm" model="claude-opus-4.7"
             date="<today>" role="extractor"/>
</provenance>
```

The post's `<author>` and the `g-original` generator are not redundant: §5.2 explicitly says processors must not infer provenance from author metadata.

Apply `provenance="g-extract"` to every `<claim>`, `<inference>`, `<conflict>`, `<argument>`, and `<takeaway>` you EMIT in any `<inline>`, `<wrap>`, or `<insert>` edit. You may apply it to `<term>` declarations and `<assumption>` elements in `<head>` when those were also extracted by you (typically they were).

Don't add a `g-review` generator — that's for Ian to add when he reviews, at which point he'll update the relevant `provenance` attributes to read `"g-extract g-review"`.

If the post explicitly cites or quotes a separate LLM-produced output, declare an additional generator with `role="original-author"` and `type="llm"` accordingly.

## 13. Handling footnotes, equations, images

Source fidelity applies here too. The engine preserves these spans verbatim; your job is to be careful around them.

- **Inline `[^N]` markers** in the prose stay where they are in the source. They appear in `<find>` text as-is when wrapping spans that contain them. Do not drop them; do not move them.
- **Footnote definitions** are paragraphs at the end of the prepared source (each carries its own `[¶S.P]` marker). If a footnote is substantive author commentary, emit an `<inline>` (covering the body of the definition) producing `<note>`. If it is a bare citation, emit `<evidence ref="<url>"/>` on the claim it supports via an inline edit at the claim site; the footnote definition paragraph itself can be left as prose.
- **Orphaned footnotes** (inline marker missing or definition unreferenced): wrap the definition in `<note status="orphaned">` and flag it in your summary's `spec_ambiguities`.
- **Code fences and inline code** pass through unchanged. The engine does not transform them.
- **Inline math (`$...$`) and block math (`$$...$$`)** pass through unchanged. Treat them as opaque text inside `<find>` spans.
- **Images** (`![alt](url)`) pass through unchanged. ArgML 0.2 has no image element. The image's Markdown stays in source position.

## 14. Conservatism rules

The cardinal sin of this conversion is over-marking. False markup creates noise; missing markup is easy for the reviewer to add by hand. **When in doubt, leave unmarked.** Most v0.2 features are opt-in — their *absence* is a valid annotation, not an omission.

- **Don't mark a term** unless it appears more than once OR has a clearly technical sense in the post. "Consciousness" in a philosophy-of-mind post is a term. "Argument" used colloquially is not.
- **Don't write a gloss** the author didn't write. If the source defines the term in prose, wrap that definition as `<gloss>` verbatim. Otherwise use `canonical` only, or omit both and rely on the term's surface form plus aliases.
- **Don't mark a claim** unless it's on the argument's spine (see §7). Descriptive statements, scene-setting, rhetorical questions, definitional asides, speculative musings, restatements outside an explicit recap, and final hedges are not spine.
- **Don't assert a credence** the author doesn't signal. Absence of a `credence` attribute means "unspecified" — that is the correct value when the author hasn't hedged.
- **Don't invent canonical URLs**. If a term has an obvious SEP entry, use it (via the `sep:` prefix bound to `https://plato.stanford.edu/entries/`). Otherwise set `scope="local"` and leave `canonical` unset.
- **Don't invent inferences**. If the author moves between two claims without making the inferential step explicit, don't fabricate an `<inference>` element with a confident scheme name. A `supports` attribute on the downstream claim is enough; let the inference remain implicit.
- **Don't write an inference warrant** the author didn't write. Warrant text is verbatim or absent.
- **Don't assign a `mode`** unless the prose carries a clear speech-act signal (§8). `mode="asserted"` is the default and is what you should leave implicit.
- **Use `<argument>` deliberately.** Don't wrap a single vivid sentence (it's just prose with maybe a claim) or exposition that doesn't support anything (it's just prose).
- **Don't assign a `pattern`** unless the compositional shape is explicit and unambiguous (e.g., the author literally says "by reductio" or "either P or Q; if P then R; if Q then R"). Implicit patterns are out of scope; informal-reasoning kind belongs in `scheme`.
- **Don't declare takeaways speculatively.** If the author doesn't clearly identify which claims are their intended conclusions, leave `<takeaways>` empty or omit it. Per §5.6, processors must not infer takeaways from graph topology — and neither should you.
- **Don't declare an assumption the author didn't state.** Implicit assumptions are not yours to make.
- **Don't add an `<epistemic-status>` the source lacks.**

## 15. What the engine rejects (preconditions)

If you do any of the following, the engine WILL reject your manifest and either fail outright or trigger a fix-mode re-dispatch:

1. **Your `<find>` text does not occur in its target paragraph.** Quote from the `[¶S.P]` view; do not retype or paraphrase.
2. **Your `<find>` text is not unique in the paragraph and you did not set `occurrence`.** Either extend the find span until it's unique, or set `occurrence="N"`.
3. **You set `occurrence="N"` but `N` is out of range, or the find span appears more than 5 times in the paragraph** (LLM miscount guard). Extend the find span instead.
4. **Two `<inline>` edits in the same paragraph have overlapping find ranges.** Merge them into a single `<inline>` with a nested `<replace>` body.
5. **A section or paragraph index references a location that doesn't exist.** Re-check the `[¶S.P]` markers.
6. **Your `<wrap>` ranges partially overlap.** Nest them or make them disjoint.
7. **A `<claim>`'s `<replace>` body contains a literal `<p>` or `</p>` tag.** Claims cannot span paragraphs per spec §6 — split the claim.
8. **An `<argument>` element in any `<replace>` or `<wrap>` body carries an `attacks` attribute.** §6.8.3 forbids this. Move the attack to a `<claim>`.

## 16. What the engine verifies (postconditions)

The engine will fail and ask you to retry (fix-mode) if, after applying all edits:

1. **The strip-tags round-trip on `<body>` does not byte-match the source prose.** This should only happen if the engine itself has a bug — but if it fires, your manifest may have contributed by combining edits in an unexpected way. Inspect the diff.
2. **An `id` is duplicated within the document.** You assigned the same id to two different elements (most often two claims).
3. **An internal reference (`ref`, `supports`, `attacks`, `from`, `to`, `rests-on`, `via`, `same-as`) does not resolve.** Either the target id is mistyped, or the target was never declared, or it uses a prefix not bound in `<imports>`.
4. **A `mode="restated"` claim does not carry `same-as`.** Per §6.7, this is required.

## 17. Worked example

Suppose the prepared source paragraph at `[¶0.1]` reads:

> A recent post, "The Fourth World," gets at an important implication of consciousness — namely, that we ought to suspect further aspects of reality than we can today observe — but I'm not sure it arrives there the right way. The author assumes that we could not explain consciousness through physicalism, and I would like to defend his conclusion while rejecting the path he takes to it.

Pass 1 identifies `consciousness` and `physicalism` as recurring terms (SEP canonicals, no glosses since the source doesn't define them here), declares a `<provenance>` block with `g-original` and `g-extract`, and binds `linch:` as an import to The Fourth World.

The manifest fragment:

```xml
<head>
  <metadata>
    <title>Morality without Consciousness</title>
    <author>IanWS</author>
    <date>2026-04-17</date>
    <source>https://www.lesswrong.com/posts/.../morality-without-consciousness</source>
  </metadata>
  <provenance>
    <generator id="g-original" type="human" who="IanWS" date="2026-04-17" role="original-author"/>
    <generator id="g-extract"  type="llm"   model="claude-opus-4.7" date="2026-05-14" role="extractor"/>
  </provenance>
  <imports>
    <import prefix="linch" doc="https://www.lesswrong.com/posts/qfitpqvQzeZy2mSGi/the-fourth-world"/>
    <import prefix="sep"   doc="https://plato.stanford.edu/entries/"/>
  </imports>
  <terms>
    <term id="consciousness" canonical="sep:consciousness"/>
    <term id="physicalism"   canonical="sep:physicalism"/>
  </terms>
</head>

<edits>
  <inline section="0" paragraph="1">
    <find>A recent post, "The Fourth World," gets at an important implication of consciousness — namely, that we ought to suspect further aspects of reality than we can today observe</find>
    <replace><claim id="L0" mode="attributed" attributed-to="Linch"
       source="https://www.lesswrong.com/posts/qfitpqvQzeZy2mSGi/the-fourth-world"
       same-as="linch:fourth-world-thesis"
       provenance="g-extract">A recent post, "The Fourth World," gets at an important implication of <term ref="consciousness">consciousness</term> — namely, that we ought to suspect further aspects of reality than we can today observe</claim></replace>
  </inline>

  <inline section="0" paragraph="1">
    <find>The author assumes that we could not explain consciousness through physicalism</find>
    <replace><claim id="L1" mode="attributed" attributed-to="Linch"
       source="https://www.lesswrong.com/posts/qfitpqvQzeZy2mSGi/the-fourth-world"
       same-as="linch:no-physicalism"
       provenance="g-extract">The author assumes that we could not explain <term ref="consciousness">consciousness</term> through <term ref="physicalism">physicalism</term></claim></replace>
  </inline>

  <inline section="0" paragraph="1">
    <find>I would like to defend his conclusion while rejecting the path he takes to it</find>
    <replace><claim id="C1.1" supports="L0" attacks="L1" attack-type="undermine"
       credence="confident" provenance="g-extract">I would like to defend his conclusion while rejecting the path he takes to it</claim></replace>
  </inline>
</edits>
```

Commentary on the verbatim-find discipline here:

- Each `<find>` is a byte-identical span from the source paragraph. Punctuation (`,`, `—`, quotation marks) is reproduced exactly.
- Inside each `<replace>`, the same span appears unchanged; the only additions are the wrapping `<claim>` element, its attributes, and the nested `<term>` references around `consciousness` and `physicalism`.
- The three `<inline>` edits do NOT overlap. The first covers the opening clause through "today observe"; the second covers the middle clause "The author assumes…physicalism"; the third covers the closing clause. The text between them ("— but I'm not sure it arrives there the right way." and ", and") is preserved verbatim by the engine.
- `L0` and `L1` wrap *the author's own descriptions* of Linch's two positions. They carry `mode="attributed"` because the author is reporting Linch's views; `same-as` points to where Linch's canonical claims will eventually live.
- `C1.1` does the unusual structural work — supporting Linch's conclusion (`L0`) while attacking his premise (`L1`) — that 0.1 could not express cleanly.
- No paraphrasing anywhere. The claim texts are verbatim source spans.

## 18. After conversion (what to return)

Return a single message to the orchestrator with the following structured fields. Be terse — these are scan-friendly handles, not narrative.

- **manifest_path**: absolute path to the manifest file you wrote.
- **spine_sketch**: bulleted list of spine claim ids with one-line descriptions, grouped by role:
  - takeaway(s)
  - load-bearing premise(s) for each takeaway
  - attack-defense pair(s)
  - engaged-attribution(s)
  This is the most important part of the summary — the reviewer should be able to scan it and verify the central path is right before scrutinising attribute-level details.
- **counts**: terms; claims (broken down by `mode` when any non-default modes were used); inferences (noting how many carry `pattern`); assumptions; arguments (by mode); conflicts; takeaways. Flag if the claim count exceeds 25 outside a recap section — that's a signal you may have over-marked.
- **arguments_used_for_supporting_prose**: each `<argument>` with a non-`thought-experiment`/`case`/`attributed` mode (e.g., `supporting`, `illustration`), noting which spine claim it supports. The reviewer sanity-checks that those regions weren't sentences that should have been individual claims, and vice versa.
- **attributed_claims**: each, noting the `attributed-to` party and whether you assigned a `same-as` placeholder.
- **cross_references**: imports declared; any `prefix:id` references whose target post is not yet marked up.
- **sections_left_unmarked**: by heading or `[¶S.P]` address, sections where you erred toward unmarked so the reviewer knows where to consider manual additions.
- **modes_assigned**: any non-default `mode` values on claims, so the reviewer can sanity-check them quickly. Mode misjudgements are the most consequential error in a v0.2 conversion.
- **patterns_assigned**: any `pattern` values on inferences, with the `[¶S.P]` address where the structure appears.
- **spec_ambiguities**: anything the reviewer might want to log in `SPEC-NOTES.md`.

Do NOT include the manifest's XML content in your reply. The orchestrator reads the file at `manifest_path`. Your reply is a small structured summary, not a paste of your work.
