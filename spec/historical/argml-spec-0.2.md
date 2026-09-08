# ArgML 0.2 — Argument Markup Language

**Specification, Working Draft, Version 0.2**

| Field        | Value                 |
| ------------ | --------------------- |
| Date         | 12 May 2026           |
| Editor       | Ian Walker-Sperber    |
| Status       | Working Draft         |
| This version | `urn:argml:spec:v0.2` |
| Supersedes   | `urn:argml:spec:v0.1` |
| Namespace    | `urn:argml:v1`        |

## Abstract

ArgML is an XML vocabulary for inline annotation of natural-language argumentative prose. It enables authors to mark up _term references_, _claims_, _inferences_, _assumptions_, and _conflicts_ directly within the body of a document, and to reference structures defined in other documents via a namespaced import mechanism. The primary target use case is rendering the argumentative structure of philosophical and rationalist essays explicit enough to support _double-cruxing_ — the localization of disagreement to a specific term, claim, assumption, or inference rule. ArgML borrows its argument-graph ontology from the Argument Interchange Format (AIF), its defeasibility model from ASPIC+, its inline-markup posture from the Text Encoding Initiative (TEI) and RDFa, and its cross-document reference model from XML Namespaces and Akoma Ntoso. Our long-term hope is that better specification languages for natural-language arguments can eventually assist in verification of machine-generated prose in any domain.

Working Draft 0.2 extends 0.1 along axes the original specification gestured at but did not develop. It introduces three new structural elements (`<takeaways>`, `<provenance>`, `<argument>`); a small set of new attributes on existing elements (`mode`, `attributed-to`, `same-as`, `source`, `pattern`, `provenance`); a richer recommended vocabulary for compositional inference patterns drawn from natural deduction; and one new document type (`<reader-overlay>`) for recording reader attitudes against argument graphs across the corpus. All additions are backwards-compatible with 0.1: documents conformant with 0.1 remain conformant with 0.2 without modification.

## Status of This Document

This is a Working Draft of the ArgML specification at version 0.2. Implementations conformant with Working Draft 0.1 remain conformant with this draft without modification; all 0.2 additions are optional. Implementations are encouraged but should expect breaking changes prior to a 1.0 Recommendation. Comments and corrections may be filed against the editor.

## Contents

1. Introduction
2. Conformance and Backwards Compatibility
3. Terminology
4. Document Structure
5. The Head Section
   5.1 Metadata
   5.2 Provenance
   5.3 Imports
   5.4 Terms
   5.5 Assumptions
   5.6 Takeaways
6. The Body Section
   6.1 Paragraphs and Prose
   6.2 Term References
   6.3 Claims
   6.4 Inferences
   6.5 Conflicts
   6.6 Evidence
   6.7 The mode attribute on `<claim>`
   6.8 The `<argument>` element
   6.9 Attributed claims and external references
   6.10 The same-as attribute
7. Element Reference
8. Attribute Reference
9. Identifier and Reference Resolution
10. Argumentation Schemes and Inference Patterns
11. Defeasibility and Conflict Types
12. Epistemic Markers
13. Reader Overlays
14. Lineage and Acknowledgements
15. References

Appendix A — RELAX NG Compact Schema (Informative)
Appendix B — Worked Example (Informative)

---

## 1. Introduction

### 1.1 Motivation

Discussion of philosophical, rationalist, and policy essays frequently stalls when participants disagree without first localizing the disagreement to a specific definition, premise, or inferential step. Two writers may dispute a conclusion at length before discovering they have been using key terms with materially different definitions, or that they agree on every premise but reject a single inferential move. The technique of _double-cruxing_ (CFAR; Sabien 2017) addresses this by asking each party to identify the most upstream claim on which their position depends — but performing this in practice requires that an essay's argumentative structure be visible enough to point at.

Existing argumentation formalisms (AIF, ASPIC+, Argdown, Carneades) provide rigorous machinery for representing argument graphs, but they typically require translating prose into a standalone formal artifact. ArgML takes the opposite stance: the formalization is an _annotation layer on the prose itself_, allowing authors to mark up the structure inline as they write, and allowing readers to point at any term, claim, assumption, or inference using a stable identifier.

### 1.2 Design Goals

ArgML is designed around the following goals:

1. **Annotation, not translation.** An ArgML document is readable as ordinary prose when its tags are stripped. The markup augments the text rather than replacing it.
2. **Identifier-addressable units.** Every term, claim, assumption, inference, and conflict carries a stable identifier within its document.
3. **Cross-document referencing.** A document may import structures defined in other ArgML documents and refer to them via namespace prefixes. This enables construction of corpus-wide argument graphs.
4. **Graduated formalization.** Authors mark up only what they wish to make explicit. Unmarked prose remains prose. There is no requirement that an entire document be formalized for any portion to be useful.
5. **Defeasibility as a first-class concept.** Inferences are marked strict or defeasible; conflict relations distinguish between rebutting a conclusion, undermining a premise, and undercutting an inference rule.

### 1.3 Non-Goals

ArgML is not a logic system. Marking an inference as `defeasible="false"` does not constitute a proof of validity; it asserts only the author's claim that the inference is intended deductively. ArgML is not a substitute for formal verification frameworks such as Lean or Isabelle/HOL, and provides no automated proof checking. ArgML does not aim to disambiguate every clause of natural-language prose; substantial portions of an ArgML document will remain unmarked.

### 1.4 Relationship to Prior Work

ArgML draws on five distinct traditions. The argument-graph ontology — informational nodes (claims) bridged by scheme nodes (inferences, conflicts) — derives from the Argument Interchange Format (Chesñevar et al. 2006; Reed et al.). The defeasibility model — strict vs defeasible rules, with rebutting, undermining, and undercutting attacks — derives from ASPIC+ (Modgil & Prakken 2013) and ultimately from Pollock (1987). The inline-markup posture — wrapping spans of prose with semantically meaningful tags rather than producing a parallel formal artifact — derives from the Text Encoding Initiative (TEI 1987–) and RDFa (W3C 2008). The cross-document reference mechanism — namespace prefixes binding short identifiers to external resources — derives from XML Namespaces (W3C 1999) and the document-amendment patterns of Akoma Ntoso and LegalRuleML (OASIS). The canonical-reference pattern for terms — distinguishing a local identifier from a globally canonical IRI — derives from SKOS (W3C 2009). Full lineage attribution is given in Section 14.

---

## 2. Conformance and Backwards Compatibility

A _conformant ArgML document_ is a well-formed XML document whose root element is `<post>` in the `urn:argml:v1` namespace, and which satisfies the structural and reference constraints described in this specification.

A _conformant ArgML processor_ is software that accepts conformant ArgML documents as input and processes them according to the semantics described in this specification, in particular:

- Resolves identifier references within a document.
- Resolves namespaced cross-document references via declared imports.
- Distinguishes elements appearing in the `<head>` (declarations) from those appearing in `<body>` (annotations on prose).
- Preserves all unmarked prose verbatim when rendering.

A _conformant ArgML 0.2 document_ is either:

1. A 0.1-conformant `<post>` document, optionally extended with any of the additions in §§5.2, 5.6, and 6.7–6.10; or
2. A `<reader-overlay>` document conformant to §13.

A _conformant ArgML 0.2 processor_ implements all of the above 0.1 processor requirements and additionally:

- Respects the `mode` attribute on `<claim>` when rendering and when evaluating reader-overlay attitudes.
- Inherits claim mode from enclosing `<argument>` elements when an inner `<claim>` does not specify its own.
- Resolves `same-as` references and treats co-referenced claims as the same graph node for propagation purposes.
- Implements at least the propagation semantics described in §13.5 when supplied a post and a reader-overlay.

Processors MAY ignore unknown `mode` values, unknown `pattern` values, unknown `priority` values, and unknown `type` values on `<generator>`; these vocabularies are intentionally open.

The keywords _MUST_, _MUST NOT_, _SHOULD_, _SHOULD NOT_, and _MAY_ in this specification are to be interpreted as described in RFC 2119.

---

## 3. Terminology

**Argument graph** — The directed graph induced by a document's claims (nodes) and the support, attack, and dependency relations among them (edges).

**Argument (element)** — A region of body content that supports a claim through dialectical means: a thought experiment, a case in an argument-by-cases, an extended attribution to another author. Distinct from a `<claim>`, which carries propositional commitment. The `<argument>` element is a first-class node in the argument graph but is restricted to the `supports` relation; it cannot attack. Refutation requires propositional commitment and belongs on `<claim>`.

**Assumption** — A proposition the author treats as foundational and does not argue for within the present document. Assumptions are id-addressable but semantically distinguished from claims by virtue of having no upstream support.

**Attitude** — A reader's recorded stance toward a target element. One of: _accept_, _reject_ (with a rejection-type parallel to ArgML's attack-type), or _open_ (the reader has explicitly not decided).

**Claim** — A proposition asserted by the author, marked inline with a `<claim>` element. Claims are I-nodes in AIF terms.

**Conflict** — A relation by which one claim attacks another. Conflicts come in three varieties: _rebut_ (attack on a conclusion), _undermine_ (attack on a premise), and _undercut_ (attack on an inference rule). This taxonomy follows ASPIC+ and ultimately Pollock (1987).

**Defeasible** — An inference is defeasible if the author intends it as presumptive rather than deductive. Defeasible inferences can be undercut without their premises being false.

**Double crux** — A protocol for localizing disagreement to a single shared upstream commitment (CFAR; Sabien 2017). ArgML's design is shaped by the goal of making such localization mechanically straightforward.

**Import** — A binding declared in the document head between a short prefix and an external document URL. Imports enable cross-document references via the syntax `prefix:identifier`.

**Inference** — A relation by which one or more claims support another claim. Inferences may be implicit (inferred from a `supports` attribute on a claim) or explicit (declared via an `<inference>` element).

**Mode** — The speech-act or discourse status of a claim: whether the author asserts it, supposes it hypothetically, attributes it to another party, restates it from elsewhere, anticipates it as an objection, concedes it, or assumes it as a target for reductio.

**Pattern** — The compositional logical shape of an inference (e.g., _modus ponens_, _reductio ad absurdum_, _argument by cases_). Distinct from _scheme_: pattern names how premises combine; scheme names the kind of informal reasoning deployed.

**Provenance entry** — A `<generator>` declaration in the head identifying the origin of one or more elements. Multiple entries accumulate; elements reference them by id.

**Reader overlay** — A document, separate from any `<post>`, recording a reader's attitudes toward claims, assumptions, and inferences in one or more imported posts. Used as input alongside a post to compute reader-state propagation.

**Substitution** — A reader's declared replacement of one term, assumption, or claim with another, applied when evaluating an imported post against the reader's overlay.

**Takeaway** — A claim within a document that the author identifies as an intended conclusion. Declared via `<takeaway>` in the head; addressed by reference to a claim `id`.

**Term** — A concept whose meaning is fixed for the duration of a document, either by reference to an external canonical definition or by an inline gloss. Terms have a _declaration_ (in the head) and zero or more _references_ (in the body).

---

## 4. Document Structure

Every ArgML document consists of a root `<post>` element containing exactly one `<head>` element followed by exactly one `<body>` element:

```xml
<post xmlns="urn:argml:v1" id="...">
  <head>
    <!-- metadata, imports, term declarations, assumption declarations -->
  </head>
  <body>
    <!-- prose annotated with inline term references, claims, etc. -->
  </body>
</post>
```

The `<head>` is purely declarative; it contains no prose intended for rendering. The `<body>` contains the document's prose, with semantic markup applied inline.

A second document type, `<reader-overlay>`, is defined in §13. A reader-overlay records reader attitudes against one or more imported posts; it is not itself a post.

---

## 5. The Head Section

### 5.1 Metadata

The `<metadata>` element contains bibliographic information about the document and an optional document-level epistemic status.

```xml
<metadata>
  <title>Morality without Consciousness</title>
  <author>IanWS</author>
  <date>2026-04-17</date>
  <source>https://www.lesswrong.com/posts/bWuhKA8bhsPGN7zRJ/morality-without-consciousness</source>
  <epistemic-status>Considered but speculative; I am not a philosopher of mind
    by training.</epistemic-status>
</metadata>
```

The `<epistemic-status>` element provides a coarse, document-level hedge in the tradition of the _Slate Star Codex_ "Epistemic Status:" preamble. It is non-normative and does not propagate to individual claims. Per-claim and per-inference epistemic markers are specified in Section 12.

### 5.2 Provenance

The `<provenance>` element appears in `<head>` before `<imports>`. It contains zero or more `<generator>` elements, each declaring an entity that produced or reviewed material in the document:

```xml
<provenance>
  <generator id="g1" type="llm" model="claude-opus-4.7"
             date="2026-05-11" role="extractor"/>
  <generator id="g2" type="human" who="IanWS"
             date="2026-05-12" role="reviewer"/>
  <generator id="g3" type="human" who="IanWS"
             date="2026-04-17" role="original-author"/>
</provenance>
```

Attributes on `<generator>`:

- `id` — required; unique within the document.
- `type` — one of `human`, `llm`, `automated`. Open vocabulary.
- `who` — required for `type="human"`; identifies the person.
- `model` — required for `type="llm"`; identifies the model and version.
- `date` — ISO 8601 date.
- `role` — RECOMMENDED values: `original-author`, `extractor`, `reviewer`, `editor`. Open vocabulary.

Elements that MAY carry a `provenance` attribute: `<claim>`, `<inference>`, `<conflict>`, `<term>` (declaration), `<assumption>`, `<takeaway>`. The attribute takes a space-separated list of `<generator>` ids in order of contribution:

```xml
<claim id="C3.6" provenance="g1 g2" credence="considered">
  A physicalist's best guess should be that consciousness is somehow
  intrinsic to neurophysiology.
</claim>
```

This indicates the claim was initially extracted by `g1` (an LLM pass) and subsequently reviewed by `g2` (a human reviewer).

`<provenance>` is OPTIONAL. Its absence indicates no recorded provenance. Processors MUST NOT infer provenance from author metadata.

Lineage: W3C PROV-O (Lebo, Sahoo, McGuinness, et al., W3C Recommendation, 2013); Schema.org's `Author` and `creator` properties (Schema.org Community Group); PREMIS (Library of Congress) for digital preservation provenance. The compact `<generator>`/`provenance` design follows PROV-O's distinction between agents and the activities they perform on entities, simplified for the single-document case.

### 5.3 Imports

The `<imports>` element binds prefixes to external documents. Once an import is declared, claims, terms, and assumptions in the imported document become referenceable via `prefix:identifier` syntax.

```xml
<imports>
  <import prefix="linch"
          doc="https://www.lesswrong.com/posts/qfitpqvQzeZy2mSGi/the-fourth-world"/>
  <import prefix="seq"
          doc="https://www.lesswrong.com/s/FqgKAHZAiZn9JAjDo"/>
  <import prefix="sep" doc="https://plato.stanford.edu/entries/"/>
</imports>
```

A processor MAY fetch and validate imported documents to resolve cross-document references. It MUST NOT block document rendering on import failure; unresolved cross-document references SHOULD be rendered with a visible indicator.

### 5.4 Terms

The `<terms>` element contains declarations of every term used in the body via `<term ref="...">`.

```xml
<terms>
  <term id="consciousness" canonical="sep:consciousness">
    <gloss>Phenomenal consciousness — the "hard problem", qualia.</gloss>
    <alias>phenomenal consciousness</alias>
    <alias>qualia</alias>
    <alias>the hard problem</alias>
  </term>
  <term id="preference" scope="local">
    <gloss>An entity's expressed interest counter to the second law of thermodynamics.</gloss>
  </term>
</terms>
```

A term declaration has a local identifier (`id`), an optional canonical reference (`canonical`) to an external authoritative definition, an optional `<gloss>` providing an inline definition, and zero or more `<alias>` elements enumerating surface forms the term may take in the body.

If a term has a `canonical` reference and no `<gloss>`, its meaning is taken to be whatever the canonical source defines. If both are present, the `<gloss>` SHOULD be understood as the author's working interpretation, which a reader may compare against the canonical definition.

The `scope` attribute MAY be set to `"local"` to indicate that the term's definition applies only within this document; in the absence of this attribute, the term is understood as referring to the canonical concept.

### 5.5 Assumptions

The `<assumptions>` element contains foundational commitments the author treats as axiomatic within the document.

```xml
<assumptions>
  <assumption id="A1">I have phenomenal experience.</assumption>
  <assumption id="A2" rests-on="seq:basic-physicalism">
    The physical world is causally closed.
  </assumption>
</assumptions>
```

An assumption MAY itself rest on an imported claim or assumption via `rests-on`. This permits a chain of justification that bottoms out either in a genuinely undefended axiom or in an imported structure outside the document.

### 5.6 Takeaways

The `<takeaways>` element appears in `<head>` after `<assumptions>`. It contains zero or more `<takeaway>` elements, each of which references a claim by `id` and SHOULD assign it a priority:

```xml
<takeaways>
  <takeaway ref="C6.7" priority="primary"/>
  <takeaway ref="C4.9" priority="secondary"/>
  <takeaway ref="C3.6" priority="load-bearing"/>
</takeaways>
```

The RECOMMENDED `priority` vocabulary:

| Value          | Sense                                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `primary`      | A principal conclusion of the document. The author would describe the document as defending this claim.                                                 |
| `secondary`    | An important conclusion downstream of the main argument but not the central terminal node.                                                              |
| `load-bearing` | A claim that, if rejected, would invalidate the bulk of the downstream argument. The structural equivalent of an `<epistemic-status>` author admission. |

Processors SHOULD treat unknown priority values as opaque. A claim MAY be referenced by multiple `<takeaway>` elements (e.g., both `primary` and `load-bearing`).

`<takeaways>` is OPTIONAL. Its absence indicates that the author has not identified any specific claims as intended takeaways; processors SHOULD NOT infer takeaways from graph topology.

Lineage: scholarly abstract conventions; IMRaD structure; the "Key Findings" and "Headline Results" sections common in policy and scientific writing. ArgML's structural identification of takeaways replaces what is conventionally inferred by readers from prose abstracts.

---

## 6. The Body Section

### 6.1 Paragraphs and Prose

The `<body>` element contains prose organized into paragraphs (`<p>`) and optional section headings (`<section>` with a `<heading>` child). Other inline HTML-like markup (`<em>`, `<strong>`, `<code>`, `<a>`) is permitted but is treated as presentational by the ArgML semantics layer.

### 6.2 Term References

A term is referenced inline by wrapping its surface form in a `<term ref="...">` element:

```xml
<p>The author assumes that we could not explain
<term ref="consciousness">consciousness</term> through
<term ref="physicalism">physicalism</term>.</p>
```

The `ref` attribute MUST match the `id` of a term declared in the document head, or a `prefix:id` cross-document reference. The text content of the `<term>` element is the surface form as it appears in the prose; it MAY differ from any alias declared in the head (e.g., the alias may be `"qualia"` but the surface form in this particular sentence is `"the qualia of red"`).

### 6.3 Claims

A claim is asserted by wrapping the asserting sentence or clause in a `<claim>` element:

```xml
<p><claim id="C3" supports="C5" defeasible="true">Our experience of pain is by
definition inseparable from the pain reaction itself.</claim></p>
```

Attributes on `<claim>`:

- `id` — required; unique within the document.
- `supports` — space-separated list of claim identifiers this claim provides support for.
- `attacks` — space-separated list of claim identifiers this claim attacks. The kind of attack is given by `attack-type`; default is `rebut`.
- `attack-type` — one of `rebut`, `undermine`, `undercut`. See Section 11.
- `rests-on` — space-separated list of assumption or imported-claim identifiers this claim depends on without arguing for.
- `via` — identifier of an explicit `<inference>` element that licenses the support or attack. Optional; when absent, an implicit defeasible inference is assumed.
- `defeasible` — `"true"` (default) or `"false"`. Indicates whether the author intends the support relation as deductive.
- `scheme` — optional; names the argumentation scheme. See Section 10.
- `credence` — optional; the author's degree of belief in the proposition. Qualitative bucket or numeric value in [0, 1]. See Section 12.
- `mode` — optional; the speech-act or discourse status of the claim. Default `asserted`. See §6.7.
- `attributed-to` — optional; the party to whom an attributed claim is ascribed. See §6.9.
- `same-as` — optional; identifier of a claim expressing the same proposition. Required when `mode="restated"`. See §6.10.
- `source` — optional; URL or identifier of an external source for an attributed claim. See §6.9.
- `provenance` — optional; space-separated list of generator identifiers. See §5.2.

### 6.4 Inferences

When the author wishes to name the inference rule licensing a support or attack relation, to attach a warrant in prose, or to bundle multiple premises into a single inference, an explicit `<inference>` element is used:

```xml
<inference id="I2" from="C1 C2" to="C3"
           scheme="inference-to-best-explanation"
           defeasible="true">
  An intrinsic theory requires less deviation from contemporary neuroscience
  and sidesteps the problems of epiphenomenalism.
</inference>
```

Attributes on `<inference>`:

- `id` — required; unique within the document.
- `from` — required; space-separated list of premise identifiers (claims or assumptions).
- `to` — required; identifier of the supported claim.
- `scheme` — optional; names the argumentation scheme.
- `pattern` — optional; the compositional logical shape of the inference. See §10.2.
- `defeasible` — `"true"` (default) or `"false"`.
- `strength` — optional; the author's confidence that the premises license the conclusion. Qualitative bucket or numeric value in [0, 1]. Distinct from `defeasible`: defeasibility is a type (presumptive vs deductive), strength is a degree. See Section 12.
- `provenance` — optional; space-separated list of generator identifiers. See §5.2.

The text content of the `<inference>` element, if any, is the _warrant_ — a natural-language gloss of why the premises license the conclusion.

When a claim's `supports` attribute names a target _and_ an explicit `<inference>` covers the same source–target pair, the explicit `<inference>` is the canonical record; the `supports` attribute MAY be omitted in this case.

### 6.5 Conflicts

Conflicts may be expressed implicitly via `attacks` on a `<claim>`, or explicitly via a `<conflict>` element. The explicit form is used when the author wishes to attach a structured response or note:

```xml
<conflict id="CF1" attack-type="undercut">
  <attacker idref="C12"/>
  <target idref="C5"/>
  <response>
    <p>The definition of <term ref="preference">preference</term> can be
    qualified by strength, reversibility, or negentropy thresholds.</p>
  </response>
</conflict>
```

### 6.6 Evidence

Empirical or testimonial support for a claim is marked with `<evidence>`, either inline within a claim or as a sibling:

```xml
<claim id="C1.2">This is a strong claim, one with which about half of surveyed
philosophers disagree<evidence type="survey"
ref="https://survey2020.philpeople.org"/>.</claim>
```

Attributes on `<evidence>`:

- `ref` — required; URL or `prefix:id` reference to the evidentiary source.
- `type` — optional; suggested values include `survey`, `experiment`, `testimony`, `citation`, `dataset`, `observation`.

### 6.7 The mode attribute on `<claim>`

A `<claim>` element MAY carry a `mode` attribute specifying its speech-act or discourse status:

```
mode = "asserted" | "supposed" | "attributed" | "restated"
     | "anticipated-objection" | "conceded" | "reductio-target"
```

The default is `asserted`, equivalent to 0.1 semantics. Modes:

| Value                   | Semantics                                                                                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `asserted`              | The author commits to the proposition. Default.                                                                                                            |
| `supposed`              | The author entertains the proposition hypothetically. Used for thought experiments and conditional scenarios. The author makes no commitment to the truth. |
| `attributed`            | The author attributes the proposition to a named external party (see §6.9). The author makes no commitment.                                                |
| `restated`              | A paraphrase of a claim introduced earlier in this or another document. MUST carry `same-as` (§6.10).                                                      |
| `anticipated-objection` | The author imagines an interlocutor making this claim. The author is reporting a view in order to address it, not endorsing it.                            |
| `conceded`              | The author grants the proposition for the sake of argument, typically as setup for showing it does not block the main argument.                            |
| `reductio-target`       | The proposition assumed for contradiction in a reductio ad absurdum argument. The author intends to demonstrate that this proposition cannot hold.         |

A claim's mode affects how reader-overlay attitudes apply. A reader rejecting an `asserted` claim is rejecting an author commitment. A reader rejecting an `anticipated-objection` claim is _agreeing_ with the author's portrayal of a weak position. Processors implementing propagation (§13.5) MUST take mode into account.

Two worked examples from "Morality without Consciousness" (IanWS, 2026):

The essay contains a compact reductio in the section "Phenomena are Intrinsic": _"Our experience of existence is phenomenal, so I don't see a way to refute the hard problem without asserting we are all already zombies (I experience, yet sadly I do not exist)."_ In 0.2:

```xml
<claim id="C3.1-target" mode="reductio-target">
  We are all already zombies (I experience, yet sadly I do not exist).
</claim>

<claim id="C3.1" mode="asserted" rests-on="A1"
       attacks="C3.1-target" attack-type="rebut"
       via="I-3.1-reductio">
  Our experience of existence is phenomenal.
</claim>
```

In "Generalizing Ethics with Preferences", the author writes _"You might be thinking that the real difference is the plant's response to light is entirely automatic, while we are deeply cognitive agents. You can't compare our preferences to those of a plant!"_ — this is an anticipated objection followed by an undercut. In 0.2:

```xml
<claim id="O4.1" mode="anticipated-objection"
       attacks="C4.5" attack-type="undercut">
  You can't compare our preferences to those of a plant — our response
  is cognitive, the plant's is automatic.
</claim>

<claim id="C4.7" mode="asserted"
       attacks="O4.1" attack-type="undercut">
  This overlooks how dumbly reactive a lot of preferences are, even if
  they are unclearly expressed.
</claim>
```

The objection commits to a specific proposition that attacks C4.5; the author's response attacks the objection back. Both moves are propositional. (For the canonical full pattern with C4.5 in context, see Appendix B.)

Lineage: TEI's typed structural regions (`<div type="...">`); AIF+'s locution-by-speaker model (Reed et al.), where each utterance carries its speaker as metadata; Discourse Representation Theory's nested boxes for subordinated discourse (Kamp, 1981; Heim, 1982); Walton's commitment-store model, where a claim's status depends on whose commitment store it inhabits.

### 6.8 The `<argument>` element

The `<argument>` element marks a region of body content that supports a claim through dialectical means — a thought experiment, a case in an argument-by-cases, an extended attribution to another author. It is a first-class node in the argument graph, but with a deliberately restricted role: an `<argument>` can support claims but cannot attack them. Refutation requires propositional commitment and belongs on `<claim>`; rhetorical work belongs here.

The restriction reflects a substantive principle. A thought experiment never refutes — it builds intuition for one position or another. The refutational work, if any, is done by an explicit proposition that the thought experiment helps the reader entertain. Forcing that proposition to appear as a `<claim>` (rather than being smuggled in via an `attacks` attribute on a region of prose) keeps the argument graph honest about what is actually being asserted.

`<argument>` does the same structural-region duty as a `<section>` — it groups prose and MAY set a default `mode` for any internal `<claim>` elements — but it adds participation in the argument graph as a unit, where a `<section>` is purely organizational.

#### 6.8.1 Mode and the dialectical-move vocabulary

The `mode` attribute on `<argument>` is required and names the kind of dialectical move the region performs. The RECOMMENDED vocabulary:

| `<argument mode="...">` | Default mode for contained claims | Use                                                       |
| ----------------------- | --------------------------------- | --------------------------------------------------------- |
| `thought-experiment`    | `supposed`                        | A hypothetical scenario constructed to expose intuitions. |
| `case`                  | `supposed`                        | One branch of an argument-by-cases.                       |
| `attributed`            | `attributed`                      | An extended attribution to another author or party.       |

The vocabulary is open; processors SHOULD treat unknown modes as opaque labels. Authors and tools MAY extend with values like `illustration` or `analogy` as conventions develop.

Argument modes are distinct from claim modes (§6.7) and serve a different purpose. A `<claim mode="...">` records the author's commitment level to a specific proposition; an `<argument mode="...">` records the type of dialectical move a region of prose performs. The two vocabularies are intentionally non-overlapping, though `attributed` appears in both with parallel meaning at different granularities.

#### 6.8.2 Support-only relations

`<argument>` carries the following relational attributes:

- `id` — identifier; required when the argument participates in the graph.
- `supports` — space-separated list of claim ids this argument provides support for.
- `rests-on` — assumption or imported-element ids the argument depends on (a scenario's setup may rest on background assumptions).
- `via` — identifier of an explicit `<inference>` element licensing the support.
- `attributed-to` — when `mode="attributed"`, the party to whom the argument is ascribed.
- `provenance` — generator references (§5.2).

There is no `attacks` attribute and no `attack-type`. To express disagreement with a claim, write a `<claim>` that attacks it; the `<argument>` may support the disagreeing claim, but the attack-work itself is propositional.

The c-particle thought experiment from "Phenomena are Intrinsic" supports the load-bearing claim that extrinsic views require an additional metaphysical substance:

```xml
<argument mode="thought-experiment" id="A-c-particle" supports="C3.5">
  <p>For an extrinsic example, imagine that there was an undetected
  particle of consciousness, the c-particle, which somehow interacted
  with neurophysiological processes. Phenomena are actually composed
  of c-particles. We might further suppose that c-particles come in
  many flavors. There is a c-particle of pain, a c-particle of
  happiness, etc. Mental states, as we understand them, are actually
  determined by c-particles.</p>
</argument>

<claim id="C3.5" mode="asserted" credence="confident">
  Any extrinsic view will require a mysterious "something else" to
  explain consciousness, which must then causally interact with our
  neurophysiology.
</claim>
```

The thought experiment is the region of prose; C3.5 is the propositional commitment it supports. The scenario itself doesn't refute extrinsic views — it builds intuition for C3.5, and C3.5 (a proposition with explicit content) is what carries any attack-work toward downstream positions.

The argument-by-cases for the dualism-as-semantics passage uses two case-arguments, each supporting the conclusion via the cases-inference:

```xml
<argument mode="case" id="A-case-soul" supports="C2.2">
  <p>Let us suppose that we learn consciousness is actually the
  emergence of a soul, dipping its head in from some heavenly plane
  of existence. We learn that all our physical laws are arbitrary and
  completely determined by the whim of God. In this extreme scenario,
  we concede dualism — mysticism, by definition.</p>
</argument>

<argument mode="case" id="A-case-higher-dim" supports="C2.2">
  <p>Let us suppose instead that we learn consciousness is the
  emergence of higher-dimensional reality within our own. That
  higher dimensional reality determines all the physical laws of our
  known universe. In this scenario, we expand our definition of
  physics to account for our new knowledge of reality; physicalism
  survives.</p>
</argument>

<inference id="I-2.2-cases"
           from="A-case-soul A-case-higher-dim" to="C2.2"
           pattern="argument-by-cases"
           defeasible="true" strength="strong"/>
```

Neither case-argument contains internal claims; the case as a region is the unit. Authors MAY introduce internal claims when they wish to make specific propositions individually addressable, but the spec does not require this — graduated formalization (per §1.2) means structure is added only where it earns its place.

#### 6.8.3 Attacks belong on claims

Two patterns that one might be tempted to express via `<argument>` belong elsewhere:

_Anticipated objections._ The plant-vs-cognitive objection genuinely attacks C4.5 — voicing it _is_ an attack. Under the support-only restriction it becomes a `<claim mode="anticipated-objection">`, with the attack expressed directly:

```xml
<claim id="O4.1" mode="anticipated-objection"
       attacks="C4.5" attack-type="undercut">
  You can't compare our preferences to those of a plant — our response
  is cognitive, the plant's is automatic.
</claim>

<claim id="C4.7" mode="asserted"
       attacks="O4.1" attack-type="undercut" credence="tentative">
  This overlooks how dumbly reactive a lot of preferences are, even
  if they are unclearly expressed.
</claim>
```

The objection commits to a specific proposition; the author commits to a counter-proposition. Both moves are propositional and both belong on `<claim>`.

_Reductio._ A reductio is a logical move, not a rhetorical one. It is captured by `pattern="reductio-ad-absurdum"` on `<inference>` (§10.2), with the supposition and the absurd consequence expressed as claims. No `<argument>` wrapping is needed.

#### 6.8.4 Composability

`<argument>` does not affect inference patterns, conflict relations, or term scoping. An `<inference>` element appearing inside an `<argument mode="thought-experiment">` does not have its conclusions automatically treated as supposed; the inference's `to` claim retains whatever mode it explicitly carries.

Arguments MAY nest. Mode inheritance for internal claims follows the nearest enclosing `<argument>`.

Lineage: Toulmin's _The Uses of Argument_ (1958), where "an argument" is a multi-part structured unit comprising data, warrant, backing, claim, qualifier, and rebuttal — ArgML's `<argument>` corresponds most closely to what Toulmin frames as the data-and-warrant region that supports a claim. Walton's argumentation schemes (Walton, Reed, and Macagno 2008), which type recurring patterns of presumptive support. Carneades' argument structures (Gordon, Prakken, and Walton 2007), where each argument is an instance of a scheme that contributes to or detracts from an issue. AIF's general principle that any argumentatively-significant unit is an addressable node (Chesñevar et al. 2006). TEI's typed structural regions (`<div type="...">`) for the markup pattern. The support-only restriction reflects the substantive position that rhetorical construction builds plausibility but does not refute, and that refutational moves require explicit propositional commitments — a position consonant with Walton's account of how schemes are challenged (via critical questions, which take the form of explicit claims, not via further schemes).

### 6.9 Attributed claims and external references

A claim with `mode="attributed"` represents a proposition the author attributes to another party. It SHOULD carry `attributed-to` (the party) and MAY carry `source` (a URL or canonical reference). It MAY carry `same-as` if the attributed claim corresponds to an identifiable claim in an ArgML-formatted external document.

```xml
<claim id="L1" mode="attributed" attributed-to="Linch"
       source="https://www.lesswrong.com/posts/qfitpqvQzeZy2mSGi/the-fourth-world"
       same-as="linch:no-physicalism">
  Consciousness cannot be explained through physicalism.
</claim>
```

This pattern subsumes the role of a separate "external claim" element. It also addresses the unresolved-import problem in 0.1: when an imported document is not in ArgML format (the common case), an attributed claim provides inline text content that stands on its own. The `same-as` attribute records the intended cross-reference for the day the imported document is marked up.

The opening of "Morality without Consciousness" illustrates the typical pattern. The author writes: _"A recent post, 'The Fourth World,' gets at an important implication of consciousness — namely, that we ought to suspect further aspects of reality than we can today observe — but I'm not sure it arrives there the right way."_ This restates Linch's position before engaging with it:

```xml
<claim id="L0" mode="attributed" attributed-to="Linch"
       source="https://www.lesswrong.com/posts/qfitpqvQzeZy2mSGi/the-fourth-world"
       same-as="linch:fourth-world-thesis">
  Consciousness implies that we ought to suspect further aspects of
  reality than we can today observe.
</claim>

<claim id="C1.6" mode="asserted" supports="L0" credence="confident">
  I would like to defend this conclusion while rejecting the path the
  author takes to it.
</claim>
```

C1.6 supports the attributed claim L0, recording the unusual structure where the author endorses a conclusion but disputes its derivation — a pattern impossible to encode cleanly in 0.1.

### 6.10 The same-as attribute

The `same-as` attribute on `<claim>` identifies the claim as expressing the same proposition as another claim, within or across documents:

```xml
<claim id="C6.2" mode="restated" same-as="C3.6" supports="C6.3">
  A physicalist's best guess should be that consciousness is somehow
  intrinsic to neurophysiology, otherwise we have to make strange
  ontological and scientific conclusions (like c-particles).
</claim>
```

This addresses the Recap problem evident in the existing conversion of "Morality without Consciousness": claims C6.1 through C6.7 in the Recap section are restatements of earlier claims, but in 0.1 they appear as fresh nodes, fragmenting the argument graph and inflating apparent node count.

`same-as` accepts a local id or a `prefix:id` cross-document reference. Two claims with `same-as` references to each other, or transitively to the same target, are treated as the same graph node for the purposes of reader-overlay propagation: a reader's attitude toward one applies to all.

`same-as` is independent of `mode`. A claim with `mode="restated"` MUST carry `same-as`; a claim with `same-as` MAY carry any mode (e.g., a restatement may itself be marked as `anticipated-objection` if the author is restating an objection raised earlier).

Lineage: SKOS's `skos:exactMatch` and `skos:closeMatch` (Miles and Bechhofer, 2009); OWL's `owl:sameAs` (W3C 2004). The local-id flavor mirrors the established XML practice of `IDREF` cross-references.

---

## 7. Element Reference

This section provides a synopsis of every element in the ArgML vocabulary. Elements are listed alphabetically.

### `<alias>`

| Field         | Value                              |
| ------------- | ---------------------------------- |
| Appears in    | `<term>` (declaration)             |
| Content model | Text                               |
| Attributes    | None                               |
| Lineage       | TEI `<form>`; SKOS `skos:altLabel` |

Declares a surface form that may appear in the body and should be treated as referring to the enclosing term.

### `<argument>`

| Field         | Value                                                                                                                                                                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Appears in    | `<body>`, `<section>`, `<argument>` (nested)                                                                                                                                                                                                     |
| Content model | Prose (`<p>`, `<section>`, `<argument>`, inline elements)                                                                                                                                                                                        |
| Attributes    | `mode` (required), `id`, `supports`, `rests-on`, `via`, `attributed-to`, `provenance`                                                                                                                                                            |
| Lineage       | Toulmin (1958) "an argument" as multi-part unit; Walton, Reed, and Macagno (2008) argumentation schemes; Carneades argument structures (Gordon, Prakken, and Walton 2007); AIF addressable nodes (Chesñevar et al. 2006); TEI `<div type="...">` |

### `<assumption>`

| Field         | Value                                       |
| ------------- | ------------------------------------------- |
| Appears in    | `<assumptions>`                             |
| Content model | Text, optional `<note>`                     |
| Attributes    | `id` (required), `rests-on`, `provenance`   |
| Lineage       | AIF I-node; Pollock's "prima facie" reasons |

Declares a proposition the author treats as foundational within the document.

### `<assumptions>`

| Field         | Value                                |
| ------------- | ------------------------------------ |
| Appears in    | `<head>`                             |
| Content model | Zero or more `<assumption>` elements |
| Attributes    | None                                 |

Container for assumption declarations.

### `<attitude>`

| Field         | Value                                                                               |
| ------------- | ----------------------------------------------------------------------------------- |
| Appears in    | `<attitudes>`                                                                       |
| Content model | Text (the reader's note)                                                            |
| Attributes    | `target` (required), `kind` (required), `rejection-type`, `credence`                |
| Lineage       | W3C Web Annotation (2017); Hypothes.is annotation model; ASPIC+ rejection semantics |

### `<attitudes>`

| Field         | Value                              |
| ------------- | ---------------------------------- |
| Appears in    | `<reader-overlay>`                 |
| Content model | Zero or more `<attitude>` elements |
| Attributes    | None                               |

### `<author>`

| Field         | Value        |
| ------------- | ------------ |
| Appears in    | `<metadata>` |
| Content model | Text         |
| Attributes    | None         |

### `<body>`

| Field         | Value                                                |
| ------------- | ---------------------------------------------------- |
| Appears in    | `<post>`                                             |
| Content model | Prose: `<section>`, `<p>`, and inline ArgML elements |
| Attributes    | None                                                 |

### `<claim>`

| Field         | Value                                                                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Appears in    | `<body>` (inline within prose)                                                                                                                                           |
| Content model | Mixed: text, `<term>`, `<evidence>`, inline presentational markup                                                                                                        |
| Attributes    | `id` (required), `supports`, `attacks`, `attack-type`, `rests-on`, `via`, `defeasible`, `scheme`, `credence`, `mode`, `attributed-to`, `same-as`, `source`, `provenance` |
| Lineage       | AIF I-node; ASPIC+ conclusion of a defeasible rule                                                                                                                       |

Wraps the prose asserting a proposition. The text content of the element _is_ the claim's natural-language statement.

### `<conflict>`

| Field         | Value                                                       |
| ------------- | ----------------------------------------------------------- |
| Appears in    | `<body>`                                                    |
| Content model | `<attacker>`, `<target>`, optional `<response>`             |
| Attributes    | `id` (required), `attack-type`, `provenance`                |
| Lineage       | AIF CA-node (Conflict Application); ASPIC+ attack relations |

### `<date>`

| Field         | Value         |
| ------------- | ------------- |
| Appears in    | `<metadata>`  |
| Content model | ISO 8601 date |
| Attributes    | None          |

### `<epistemic-status>`

| Field         | Value                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------- |
| Appears in    | `<metadata>`                                                                             |
| Content model | Text, with limited inline markup                                                         |
| Attributes    | None                                                                                     |
| Lineage       | _Slate Star Codex_ / _Astral Codex Ten_ document-preamble convention (Alexander, ~2014–) |

A coarse, document-level hedge about how settled or speculative the author considers the document as a whole. Non-normative; does not propagate to claims.

### `<evidence>`

| Field         | Value                                                       |
| ------------- | ----------------------------------------------------------- |
| Appears in    | `<claim>`, `<body>`                                         |
| Content model | Empty, or `<gloss>`                                         |
| Attributes    | `ref` (required), `type`                                    |
| Lineage       | Walton's "argument from evidence" scheme; AIF I-node typing |

### `<generator>`

| Field         | Value                                                              |
| ------------- | ------------------------------------------------------------------ |
| Appears in    | `<provenance>`                                                     |
| Content model | Empty                                                              |
| Attributes    | `id` (required), `type`, `who`, `model`, `date`, `role`            |
| Lineage       | W3C PROV-O (2013); Schema.org `Author`; PREMIS preservation events |

### `<gloss>`

| Field         | Value                                 |
| ------------- | ------------------------------------- |
| Appears in    | `<term>`, `<evidence>`                |
| Content model | Text, with limited inline markup      |
| Attributes    | None                                  |
| Lineage       | TEI `<gloss>`; SKOS `skos:definition` |

A short natural-language definition or explanatory note.

### `<head>`

| Field         | Value                                                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Appears in    | `<post>`                                                                                                                                          |
| Content model | `<metadata>`, optional `<provenance>`, optional `<imports>`, optional `<terms>`, optional `<assumptions>`, optional `<takeaways>` (in that order) |
| Attributes    | None                                                                                                                                              |

### `<heading>`

| Field         | Value                            |
| ------------- | -------------------------------- |
| Appears in    | `<section>`                      |
| Content model | Text, with limited inline markup |
| Attributes    | `level` (1–6)                    |

### `<import>`

| Field         | Value                                                 |
| ------------- | ----------------------------------------------------- |
| Appears in    | `<imports>`                                           |
| Content model | Empty                                                 |
| Attributes    | `prefix` (required), `doc` (required)                 |
| Lineage       | XML Namespaces (W3C 1999); LegalRuleML modular import |

### `<imports>`

| Field         | Value                            |
| ------------- | -------------------------------- |
| Appears in    | `<head>`, `<reader-overlay>`     |
| Content model | Zero or more `<import>` elements |
| Attributes    | None                             |

### `<inference>`

| Field         | Value                                                                                                            |
| ------------- | ---------------------------------------------------------------------------------------------------------------- |
| Appears in    | `<body>`                                                                                                         |
| Content model | Optional text (the warrant)                                                                                      |
| Attributes    | `id` (required), `from` (required), `to` (required), `scheme`, `pattern`, `defeasible`, `strength`, `provenance` |
| Lineage       | AIF RA-node (Rule of Inference Application); ASPIC+ defeasible rule; Toulmin's "warrant"                         |

### `<metadata>`

| Field         | Value                                                                      |
| ------------- | -------------------------------------------------------------------------- |
| Appears in    | `<head>`                                                                   |
| Content model | `<title>`, `<author>`, `<date>`, `<source>`, optional `<epistemic-status>` |
| Attributes    | None                                                                       |

### `<note>`

| Field         | Value                            |
| ------------- | -------------------------------- |
| Appears in    | Any structural element           |
| Content model | Text, with limited inline markup |
| Attributes    | `status` (optional)              |

Author commentary not part of the argumentative content. The `status` attribute MAY take values such as `acknowledged-open`, `defer`, `editorial`.

### `<p>`

| Field         | Value                               |
| ------------- | ----------------------------------- |
| Appears in    | `<body>`, `<section>`, `<response>` |
| Content model | Mixed prose                         |
| Attributes    | None                                |

### `<post>`

| Field         | Value                                               |
| ------------- | --------------------------------------------------- |
| Appears in    | Document root                                       |
| Content model | `<head>` then `<body>`                              |
| Attributes    | `xmlns` (required, `urn:argml:v1`), `id` (required) |

### `<provenance>`

| Field         | Value                               |
| ------------- | ----------------------------------- |
| Appears in    | `<head>`                            |
| Content model | Zero or more `<generator>` elements |
| Attributes    | None                                |

### `<reader-overlay>`

| Field         | Value                                                                                         |
| ------------- | --------------------------------------------------------------------------------------------- |
| Appears in    | Document root                                                                                 |
| Content model | `<imports>`, optional `<attitudes>`, optional `<substitutions>`                               |
| Attributes    | `xmlns` (required), `reader` (required), `updated`                                            |
| Lineage       | W3C Web Annotation Data Model (2017); xAIF interchange format; Hypothes.is annotation overlay |

### `<response>`

| Field         | Value                             |
| ------------- | --------------------------------- |
| Appears in    | `<conflict>`                      |
| Content model | Prose (`<p>` and inline elements) |
| Attributes    | None                              |

The author's reply to an attack. The prose may itself contain claims that are part of the document's argument graph.

### `<section>`

| Field         | Value                            |
| ------------- | -------------------------------- |
| Appears in    | `<body>`, `<section>` (nested)   |
| Content model | Optional `<heading>`, then prose |
| Attributes    | `id` (optional)                  |

### `<source>`

| Field         | Value        |
| ------------- | ------------ |
| Appears in    | `<metadata>` |
| Content model | URL          |
| Attributes    | None         |

### `<substitution>`

| Field         | Value                                                |
| ------------- | ---------------------------------------------------- |
| Appears in    | `<substitutions>`                                    |
| Content model | Text (the reader's note explaining the substitution) |
| Attributes    | `target` (required), `use` (required)                |
| Lineage       | SKOS `skos:exactMatch`; OWL `owl:sameAs`             |

### `<substitutions>`

| Field         | Value                                  |
| ------------- | -------------------------------------- |
| Appears in    | `<reader-overlay>`                     |
| Content model | Zero or more `<substitution>` elements |
| Attributes    | None                                   |

### `<takeaway>`

| Field         | Value                                                                           |
| ------------- | ------------------------------------------------------------------------------- |
| Appears in    | `<takeaways>`                                                                   |
| Content model | Empty                                                                           |
| Attributes    | `ref` (required), `priority`, `provenance`                                      |
| Lineage       | Scholarly abstract conventions; IMRaD structure; "key findings" policy template |

### `<takeaways>`

| Field         | Value                              |
| ------------- | ---------------------------------- |
| Appears in    | `<head>`                           |
| Content model | Zero or more `<takeaway>` elements |
| Attributes    | None                               |

### `<term>` (declaration form)

| Field         | Value                                               |
| ------------- | --------------------------------------------------- |
| Appears in    | `<terms>`                                           |
| Content model | Optional `<gloss>`, zero or more `<alias>`          |
| Attributes    | `id` (required), `canonical`, `scope`, `provenance` |
| Lineage       | SKOS Concept; TEI `<term>`                          |

### `<term>` (reference form)

| Field         | Value                                                 |
| ------------- | ----------------------------------------------------- |
| Appears in    | `<body>` (inline within prose)                        |
| Content model | Text (the surface form as it appears in the sentence) |
| Attributes    | `ref` (required)                                      |
| Lineage       | RDFa property reference; TEI inline term reference    |

### `<terms>`

| Field         | Value                              |
| ------------- | ---------------------------------- |
| Appears in    | `<head>`                           |
| Content model | Zero or more `<term>` declarations |
| Attributes    | None                               |

### `<title>`

| Field         | Value        |
| ------------- | ------------ |
| Appears in    | `<metadata>` |
| Content model | Text         |
| Attributes    | None         |

---

## 8. Attribute Reference

This section enumerates attributes that recur across multiple elements, listed alphabetically.

| Attribute        | Appears on                                                                                                                  | Type                                                              | Description                                                                                                                                                                                           |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `attack-type`    | `<claim>`, `<conflict>`                                                                                                     | `rebut` \| `undermine` \| `undercut`                              | Kind of attack. Default `rebut`. See Section 11.                                                                                                                                                      |
| `attacks`        | `<claim>`                                                                                                                   | Space-separated id list                                           | Claims this claim attacks.                                                                                                                                                                            |
| `attributed-to`  | `<claim>`, `<argument>`                                                                                                     | String                                                            | Party to whom an attributed claim or argument is ascribed.                                                                                                                                            |
| `canonical`      | `<term>` (decl)                                                                                                             | URL or `prefix:id`                                                | Globally canonical definition of the concept.                                                                                                                                                         |
| `credence`       | `<claim>`, `<attitude>`                                                                                                     | Bucket or numeric                                                 | Author's (or reader's) degree of belief in the proposition. See Section 12.                                                                                                                           |
| `defeasible`     | `<claim>`, `<inference>`                                                                                                    | `true` \| `false`                                                 | Whether the inference is intended deductively. Default `true`.                                                                                                                                        |
| `doc`            | `<import>`                                                                                                                  | URL                                                               | URL of the imported document.                                                                                                                                                                         |
| `from`           | `<inference>`                                                                                                               | Space-separated id list                                           | Premise claims or assumptions.                                                                                                                                                                        |
| `id`             | `<post>`, `<claim>`, `<inference>`, `<conflict>`, `<term>` (decl), `<assumption>`, `<section>`, `<argument>`, `<generator>` | Unique identifier                                                 | Local identifier; MUST be unique within the document.                                                                                                                                                 |
| `kind`           | `<attitude>`                                                                                                                | `accept` \| `reject` \| `open`                                    | The reader's stance toward the target.                                                                                                                                                                |
| `level`          | `<heading>`                                                                                                                 | Integer 1–6                                                       | Heading depth.                                                                                                                                                                                        |
| `mode`           | `<claim>`, `<argument>`                                                                                                     | Mode vocabulary (see §6.7 for `<claim>`; §6.8.1 for `<argument>`) | Speech-act / discourse status on `<claim>` (default `asserted`); dialectical-move type on `<argument>` (required). The two vocabularies are distinct.                                                 |
| `model`          | `<generator>`                                                                                                               | String                                                            | LLM generator's model identifier.                                                                                                                                                                     |
| `pattern`        | `<inference>`                                                                                                               | Pattern vocabulary (see §10.2)                                    | Compositional logical shape. Orthogonal to `scheme`.                                                                                                                                                  |
| `prefix`         | `<import>`                                                                                                                  | NCName                                                            | Short prefix bound to an imported document.                                                                                                                                                           |
| `priority`       | `<takeaway>`                                                                                                                | `primary` \| `secondary` \| `load-bearing` (open)                 | Author's classification of the takeaway's argumentative role.                                                                                                                                         |
| `provenance`     | `<claim>`, `<inference>`, `<conflict>`, `<term>` (decl), `<assumption>`, `<takeaway>`, `<argument>`                         | Space-separated list of `<generator>` ids                         | Provenance chain for this element, in order of contribution.                                                                                                                                          |
| `reader`         | `<reader-overlay>`                                                                                                          | String                                                            | Identifier for the reader authoring the overlay.                                                                                                                                                      |
| `ref`            | `<term>` (ref), `<evidence>`, `<takeaway>`                                                                                  | Identifier or `prefix:id`                                         | Reference to a declaration in the head, an imported document, or (for `<takeaway>`) a claim in the same document.                                                                                     |
| `rejection-type` | `<attitude>`                                                                                                                | `rebut` \| `undermine` \| `undercut`                              | When `kind="reject"`, the type of rejection. Parallels `attack-type` on `<conflict>` (Section 11).                                                                                                    |
| `rests-on`       | `<claim>`, `<assumption>`, `<argument>`                                                                                     | Space-separated id list                                           | Assumptions or imported claims relied upon without local argument.                                                                                                                                    |
| `role`           | `<generator>`                                                                                                               | `original-author` \| `extractor` \| `reviewer` \| `editor` (open) | Contribution role.                                                                                                                                                                                    |
| `same-as`        | `<claim>`                                                                                                                   | Identifier or `prefix:id`                                         | Reference to a claim expressing the same proposition. Required when `mode="restated"`.                                                                                                                |
| `scheme`         | `<claim>`, `<inference>`                                                                                                    | Scheme name (string)                                              | Names an argumentation scheme. See §10.1.                                                                                                                                                             |
| `scope`          | `<term>` (decl)                                                                                                             | `local` \| absent                                                 | If `local`, definition applies only within this document.                                                                                                                                             |
| `source`         | `<claim>`                                                                                                                   | URL                                                               | External source for an attributed claim, when distinct from an importable ArgML document.                                                                                                             |
| `status`         | `<note>`                                                                                                                    | String                                                            | Free-form status marker (e.g. `acknowledged-open`).                                                                                                                                                   |
| `strength`       | `<inference>`                                                                                                               | Bucket or numeric                                                 | Author's confidence that premises license conclusion. See Section 12.                                                                                                                                 |
| `supports`       | `<claim>`, `<argument>`                                                                                                     | Space-separated id list                                           | Claims this claim or argument supports.                                                                                                                                                               |
| `target`         | `<attitude>`, `<substitution>`                                                                                              | `prefix:id`                                                       | The element in an imported post being addressed.                                                                                                                                                      |
| `to`             | `<inference>`                                                                                                               | Identifier                                                        | Conclusion claim.                                                                                                                                                                                     |
| `type`           | `<evidence>`, `<generator>`                                                                                                 | String (open vocabulary)                                          | On `<evidence>`: kind of evidence (`survey`, `experiment`, `testimony`, `citation`, `dataset`, `observation`, or other). On `<generator>`: kind of generator (`human`, `llm`, `automated`, or other). |
| `updated`        | `<reader-overlay>`                                                                                                          | ISO 8601 date                                                     | Most recent revision date.                                                                                                                                                                            |
| `use`            | `<substitution>`                                                                                                            | `prefix:id`                                                       | The replacement element used in place of the target.                                                                                                                                                  |
| `via`            | `<claim>`, `<argument>`                                                                                                     | Inference id                                                      | Names the inference rule licensing this claim's or argument's support or attack.                                                                                                                      |
| `who`            | `<generator>`                                                                                                               | String                                                            | Human generator's identifier.                                                                                                                                                                         |

The 0.1 attributes `attacks` and `attack-type` do NOT extend to `<argument>` — refutational relations remain confined to `<claim>` (§6.8.3).

---

## 9. Identifier and Reference Resolution

### 9.1 Local Identifiers

Every identifier-bearing element MUST have an `id` attribute unique within the document. Identifiers SHOULD use ASCII letters, digits, hyphen, and period. Recommended conventions: `C1`, `C2.3` for claims; `A1`, `A2` for assumptions; `I1` for inferences; `CF1` for conflicts.

### 9.2 Cross-Document References

A cross-document reference takes the form `prefix:identifier`, where `prefix` is bound to a document URL by an `<import>` element in the head. A processor MUST:

1. Look up the prefix in the `<imports>` block.
2. Fetch the imported document (or use a cached copy).
3. Locate the element with the given identifier.
4. Resolve to that element.

If the prefix is undeclared, the reference is malformed. If the imported document cannot be fetched, the reference is _unresolved_ but the document is still conformant; processors SHOULD render unresolved references with a visible indicator.

### 9.3 Transitive Resolution

A processor MAY transitively resolve imports (i.e., if document A imports document B, and B's resolved structures themselves reference document C, the processor may follow). Transitive resolution is OPTIONAL and processors SHOULD provide a configuration limit on depth.

---

## 10. Argumentation Schemes and Inference Patterns

### 10.1 Argumentation Schemes

The `scheme` attribute on `<claim>` and `<inference>` MAY name an argumentation scheme — a named, recurring pattern of defeasible inference together with its characteristic critical questions. ArgML does not mandate a scheme vocabulary, but RECOMMENDS the Walton catalogue (Walton, Reed, and Macagno 2008) as the default. Common scheme names include:

| Scheme name                      | Description                                                                       |
| -------------------------------- | --------------------------------------------------------------------------------- |
| `argument-from-expert-opinion`   | Inference based on testimony of a domain expert.                                  |
| `argument-from-analogy`          | Inference from a similar case to the present one.                                 |
| `argument-from-example`          | Generalization from an illustrative instance.                                     |
| `argument-from-consequences`     | Inference from the consequences of an action or belief.                           |
| `inference-to-best-explanation`  | Abductive inference: a hypothesis is supported because it best explains the data. |
| `argument-from-sign`             | Inference from a correlated indicator.                                            |
| `argument-from-popular-opinion`  | Inference from widespread acceptance.                                             |
| `argument-from-cause-to-effect`  | Causal inference forward in time.                                                 |
| `argument-from-position-to-know` | Inference based on someone's epistemic position.                                  |

Authors and tools MAY extend this vocabulary. Unknown schemes SHOULD be treated as opaque labels rather than as errors.

### 10.2 Inference Patterns

The `scheme` attribute names an _argumentation scheme_ — a recurring informal-reasoning pattern from the Walton catalogue, oriented toward _what kind_ of inference is deployed (argument from analogy, inference to best explanation, argument from sign). The `pattern` attribute on `<inference>` names the _compositional logical shape_ — _how_ premises combine — drawn from the natural-deduction tradition.

The two attributes are orthogonal. A given inference may bear both:

```xml
<inference id="I-3.1" from="C3.5 C3.7 C3.8" to="C3.6"
           scheme="inference-to-best-explanation"
           pattern="conjunction-of-premises"
           defeasible="true" strength="moderate">
  An intrinsic theory requires less deviation from contemporary
  neuroscience (C3.7) and sidesteps the problems of epiphenomenalism
  (C3.8); together with the cost of any extrinsic view (C3.5), these
  jointly support intrinsic over extrinsic as the best explanation.
</inference>
```

The RECOMMENDED `pattern` vocabulary:

| Pattern                      | Shape                                                                            |
| ---------------------------- | -------------------------------------------------------------------------------- |
| `modus-ponens`               | From P and P → Q, conclude Q.                                                    |
| `modus-tollens`              | From P → Q and ¬Q, conclude ¬P.                                                  |
| `reductio-ad-absurdum`       | Assume P; derive ⊥ or a claim contradicting an accepted commitment; conclude ¬P. |
| `argument-by-cases`          | From P ∨ Q, P → R, and Q → R, conclude R.                                        |
| `disjunctive-syllogism`      | From P ∨ Q and ¬P, conclude Q.                                                   |
| `hypothetical-syllogism`     | From P → Q and Q → R, conclude P → R.                                            |
| `conjunction-of-premises`    | From P and Q, conclude P ∧ Q (or use P ∧ Q jointly to support R).                |
| `conditional-proof`          | Assume P; derive Q; conclude P → Q.                                              |
| `universal-instantiation`    | From ∀x.φ(x), conclude φ(a) for any a.                                           |
| `existential-generalization` | From φ(a), conclude ∃x.φ(x).                                                     |

The vocabulary is open. Processors SHOULD treat unknown patterns as opaque labels.

For `pattern="reductio-ad-absurdum"`, the `to` claim SHOULD have `mode="reductio-target"` and `defeasible` SHOULD be `false`. The essay's reductio in "Phenomena are Intrinsic" expressed in 0.2:

```xml
<inference id="I-3.1-reductio"
           from="C3.1-illusionist-assumption A1"
           to="C3.1-target"
           pattern="reductio-ad-absurdum"
           defeasible="false" strength="deductive">
  Strong illusionism implies we lack phenomenal experience. But A1
  asserts phenomenal experience as foundational. Contradiction; therefore
  strong illusionism is rejected.
</inference>
```

For `pattern="argument-by-cases"`, the conclusion is derived from a disjunctive premise plus per-case derivations. Each case SHOULD be wrapped in an `<argument mode="case">` (§6.8). The essay's dualism-as-semantics passage instantiates this pattern: the author considers two scenarios (consciousness as soul; consciousness as higher-dimensional reality) and argues that in both cases the same conclusion (collapse toward physicalism, in the appropriate sense) follows.

Lineage: Gerhard Gentzen's natural deduction system (1934–35), the canonical formalization of compositional inference shapes; Frege's _Begriffsschrift_ (1879); the standard inference rules described in any introductory logic textbook (Quine, Copi, Bergmann–Moor–Nelson). The orthogonality between `pattern` and `scheme` reflects the long-standing distinction in argumentation theory between _formal validity_ (the province of pattern) and _material reasoning_ (the province of scheme), articulated by Toulmin (1958) and elaborated by Walton (1996, 2008).

---

## 11. Defeasibility and Conflict Types

ArgML adopts ASPIC+'s three-way classification of attacks, which in turn derives from Pollock (1987):

**Rebut** — An attack on a conclusion. The attacking claim asserts that the target claim is false. Both rebutter and target are propositions in conflict.

**Undermine** — An attack on a premise. The attacking claim asserts that one of the premises supporting the target claim is false. To undermine is to say: "your conclusion may follow from your premises, but a premise is wrong."

**Undercut** — An attack on an inference rule. The attacking claim asserts that even granting the premises, they do not license the conclusion. To undercut is to say: "I grant your premises and your conclusion's coherence, but I deny that the one entails the other."

Only defeasible inferences may be undercut. A strict inference (`defeasible="false"`) is asserted as deductive, and the only attacks against its conclusion are rebut or undermine.

This three-way classification is the principal locus of double-cruxing's utility: it is precisely the _undercut_ — agreement on premises, disagreement on what they imply — that informal argument most often muddles.

---

## 12. Epistemic Markers

ArgML 0.1 introduces three epistemic markers: the `credence` attribute on `<claim>`, the `strength` attribute on `<inference>`, and the `<epistemic-status>` element in `<metadata>`. These let authors record degree of belief and inferential reliability without committing to a single conflated number per claim. All three are OPTIONAL; their absence indicates _unspecified_, which is distinct from a strong assertion of certainty.

### 12.1 Two-Locus Model

A claim's effective standing depends on two distinct facts: the author's degree of belief in the proposition itself, and the reliability of the inferential path that licenses it. ArgML records these separately:

- `credence` on `<claim>` — the author's degree of belief in the proposition expressed by the claim.
- `strength` on `<inference>` — the author's confidence that the premises, if granted, license the conclusion.

Collapsing these into a single attribute on the claim would erase the distinction that matters most for double-cruxing. A reader who disagrees with a marked credence needs to know whether the disagreement is about the proposition itself or about the inference that produced it.

### 12.2 Qualitative Buckets and Numeric Form

Both `credence` and `strength` accept two value forms.

The RECOMMENDED form is a _qualitative bucket_ drawn from the following ordered vocabulary:

| Bucket         | Approximate sense                                              |
| -------------- | -------------------------------------------------------------- |
| `speculative`  | Provisional; the author is exploring rather than asserting.    |
| `tentative`    | Held lightly; the author leans this way but expects to revise. |
| `considered`   | The author has thought about it and currently holds the view.  |
| `confident`    | Strongly held; the author would defend it under pressure.      |
| `near-certain` | Treated as effectively settled.                                |

The same vocabulary serves for `strength` on inferences:

| Bucket      | Approximate sense                                                 |
| ----------- | ----------------------------------------------------------------- |
| `weak`      | The premises only weakly support the conclusion.                  |
| `moderate`  | The premises plausibly support the conclusion.                    |
| `strong`    | The premises substantially support the conclusion.                |
| `deductive` | The premises entail the conclusion. Implies `defeasible="false"`. |

The OPTIONAL alternative form is a _numeric_ value in the closed interval [0, 1], expressed as a decimal:

```xml
<claim id="C3" credence="0.7">…</claim>
<inference id="I2" strength="0.85" …/>
```

Numeric values do not have a fixed mapping to the qualitative buckets; the two scales are alternative ways of expressing the same kind of judgment and an author should choose one form per attribute. Processors SHOULD render both forms compatibly (e.g., displaying numeric values alongside the nearest qualitative bucket).

Authors who do not have a calibrated numeric estimate are encouraged to use buckets. Numeric values above two decimal places of precision SHOULD be treated as spurious by processors.

### 12.3 The "Unspecified" Default

Neither attribute has a default value. An unmarked claim is _not_ asserted at credence 1.0; it carries no commitment one way or the other. This is deliberate: a high default would silently misrepresent author confidence and would cut against the defeasibility default on inferences.

Processors SHOULD render unspecified credence and strength as "no commitment indicated," not as a high value.

### 12.4 Non-Propagation

ArgML does NOT specify a calculus by which credences on premises and strengths on inferences combine to produce a derived credence on the conclusion. Recording is normative; computation is not. Several considerations motivate this choice:

1. Sound propagation requires conditional dependencies, which authors will not annotate at the density needed for the math to be meaningful.
2. Numeric outputs of unsound propagation appear authoritative and invite mistaken trust.
3. The structural information ArgML records (which claim rests on which, via which inference) is independently useful for visualizing how rejection of one node affects others, without any numeric derivation.

Processors MAY layer a Bayesian network analysis on top of ArgML data, but doing so is out of scope for the format itself. The output of such an analysis is a _separate_ document and SHOULD NOT be confused with the credences explicitly asserted by the author.

### 12.5 Document-Level Epistemic Status

The `<epistemic-status>` element in `<metadata>` provides a coarse, document-level hedge in the tradition of the _Slate Star Codex_ preamble convention. It is intended for high-level signalling ("Speculative; I am not an expert in this field") rather than for double-crux-relevant structure. Per-claim and per-inference markers do the structural work. `<epistemic-status>` text is opaque to processors; it is not parsed for buckets or numeric values.

### 12.6 Honest Use

Epistemic markers are author assertions, not facts. A reader who finds them miscalibrated is welcome to disagree; the markers exist to make calibration disagreements visible rather than to settle them. Authors SHOULD apply markers sparingly and to the claims that matter to the argument; marking every claim with `credence="considered"` adds noise without adding information.

---

## 13. Reader Overlays

### 13.1 Motivation

ArgML 0.1 has no reader-side. A reader who wishes to record "I disagree with assumption A1 in this document" has no place to write the record, no format for sharing it with tools, and no mechanism by which the record propagates to other documents in the corpus that depend on the same assumption. The original proposal motivating ArgML pitches exactly this propagation as the project's principal payoff:

> _"Imagine if you had already marked a disagreement with one standard assumption. When encountering a text which leaned on that assumption, you could identify immediately that your disagreement was not with any of the claims in the text, but the foundations of the argument itself."_

ArgML 0.2 introduces the `<reader-overlay>` document type as a separate companion to `<post>`, recording reader attitudes against imported posts. The same import-and-reference machinery resolves identifiers; propagation is computed by graph traversal at processing time without arithmetic or conditional-dependency assumptions.

### 13.2 Document Structure

A reader-overlay is a well-formed XML document whose root element is `<reader-overlay>` in the `urn:argml:v1` namespace:

```xml
<reader-overlay xmlns="urn:argml:v1" reader="ian" updated="2026-05-12">
  <imports>
    <import prefix="ian-mwc"
            doc="https://www.lesswrong.com/posts/bWuhKA8bhsPGN7zRJ/morality-without-consciousness"/>
    <import prefix="linch"
            doc="https://www.lesswrong.com/posts/qfitpqvQzeZy2mSGi/the-fourth-world"/>
  </imports>

  <attitudes>
    <!-- ... attitude entries ... -->
  </attitudes>

  <substitutions>
    <!-- ... substitution entries ... -->
  </substitutions>
</reader-overlay>
```

Attributes on `<reader-overlay>`:

- `reader` — required; an identifier for the reader (free-form; in practice a username, email, or DID).
- `updated` — ISO 8601 date of the overlay's most recent revision.

A reader-overlay is NOT a `<post>`. It does not contain argumentative prose, claims of its own, or inference graphs. It is a record of attitudes against external content.

`<imports>` is required and follows §5.3 syntax. The prefixes bind references in `<attitude>` and `<substitution>` targets.

### 13.3 Attitudes

The `<attitudes>` block contains zero or more `<attitude>` elements, each recording the reader's stance toward one target:

```xml
<attitudes>
  <attitude target="ian-mwc:A1" kind="accept" credence="confident"/>

  <attitude target="ian-mwc:C1.1" kind="reject"
            rejection-type="undermine" credence="0.2">
    I do not accept that consciousness requires a non-physicalist
    explanation. The author's framing of Linch is itself the disputed
    point.
  </attitude>

  <attitude target="ian-mwc:I-3.1" kind="reject" rejection-type="undercut">
    Granting C3.5, C3.7, and C3.8 individually, I do not agree that
    "less deviation from neuroscience" plus "sidesteps epiphenomenalism"
    licenses the inference to best explanation toward intrinsic.
  </attitude>

  <attitude target="ian-mwc:C4.5" kind="open">
    I want to work through the preference framework before committing.
  </attitude>
</attitudes>
```

Attributes on `<attitude>`:

- `target` — required; a `prefix:id` cross-document reference to a claim, assumption, or inference in an imported post.
- `kind` — required; one of `accept`, `reject`, `open`.
- `rejection-type` — required when `kind="reject"`; one of `rebut`, `undermine`, `undercut`. Parallels Section 11.
- `credence` — optional; the reader's credence on the target, using the vocabulary of §12.2.

The text content of `<attitude>`, if any, is the reader's note. It is not parsed for graph structure.

Attitudes targeting an `<inference>` (rather than a claim or assumption) modify the support relation flowing through that inference. A `kind="reject" rejection-type="undercut"` attitude on an inference breaks the support that inference would carry to its conclusion, but does not invalidate the premises.

The `kind="open"` attitude is the explicit "I have not decided" marker. It is distinct from the absence of any attitude: absence means no record exists, while `open` means the reader has registered the target as a node they are considering.

### 13.4 Substitutions

The `<substitutions>` block contains zero or more `<substitution>` elements, each recording a reader's replacement of one element with another:

```xml
<substitutions>
  <substitution target="ian-mwc:preference" use="my-corpus:preference-v2">
    My working definition adds a strength threshold and a reversibility
    condition. Substitute throughout when evaluating my attitudes against
    ian-mwc.
  </substitution>
</substitutions>
```

Attributes on `<substitution>`:

- `target` — required; a `prefix:id` cross-document reference to a term, claim, or assumption to be replaced.
- `use` — required; a `prefix:id` reference to the replacement element. MAY reference an element in another imported post, or an element in a post the reader has authored.

A substitution does not by itself entail any attitude on the target's downstream consequences. A reader who substitutes a term MAY find that previously-accepted claims now require re-evaluation; the reader records the resulting attitudes explicitly. A processor MUST NOT infer attitudes from substitutions.

### 13.5 Propagation Semantics

Given a post P and a reader-overlay O, a 0.2-conformant processor SHOULD compute the following propagation analysis.

For each takeaway T in P:

| Status        | Condition                                                                       |
| ------------- | ------------------------------------------------------------------------------- |
| `endorsed`    | T is explicitly accepted in O and no ancestor of T is rejected.                 |
| `supported`   | No ancestor of T in P's argument graph is rejected in O.                        |
| `provisional` | At least one ancestor of T has `kind="open"` in O, and no ancestor is rejected. |
| `blocked`     | At least one ancestor of T is rejected in O.                                    |

The _ancestor_ relation follows `supports`, `rests-on`, `via`, and `<inference>`'s `from`. A claim's `same-as` co-references are merged: a single attitude propagates to all co-referenced nodes.

The mode of an ancestor claim affects propagation:

- A rejected `asserted` claim blocks descendants in the usual sense.
- A rejected `anticipated-objection` claim does NOT block descendants. Rejecting an objection is agreement with the author.
- A rejected `attributed` claim does NOT by itself block descendants of the author's own argument; it indicates the reader disputes the attribution or the attributed party's view, which is recorded but does not propagate as a structural defeat against the author.
- Rejecting a `reductio-target` does NOT block descendants. The reductio target is _meant_ to be rejected.
- A rejected `conceded` claim does not block; the author was not relying on it.

Arguments (§6.8) participate in propagation as nodes. When a reader-overlay rejects an argument (via `target` pointing at the argument's id):

- The argument's `supports` relation to its target is broken; the targeted claim loses that path of support. If the targeted claim is a takeaway and has no remaining path of support, its status downgrades to `blocked`.
- Internal claims within the argument retain their independent propagation status. A reader who rejects the c-particle thought experiment as an unfair portrayal of extrinsic views does not thereby reject any internal definition, term, or neutral propositional content; those nodes remain individually addressable.

Because `<argument>` cannot attack (§6.8.2), there is no symmetric case where rejecting an argument restores degraded support. Refutational paths in the graph run through `<claim>` and are governed by the claim-rejection rules above.

Acceptance of an argument endorses its declared support relation without taking a stance on internal claims. A reader wishing to record finer-grained internal attitudes does so via additional `<attitude>` entries targeting internal-claim ids.

Processors MAY implement richer analyses (e.g., distinguishing between rebut-rejection of a conclusion versus undermine-rejection of a premise in their effect on downstream support). The minimum behavior for conformance is the four-status classification above.

The non-propagation principle of §12.4 is preserved: no calculus combines credences on premises and strengths on inferences to derive credences on conclusions. Propagation here is monotonic graph traversal over rejection markers, not arithmetic over numeric credences.

A reader who wishes to record fine-grained Bayesian updates MAY do so via `credence` on individual attitudes, but such credences are not aggregated by conformant processors.

---

## 14. Lineage and Acknowledgements

ArgML is a synthesis rather than an invention. Each major design decision can be traced to a specific tradition.

### 14.1 Foundational Lineage (0.1)

**Argument graph ontology** (claims as I-nodes; inferences and conflicts as S-nodes). Derived from the _Argument Interchange Format_ (Chesñevar, McGinnis, Modgil, Rahwan, Reed, Simari, South, Vreeswijk, and Willmott, 2006), developed under the auspices of the AgentLink network and refined by Chris Reed and colleagues at the University of Dundee. AIF's foundational separation of _what is claimed_ from _how it is inferred_ is preserved in ArgML's distinction between `<claim>` and `<inference>`.

**Defeasibility and attack taxonomy** (strict vs defeasible rules; rebut, undermine, undercut). Derived from ASPIC+ (Modgil and Prakken 2013; Prakken 2010), which in turn formalizes the undercutting/rebutting distinction introduced by John Pollock (1987). Pollock's "prima facie reasons" are the philosophical antecedent of ArgML's defeasible inferences.

**Inline semantic markup of prose**. Derived from the _Text Encoding Initiative_ (Burnard, Bauman, and the TEI Consortium, 1987–present), which pioneered the inline-XML-on-prose pattern for literary and philological texts, and from RDFa (W3C Recommendation, 2008–), which adapted the pattern for semantic web data embedded in HTML. ArgML's `<term ref="…">surface</term>` construction is structurally identical to TEI's inline reference patterns.

**Cross-document references via namespace prefixes**. Derived from XML Namespaces (Bray, Hollander, Layman, Tobin, and Thompson, W3C Recommendation, 1999), with the document-amendment idiom adapted from Akoma Ntoso (OASIS LegalDocML TC) and LegalRuleML (Athan, Boley, Governatori, Palmirani, Paschke, and Wyner, 2013). Legal informatics has four decades of experience with cross-document reference resolution; ArgML borrows directly.

**Canonical concept references**. The `canonical` attribute on `<term>` follows the pattern of SKOS (Miles and Bechhofer, W3C Recommendation, 2009), which distinguishes a local concept identifier from a globally canonical IRI and supports preferred/alternate labels (`skos:prefLabel`, `skos:altLabel`). ArgML's `<alias>` element is the direct analog of `skos:altLabel`.

**Local scope on terms**. The `scope="local"` attribute draws on the concept of _microtheories_ in CYC (Lenat, 1995), which compartmentalizes definitions to contexts in which they apply. ArgML's local scope is a single-document instance of the same idea.

**Argumentation schemes**. The `scheme` attribute and its recommended vocabulary derive from the catalogue of Walton, Reed, and Macagno (2008), which itself builds on a tradition going back to Aristotle's _Topics_.

**Variable proof standards**. Not directly represented in ArgML 0.1, but the Carneades model (Gordon, Prakken, and Walton, 2007) is the antecedent should a future version add per-claim proof-standard attributes.

**Abstract argumentation semantics**. ArgML does not itself define which claims are "accepted" given a graph of supports and attacks. Implementations wishing to compute this MAY apply Dung's abstract argumentation semantics (Dung 1995) — grounded, preferred, stable, complete — to the resolved argument graph.

**Double-crux protocol**. The design driver for ArgML's identifier-addressability is the double-crux protocol developed at CFAR and described by Sabien (2017). Although double-crux predates ArgML and does not require it, ArgML is shaped throughout by the goal of making double-crux mechanically tractable on real essays.

**Epistemic markers**. The two-locus credence/strength model adapts the Bayesian credence convention used widely in rationalist and forecasting communities (e.g., PredictionBook, Manifold Markets) and the calibration literature traceable through Tetlock and the Good Judgement Project. The qualitative bucket vocabulary is informed by _Slate Star Codex_ / _Astral Codex Ten_ epistemic-status conventions (Alexander, ~2014–). The principled separation of _credence on the proposition_ from _strength of the inference_ reflects ASPIC+'s separation of rule-level and conclusion-level evaluation, and is structurally analogous to Toulmin's distinction between _qualifier_ (on the claim) and _backing_ (for the warrant). The non-propagation rule reflects a deliberate departure from probabilistic argumentation frameworks (Hunter; Thimm) which do specify aggregation rules; ArgML records but does not compute.

### 14.2 Additions in Working Draft 0.2

The additions ratified in 0.2 extend the foundational lineage along the following axes.

**Takeaways**. The structural declaration of intended takeaways has no exact analog in argumentation theory, where the conclusion of an argument is typically inferred from graph topology (the terminal node). The closest precedents are the scholarly abstract, the IMRaD "Conclusions" section, and the "Key Findings" or "Recommendations" sections in policy documents — all of which serve to make explicit what graph topology only implies. The `priority="load-bearing"` value structurally encodes what authors typically signal in prose (e.g., the "epistemic status" preamble in ACX-style writing).

**Provenance**. The `<provenance>` / `<generator>` model is a compact specialization of W3C PROV-O (Lebo, Sahoo, McGuinness, et al., W3C Recommendation, 2013), which formalizes the agent–activity–entity triad underlying provenance claims. The single-document scope of ArgML allows simplification: agents and activities are collapsed into `<generator>` entries, and entities are the elements that reference them via the `provenance` attribute. The role vocabulary (`original-author`, `extractor`, `reviewer`, `editor`) follows the Schema.org `creator`/`contributor` distinction and the PREMIS event taxonomy.

**Mode on claims**. The mode vocabulary draws from three traditions. First, _speech act theory_ (Austin 1962; Searle 1969), which distinguishes illocutionary forces: assertive, expressive, directive, commissive. ArgML's `asserted` corresponds to the canonical assertive; `conceded` is a constrained commissive; `attributed` is a reportative reframing. Second, _Discourse Representation Theory_ (Kamp 1981; Heim 1982), which models subordinated discourse contexts (counterfactuals, attitude reports, modal scopes) as nested representational boxes — directly analogous to ArgML's nested `<argument>` regions. Third, _commitment store models_ in argumentation theory (Hamblin 1970; Walton and Krabbe 1995), which track propositional commitments by speaker; `mode="attributed"` and `mode="anticipated-objection"` express claims in stores other than the author's.

**Argument**. The `<argument>` element marks regions of prose that perform dialectical work — building support for claims through thought experiments, case-by-case demonstration, or extended attribution. It is named after Toulmin's (1958) "an argument" as a multi-part structured unit comprising data, warrant, backing, and claim; `<argument>` corresponds most closely to the data-and-warrant region that supports a claim. The support-only restriction reflects a principled distinction: rhetorical construction can build plausibility for a position but cannot refute another; refutation requires explicit propositional commitment, which lives on `<claim>`. This is consonant with Walton's account of how argumentation schemes (Walton, Reed, and Macagno 2008) are challenged — via critical questions, which take the form of explicit claims, not via further schemes. The decision to make arguments first-class graph nodes follows AIF's general principle (Chesñevar et al. 2006) that any argumentatively-significant unit is an addressable node. The markup pattern follows TEI's typed structural regions (`<div type="...">`, Burnard, Bauman, and the TEI Consortium, 1987–present). The mode vocabulary (`thought-experiment`, `case`, `attributed`) is open; future additions like `illustration` or `analogy` are anticipated as conventions develop.

**Inference patterns**. The pattern vocabulary is drawn from Gerhard Gentzen's natural deduction system (Gentzen 1934–35), refined through the natural deduction tradition (Prawitz 1965; Quine 1950; Copi 1953) and the structural-proof-theory literature (Negri and von Plato 2001). The orthogonality between `pattern` (compositional shape) and `scheme` (informal-reasoning kind) reflects Toulmin's (1958) original distinction between _formal-deductive_ and _substantive_ argumentation, elaborated by Walton (1996, 2008). The fixed enumeration deliberately omits scheme-bearing patterns (e.g., "argument from expert opinion" is not a natural-deduction shape and belongs to the `scheme` vocabulary).

**Reader overlay**. The reader-overlay model adapts two distinct traditions. First, the W3C Web Annotation Data Model (Sanderson, Ciccarese, Young, W3C Recommendation, 2017) and the Hypothes.is annotation infrastructure, which establish the pattern of overlay documents that reference target documents by stable identifier. ArgML's reader-overlay is the argumentation-graph analog of a text-span annotation. Second, ASPIC+'s attack taxonomy: the reader-side `rejection-type` mirrors the author-side `attack-type`, so that reader rejections and author-asserted attacks share semantics. The decision to keep reader-overlays as separate root documents (rather than as nested elements in posts) follows the Akoma Ntoso amendment idiom and the legal-informatics principle that one document does not modify another inline.

**Propagation semantics**. The four-status classification (`endorsed` / `supported` / `provisional` / `blocked`) follows Dung's abstract argumentation semantics (Dung 1995) in spirit: a node's acceptability depends on the acceptability of its attackers and supporters. ArgML 0.2's choice of monotonic graph traversal rather than Dung's grounded/preferred/stable semantics reflects the practical need for processors that can run on partial reader overlays without requiring full graph equilibrium computation. Implementations that wish to apply Dung semantics to the resolved graph MAY do so; the four-status classification is the minimum behavior.

---

## 15. References

Athan, T., Boley, H., Governatori, G., Palmirani, M., Paschke, A., and Wyner, A. (2013). _OASIS LegalRuleML_. Proceedings of the 14th International Conference on Artificial Intelligence and Law (ICAIL).

Austin, J. L. (1962). _How to Do Things With Words_. Harvard University Press.

Bray, T., Hollander, D., Layman, A., Tobin, R., and Thompson, H. (eds.). _Namespaces in XML 1.0_. W3C Recommendation.

Chesñevar, C., McGinnis, J., Modgil, S., Rahwan, I., Reed, C., Simari, G., South, M., Vreeswijk, G., and Willmott, S. (2006). _Towards an Argument Interchange Format_. Knowledge Engineering Review, 21(4), 293–316.

Dung, P. M. (1995). _On the Acceptability of Arguments and Its Fundamental Role in Nonmonotonic Reasoning, Logic Programming and n-Person Games_. Artificial Intelligence, 77(2), 321–357.

Frege, G. (1879). _Begriffsschrift, eine der arithmetischen nachgebildete Formelsprache des reinen Denkens_.

Gentzen, G. (1934–35). _Untersuchungen über das logische Schließen_. Mathematische Zeitschrift, 39, 176–210, 405–431. English translation in Szabo (ed.), _The Collected Papers of Gerhard Gentzen_ (1969).

Gordon, T. F., Prakken, H., and Walton, D. (2007). _The Carneades Model of Argument and Burden of Proof_. Artificial Intelligence, 171(10–15), 875–896.

Hamblin, C. L. (1970). _Fallacies_. Methuen.

Heim, I. (1982). _The Semantics of Definite and Indefinite Noun Phrases_. PhD dissertation, University of Massachusetts Amherst.

Kamp, H. (1981). _A Theory of Truth and Semantic Representation_. In Groenendijk, Janssen, and Stokhof (eds.), _Formal Methods in the Study of Language_.

Lebo, T., Sahoo, S., and McGuinness, D. (eds.) (2013). _PROV-O: The PROV Ontology_. W3C Recommendation.

Lenat, D. B. (1995). _CYC: A Large-Scale Investment in Knowledge Infrastructure_. Communications of the ACM, 38(11), 33–38.

Miles, A. and Bechhofer, S. (eds.) (2009). _SKOS Simple Knowledge Organization System Reference_. W3C Recommendation.

Modgil, S. and Prakken, H. (2013). _A General Account of Argumentation with Preferences_. Artificial Intelligence, 195, 361–397.

Negri, S. and von Plato, J. (2001). _Structural Proof Theory_. Cambridge University Press.

Pollock, J. L. (1987). _Defeasible Reasoning_. Cognitive Science, 11(4), 481–518.

Prakken, H. (2010). _An Abstract Framework for Argumentation with Structured Arguments_. Argument and Computation, 1(2), 93–124.

Prawitz, D. (1965). _Natural Deduction: A Proof-Theoretical Study_. Almqvist & Wiksell.

Reed, C., Wells, S., Devereux, J., and Rowe, G. _AIF+: Dialogue in the Argument Interchange Format_. Proceedings of COMMA 2008.

Sabien, D. (2017). _Double Crux: A Strategy for Mutual Understanding_. LessWrong.

Sanderson, R., Ciccarese, P., and Young, B. (eds.) (2017). _Web Annotation Data Model_. W3C Recommendation.

Searle, J. R. (1969). _Speech Acts: An Essay in the Philosophy of Language_. Cambridge University Press.

Text Encoding Initiative Consortium. _TEI P5: Guidelines for Electronic Text Encoding and Interchange_.

Toulmin, S. E. (1958). _The Uses of Argument_. Cambridge University Press.

W3C (2008, updated). _RDFa Core 1.1: Syntax and Processing Rules for Embedding RDF Through Attributes_. W3C Recommendation.

Walton, D. (1996). _Argumentation Schemes for Presumptive Reasoning_. Lawrence Erlbaum.

Walton, D. and Krabbe, E. C. W. (1995). _Commitment in Dialogue: Basic Concepts of Interpersonal Reasoning_. SUNY Press.

Walton, D., Reed, C., and Macagno, F. (2008). _Argumentation Schemes_. Cambridge University Press.

---

## Appendix A — RELAX NG Compact Schema (Informative)

The following RELAX NG Compact fragment captures the structural constraints of ArgML 1.0. It is informative; the prose of this specification is normative where the two diverge.

```rnc
default namespace = "urn:argml:v1"

# --- Root: two document types ---

start = post | reader-overlay

post = element post {
  attribute id { xsd:ID },
  head,
  body
}

# --- Head ---

head = element head {
  metadata,
  provenance?,
  imports?,
  terms?,
  assumptions?,
  takeaways?
}

metadata = element metadata {
  element title    { text },
  element author   { text }+,
  element date     { xsd:date }?,
  element source   { xsd:anyURI }?,
  element epistemic-status { mixed-prose }?
}

provenance = element provenance { generator* }

generator = element generator {
  attribute id    { xsd:ID },
  attribute type  { text }?,
  attribute who   { text }?,
  attribute model { text }?,
  attribute date  { xsd:date }?,
  attribute role  { text }?
}

imports = element imports { import* }
import  = element import {
  attribute prefix { xsd:NCName },
  attribute doc    { xsd:anyURI }
}

terms = element terms { term-decl* }
term-decl = element term {
  attribute id         { xsd:ID },
  attribute canonical  { xsd:anyURI | reference }?,
  attribute scope      { "local" }?,
  attribute provenance { id-list }?,
  element gloss { mixed-prose }?,
  element alias { text }*
}

assumptions = element assumptions { assumption* }
assumption  = element assumption {
  attribute id         { xsd:ID },
  attribute rests-on   { id-list }?,
  attribute provenance { id-list }?,
  mixed-prose,
  element note { text }?
}

takeaways = element takeaways { takeaway* }

takeaway = element takeaway {
  attribute ref        { reference },
  attribute priority   { text }?,
  attribute provenance { id-list }?
}

# --- Body ---

body = element body {
  ( section | p | argument | inline-arg-element )*
}

section = element section {
  attribute id { xsd:ID }?,
  element heading {
    attribute level { xsd:integer },
    mixed-prose
  }?,
  ( p | section | argument | inline-arg-element )*
}

p = element p { mixed-prose }

# Inline elements that appear within prose
inline-arg-element =
    term-ref
  | claim
  | inference
  | conflict
  | evidence
  | note

term-ref = element term {
  attribute ref { reference },
  mixed-prose
}

claim = element claim {
  attribute id            { xsd:ID },
  attribute supports      { id-list }?,
  attribute attacks       { id-list }?,
  attribute attack-type   { "rebut" | "undermine" | "undercut" }?,
  attribute rests-on      { id-list }?,
  attribute via           { reference }?,
  attribute defeasible    { "true" | "false" }?,
  attribute scheme        { text }?,
  attribute credence      { credence-bucket | numeric-credence }?,
  attribute mode          { claim-mode }?,
  attribute attributed-to { text }?,
  attribute same-as       { reference }?,
  attribute source        { xsd:anyURI }?,
  attribute provenance    { id-list }?,
  mixed-prose
}

claim-mode = "asserted" | "supposed" | "attributed" | "restated"
           | "anticipated-objection" | "conceded" | "reductio-target"

# --- Argument ---

argument = element argument {
  attribute id            { xsd:ID }?,
  attribute mode          { argument-mode },
  attribute supports      { id-list }?,
  attribute rests-on      { id-list }?,
  attribute via           { reference }?,
  attribute attributed-to { text }?,
  attribute provenance    { id-list }?,
  ( p | section | argument | inline-arg-element )*
}

argument-mode = "thought-experiment" | "case" | "attributed" | text

# --- Inference ---

inference = element inference {
  attribute id         { xsd:ID },
  attribute from       { id-list },
  attribute to         { reference },
  attribute scheme     { text }?,
  attribute pattern    { text }?,
  attribute defeasible { "true" | "false" }?,
  attribute strength   { strength-bucket | numeric-credence }?,
  attribute provenance { id-list }?,
  mixed-prose
}

conflict = element conflict {
  attribute id          { xsd:ID },
  attribute attack-type { "rebut" | "undermine" | "undercut" }?,
  attribute provenance  { id-list }?,
  element attacker { attribute idref { reference }, empty },
  element target   { attribute idref { reference }, empty },
  element response { mixed-prose }?
}

evidence = element evidence {
  attribute ref  { reference },
  attribute type { text }?,
  element gloss { mixed-prose }?
}

note = element note {
  attribute status { text }?,
  mixed-prose
}

# --- Reader overlay ---

reader-overlay = element reader-overlay {
  attribute reader  { text },
  attribute updated { xsd:date }?,
  imports,
  attitudes?,
  substitutions?
}

attitudes = element attitudes { attitude* }

attitude = element attitude {
  attribute target         { reference },
  attribute kind           { "accept" | "reject" | "open" },
  attribute rejection-type { "rebut" | "undermine" | "undercut" }?,
  attribute credence       { credence-bucket | numeric-credence }?,
  mixed-prose
}

substitutions = element substitutions { substitution* }

substitution = element substitution {
  attribute target { reference },
  attribute use    { reference },
  mixed-prose
}

# --- Shared productions ---

mixed-prose = mixed { inline-arg-element* }
id-list     = list { reference+ }
reference   = xsd:string  # IDREF or "prefix:id"

credence-bucket  = "speculative" | "tentative" | "considered" | "confident" | "near-certain"
strength-bucket  = "weak" | "moderate" | "strong" | "deductive"
numeric-credence = xsd:decimal  # constrained to [0, 1]
```

---

## Appendix B — Worked Example (Informative)

### B.1 Post excerpt

The following fragment marks up a section of "Morality without Consciousness" (IanWS, 2026) using ArgML 0.2 features. It demonstrates `<takeaways>`, `<provenance>`, `mode` on `<claim>`, `<argument>`, attribution, restatement via `same-as`, and `pattern` on `<inference>`. A companion `<reader-overlay>` follows in B.2.

```xml
<post xmlns="urn:argml:v1" id="morality-without-consciousness">

  <head>
    <metadata>
      <title>Morality without Consciousness</title>
      <author>IanWS</author>
      <date>2026-04-17</date>
      <source>https://www.lesswrong.com/posts/bWuhKA8bhsPGN7zRJ/morality-without-consciousness</source>
      <epistemic-status>Considered but speculative. The intrinsic/extrinsic
        distinction is the load-bearing move; I would defend it but expect
        reasonable disagreement.</epistemic-status>
    </metadata>

    <provenance>
      <generator id="g-original" type="human" who="IanWS"
                 date="2026-04-17" role="original-author"/>
      <generator id="g-extract" type="llm" model="claude-opus-4.7"
                 date="2026-05-11" role="extractor"/>
      <generator id="g-review" type="human" who="IanWS"
                 date="2026-05-12" role="reviewer"/>
    </provenance>

    <imports>
      <import prefix="linch"
              doc="https://www.lesswrong.com/posts/qfitpqvQzeZy2mSGi/the-fourth-world"/>
      <import prefix="sep" doc="https://plato.stanford.edu/entries/"/>
    </imports>

    <terms>
      <term id="consciousness" canonical="sep:consciousness">
        <gloss>Phenomenal consciousness — the "hard problem", qualia.</gloss>
        <alias>phenomenal consciousness</alias>
        <alias>qualia</alias>
      </term>
      <term id="preference" scope="local">
        <gloss>An expressed interest counter to the second law of
          thermodynamics.</gloss>
      </term>
      <!-- ... other term declarations ... -->
    </terms>

    <assumptions>
      <assumption id="A1" provenance="g-original">
        I have phenomenal experience.
      </assumption>
    </assumptions>

    <takeaways>
      <takeaway ref="C6.7" priority="primary"
                provenance="g-review"/>
      <takeaway ref="C4.9" priority="secondary"
                provenance="g-review"/>
      <takeaway ref="C3.6" priority="load-bearing"
                provenance="g-review"/>
    </takeaways>
  </head>

  <body>
    <p>A recent post,
    <claim id="L0" mode="attributed" attributed-to="Linch"
           source="https://www.lesswrong.com/posts/qfitpqvQzeZy2mSGi/the-fourth-world"
           same-as="linch:fourth-world-thesis"
           provenance="g-extract g-review">
      Consciousness implies that we ought to suspect further aspects of
      reality than we can today observe.
    </claim>
    I'm not sure it arrives there the right way.</p>

    <section>
      <heading level="1">Phenomena are Intrinsic</heading>

      <!-- Reductio: no <argument> wrapping needed; pattern on the
           inference carries the structure. -->
      <claim id="C3.1-supposition" mode="supposed">
        Strong illusionism is correct: there is no phenomenal experience.
      </claim>

      <claim id="C3.1-target" mode="reductio-target">
        We are all already zombies (I experience, yet sadly I do not exist).
      </claim>

      <inference id="I-3.1-reductio"
                 from="C3.1-supposition A1" to="C3.1-target"
                 pattern="reductio-ad-absurdum"
                 defeasible="false" strength="deductive"
                 provenance="g-extract g-review">
        Strong illusionism entails we lack phenomenal experience. A1
        asserts phenomenal experience as foundational. Contradiction.
      </inference>

      <claim id="C3.1" mode="asserted" rests-on="A1"
             attacks="C3.1-supposition" attack-type="rebut"
             credence="confident" provenance="g-original">
        Our experience of existence is phenomenal.
      </claim>

      <!-- Argument by cases. Each case is an <argument> region that
           supports C2.2; the inference declares the cases pattern. -->
      <p>The difficulty with dualist claims is that they either rely on
      a mystical, non-physical substance, or they rely on semantic
      qualifications for the physical world.</p>

      <argument mode="case" id="A-case-soul" supports="C2.2"
                provenance="g-original">
        <p>Let us suppose that we learn consciousness is actually the
        emergence of a soul, dipping its head in from some heavenly
        plane of existence. We learn that all our physical laws are
        arbitrary and completely determined by the whim of God. In this
        extreme scenario, we concede dualism — mysticism, by definition.</p>
      </argument>

      <argument mode="case" id="A-case-higher-dim" supports="C2.2"
                provenance="g-original">
        <p>Let us suppose instead that we learn consciousness is the
        emergence of higher-dimensional reality within our own. That
        higher-dimensional reality determines all the physical laws of
        our known universe. In this scenario, we expand our definition
        of physics to account for our new knowledge of reality;
        physicalism survives.</p>
      </argument>

      <claim id="C2.2" mode="asserted" credence="considered"
             provenance="g-original">
        Nearly all explanations for consciousness ought to collapse
        toward physicalism, because any fundamental discoveries required
        to explain consciousness also compel us to redefine physics
        accordingly.
      </claim>

      <inference id="I-2.2-cases"
                 from="A-case-soul A-case-higher-dim" to="C2.2"
                 pattern="argument-by-cases"
                 defeasible="true" strength="strong"/>

      <!-- Inference to best explanation, the load-bearing move. The
           c-particle thought experiment supports C3.5 directly. -->
      <argument mode="thought-experiment" id="A-c-particle"
                supports="C3.5" provenance="g-original">
        <p>For an extrinsic example, imagine that there was an undetected
        particle of consciousness, the c-particle, which somehow
        interacted with neurophysiological processes. Phenomena are
        actually composed of c-particles. We might further suppose that
        c-particles come in many flavors. There is a c-particle of pain,
        a c-particle of happiness, etc. Mental states, as we understand
        them, are actually determined by c-particles.</p>
      </argument>

      <claim id="C3.5" mode="asserted" credence="confident">
        Any extrinsic view requires a mysterious "something else" to
        explain consciousness, which must then causally interact with
        our neurophysiology.
      </claim>

      <claim id="C3.7" mode="asserted" supports="C3.6" credence="confident">
        An intrinsic theory requires less deviation from contemporary
        neuroscience.
      </claim>

      <claim id="C3.8" mode="asserted" supports="C3.6" credence="considered">
        An intrinsic theory sidesteps the problems of epiphenomenalism.
      </claim>

      <claim id="C3.6" mode="asserted" via="I-3.1"
             credence="considered" provenance="g-original">
        I find it much more likely that consciousness is somehow
        intrinsic to neurophysiology.
      </claim>

      <inference id="I-3.1" from="C3.5 C3.7 C3.8" to="C3.6"
                 scheme="inference-to-best-explanation"
                 pattern="conjunction-of-premises"
                 defeasible="true" strength="moderate"/>
    </section>

    <section>
      <heading level="1">Generalizing Ethics with Preferences</heading>

      <!-- Thought experiment: alien goo. The argument supports C4.5;
           the prose narrates the scenario without internal claims. -->
      <argument mode="thought-experiment" id="A-alien-goo"
                supports="C4.5" provenance="g-original">
        <p>Let us suppose we are visited by a highly developed species
        of alien goo. The aliens climb to the tallest point in any room
        they enter. The aliens are also very interested in your potted
        plant, which slowly adjusts its leaves over the course of the
        day. Neither we nor the aliens can directly observe each other's
        inner states, but both exhibit clear, persistent preferences.</p>
      </argument>

      <claim id="C4.5" mode="asserted" via="I-3.1"
             credence="considered" provenance="g-original">
        If you'd agree we have a moral obligation not to cause an alien
        pain, then you should accept the obligation to allow the observed
        entity to act according to their inferred preference.
      </claim>

      <!-- Anticipated objection: a claim that attacks C4.5 directly.
           No <argument> wrapping — attacks belong on claims. -->
      <claim id="O4.1" mode="anticipated-objection"
             attacks="C4.5" attack-type="undercut">
        You can't compare our preferences to those of a plant — our
        response is cognitive, the plant's is automatic.
      </claim>

      <claim id="C4.7" mode="asserted"
             attacks="O4.1" attack-type="undercut"
             credence="tentative" provenance="g-original">
        This overlooks how dumbly reactive a lot of preferences are,
        even if they are unclearly expressed.
      </claim>

      <claim id="C4.9" mode="asserted" credence="tentative"
             provenance="g-original">
        In every instance where one might be tempted to evaluate ethics
        on the basis of consciousness, one could instead insert preference.
      </claim>
    </section>

    <section>
      <heading level="1">Recap</heading>

      <!-- Restatements of earlier claims, structurally linked. -->
      <claim id="C6.2" mode="restated" same-as="C3.6"
             supports="C6.3" credence="considered">
        A physicalist's best guess should be that consciousness is
        somehow intrinsic to neurophysiology.
      </claim>

      <claim id="C6.7" mode="restated" same-as="C4.9"
             credence="tentative">
        It would be premature to determine that consciousness demands
        unique obligations.
      </claim>

      <!-- Author's concession near the close. -->
      <claim id="C-concession" mode="conceded" credence="considered">
        These final conclusions are several steps removed from ground
        truth.
      </claim>
    </section>
  </body>
</post>
```

### B.2 Reader-overlay example

A reader who broadly accepts the argument but disagrees with the load-bearing inference, has not committed on the preference framework, and substitutes their own definition of "preference":

```xml
<reader-overlay xmlns="urn:argml:v1"
                reader="reader-example"
                updated="2026-05-12">

  <imports>
    <import prefix="ian-mwc"
            doc="https://www.lesswrong.com/posts/bWuhKA8bhsPGN7zRJ/morality-without-consciousness"/>
    <import prefix="my-corpus"
            doc="https://example.org/my-definitions"/>
  </imports>

  <attitudes>
    <attitude target="ian-mwc:A1" kind="accept" credence="confident"/>

    <attitude target="ian-mwc:C3.1" kind="accept" credence="confident">
      The reductio is clean and I accept it.
    </attitude>

    <attitude target="ian-mwc:I-3.1" kind="reject" rejection-type="undercut">
      I accept C3.5, C3.7, and C3.8 individually, but I do not agree they
      jointly license the inference to best explanation toward intrinsic.
      The "less deviation from neuroscience" criterion is a methodological
      preference, not an inferential warrant.
    </attitude>

    <attitude target="ian-mwc:C4.5" kind="open">
      I want to work through the preference framework before committing
      to the parity between alien climbing and plant phototropism.
    </attitude>

    <attitude target="ian-mwc:O4.1" kind="reject" rejection-type="rebut">
      I agree with the author that this anticipated objection fails as
      a proposition; rejecting O4.1 strengthens C4.7's response.
    </attitude>

    <attitude target="ian-mwc:A-c-particle" kind="reject" rejection-type="rebut">
      The c-particle scenario is a strawman; serious extrinsic views
      (panpsychism; IIT-extrinsic readings) don't posit anything like
      this. The thought experiment does not actually warrant C3.5.
    </attitude>
  </attitudes>

  <substitutions>
    <substitution target="ian-mwc:preference" use="my-corpus:preference-v2">
      My definition adds a strength threshold and a reversibility
      condition. When evaluating attitudes against ian-mwc, substitute
      throughout.
    </substitution>
  </substitutions>
</reader-overlay>
```

Under the propagation semantics of §13.5, a conformant processor evaluating this overlay against the post computes:

| Takeaway | Status        | Reason                                                                                                                                                                              |
| -------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `C6.7`   | `provisional` | Same as `C4.9`; an ancestor (`C4.5`) is `open` in the overlay; no ancestor is rejected.                                                                                             |
| `C4.9`   | `provisional` | Same reason; ancestor `C4.5` is `open`.                                                                                                                                             |
| `C3.6`   | `blocked`     | The licensing inference `I-3.1` is rejected (undercut). The reader's rejection of `A-c-particle` further weakens the path to C3.5, though C3.5 retains independent textual support. |

The reader's rejection of `O4.1` (an anticipated-objection claim attacking C4.5) is itself an undercut-rejection of an attack: it does not block any takeaway, and it strengthens C4.7's status by endorsing its response. The reader's rejection of `A-c-particle` breaks the argument's support to C3.5 but does not propagate inward to any term or definition referenced inside the argument's prose (§6.8.2).

The substitution of `preference` is recorded but does not by itself alter the status of any claim. The reader's `open` attitude on `C4.5` reflects that the substitution's downstream consequences for the preference-based ethics framework remain unevaluated.

---

_End of ArgML 1.0 Specification, Working Draft 0.2._
