# ArgML 1.0 — Proposed Additions for Working Draft 0.2

**Specification Proposal, Working Draft, Version 0.2 (proposed)**

| Field        | Value                          |
| ------------ | ------------------------------ |
| Date         | 12 May 2026                    |
| Editor       | Ian Walker-Sperber             |
| Status       | Working Draft (proposed)       |
| This version | `urn:argml:spec:v0.2-proposal` |
| Supersedes   | `urn:argml:spec:v0.1`          |
| Namespace    | `urn:argml:v1` (unchanged)     |

## Abstract

This document proposes a set of additions to ArgML Working Draft 0.1 that collectively fund the _propagation_ use case described in the original ArgML proposal but left structurally unsupported in 0.1. It introduces three new structural elements (`<takeaways>`, `<provenance>`, `<argument>`); a small set of new attributes on existing elements (`mode`, `attributed-to`, `same-as`, `source`, `pattern`, `provenance`); a richer recommended vocabulary for compositional inference patterns drawn from natural deduction; and one new document type (`<reader-overlay>`) for recording reader attitudes against argument graphs across the corpus. All additions are backwards-compatible with 0.1: documents conformant with 0.1 remain conformant with 0.2 without modification. The proposal preserves 0.1's design principles — annotation rather than translation, graduated formalization, identifier-addressable units, non-propagation of credence arithmetic — and extends them along axes the original specification gestured at but did not develop.

## Status of This Document

This is a proposal for Working Draft 0.2 of the ArgML specification. It has not been ratified. The additions described here are intended for review against ArgML 0.1 and against the original proposal motivating the project. Implementations SHOULD NOT deploy against this draft until its provisions are finalized in a successor Working Draft.

The keywords _MUST_, _MUST NOT_, _SHOULD_, _SHOULD NOT_, and _MAY_ are to be interpreted as described in RFC 2119.

## Contents

1. Introduction
2. Conformance and Backwards Compatibility
3. Terminology (Additions)
4. Additions to the Head Section
5. Additions to the Body Section
6. Additions to `<inference>`: The `pattern` Attribute
7. The Reader Overlay
8. Element Reference (Additions)
9. Attribute Reference (Additions)
10. Lineage and Acknowledgements (Additions)
11. References (Additions)

Appendix A — RELAX NG Schema Additions (Informative)
Appendix B — Worked Example with New Features (Informative)

---

## 1. Introduction

### 1.1 Motivation

ArgML 0.1 establishes the technical infrastructure for argument graphs — claims, inferences, conflicts, terms, assumptions, and cross-document imports. The original proposal motivating the specification, however, advances a stronger claim: that ArgML should enable a reader to mark disagreement with an upstream commitment and have downstream consequences computed _across a corpus_, so that "your disagreement was not with any of the claims in the text, but the foundations of the argument itself."

ArgML 0.1 does not fund this use case. It provides the author-side machinery for constructing argument graphs but provides no reader-side format for recording attitudes, no authorial declaration of intended takeaways against which propagation might be computed, and no way to scope claims as hypothetical, attributed, or anticipated such that reader attitudes apply to the right targets. The natural-deduction compositional shapes that recur in philosophical prose — reductio, argument by cases, modus tollens — are recordable in 0.1 only as opaque scheme strings, blocking structural processing.

This proposal addresses these gaps. It is not a redesign; it adds the smallest set of elements and attributes sufficient to fund the original proposal's stated use case.

### 1.2 Relationship to ArgML 0.1

All additions in this proposal are OPTIONAL. A 0.1-conformant document is also a 0.2-conformant document. The `mode` attribute introduced on `<claim>` has a default value of `asserted`, which is the implicit semantics of 0.1; no behavior change applies to unmarked claims. The `<reader-overlay>` document type is a separate root element; it does not affect post documents.

The non-propagation principle of 0.1 §12.4 is preserved. The propagation semantics defined here (§7.5) are monotonic graph traversal over support and attack edges; they do not specify a calculus for combining credences, and they do not derive numeric credences on conclusions.

### 1.3 Summary of Additions

Three new structural elements:

- `<takeaways>` in the head, declaring the author's intended takeaway claims.
- `<provenance>` in the head, declaring generators (human, LLM, automated) referenceable from elements in the body.
- `<argument>` in the body, marking a region of prose that supports a claim through dialectical means (thought experiment, case, extended attribution). A first-class node in the argument graph, restricted to the `supports` relation.

New attributes on existing elements:

- `mode` on `<claim>` — speech-act / discourse status (`asserted`, `supposed`, `attributed`, `restated`, `anticipated-objection`, `conceded`, `reductio-target`).
- `attributed-to` on `<claim>` — the party to whom an attributed claim is ascribed.
- `same-as` on `<claim>` — identifier of a claim expressing the same proposition.
- `source` on `<claim>` — URL or identifier of an external source for an attributed claim.
- `pattern` on `<inference>` — the compositional logical shape.
- `provenance` on `<claim>`, `<inference>`, `<conflict>`, `<term>`, `<assumption>`, `<takeaway>` — space-separated list of generator identifiers.

One new document type:

- `<reader-overlay>` — companion to `<post>`, recording a reader's attitudes (accept, reject, open) and term substitutions against one or more imported posts.

---

## 2. Conformance and Backwards Compatibility

A _conformant ArgML 0.2 document_ is either:

1. A 0.1-conformant `<post>` document, optionally extended with any of the additions in §§4–6 of this proposal; or
2. A `<reader-overlay>` document conformant to §7.

A _conformant ArgML 0.2 processor_ implements all 0.1 processor requirements and additionally:

- Respects the `mode` attribute on `<claim>` when rendering and when evaluating reader-overlay attitudes.
- Inherits claim mode from enclosing `<argument>` elements when an inner `<claim>` does not specify its own.
- Resolves `same-as` references and treats co-referenced claims as the same graph node for propagation purposes.
- Implements at least the propagation semantics described in §7.5 when supplied a post and a reader-overlay.

Processors MAY ignore unknown `mode` values, unknown `pattern` values, unknown `priority` values, and unknown `type` values on `<generator>`; these vocabularies are intentionally open.

---

## 3. Terminology (Additions)

The following terms are added to those defined in ArgML 0.1 §3.

**Takeaway** — A claim within a document that the author identifies as an intended conclusion. Declared via `<takeaway>` in the head; addressed by reference to a claim `id`.

**Reader overlay** — A document, separate from any `<post>`, recording a reader's attitudes toward claims, assumptions, and inferences in one or more imported posts. Used as input alongside a post to compute reader-state propagation.

**Attitude** — A reader's recorded stance toward a target element. One of: _accept_, _reject_ (with a rejection-type parallel to ArgML 0.1's attack-type), or _open_ (the reader has explicitly not decided).

**Substitution** — A reader's declared replacement of one term, assumption, or claim with another, applied when evaluating an imported post against the reader's overlay.

**Mode** — The speech-act or discourse status of a claim: whether the author asserts it, supposes it hypothetically, attributes it to another party, restates it from elsewhere, anticipates it as an objection, concedes it, or assumes it as a target for reductio.

**Argument (element)** — A region of body content that supports a claim through dialectical means: a thought experiment, a case in an argument-by-cases, an extended attribution to another author. Distinct from a `<claim>`, which carries propositional commitment. The `<argument>` element is a first-class node in the argument graph but is restricted to the `supports` relation; it cannot attack. Refutation requires propositional commitment and belongs on `<claim>`.

**Pattern** — The compositional logical shape of an inference (e.g., _modus ponens_, _reductio ad absurdum_, _argument by cases_). Distinct from _scheme_: pattern names how premises combine; scheme names the kind of informal reasoning deployed.

**Provenance entry** — A `<generator>` declaration in the head identifying the origin of one or more elements. Multiple entries accumulate; elements reference them by id.

---

## 4. Additions to the Head Section

### 4.1 The `<takeaways>` Element

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

### 4.2 The `<provenance>` Element

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

---

## 5. Additions to the Body Section

### 5.1 The `mode` Attribute on `<claim>`

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
| `attributed`            | The author attributes the proposition to a named external party (see §5.3). The author makes no commitment.                                                |
| `restated`              | A paraphrase of a claim introduced earlier in this or another document. MUST carry `same-as` (§5.4).                                                       |
| `anticipated-objection` | The author imagines an interlocutor making this claim. The author is reporting a view in order to address it, not endorsing it.                            |
| `conceded`              | The author grants the proposition for the sake of argument, typically as setup for showing it does not block the main argument.                            |
| `reductio-target`       | The proposition assumed for contradiction in a reductio ad absurdum argument. The author intends to demonstrate that this proposition cannot hold.         |

A claim's mode affects how reader-overlay attitudes apply. A reader rejecting an `asserted` claim is rejecting an author commitment. A reader rejecting an `anticipated-objection` claim is _agreeing_ with the author's portrayal of a weak position. Processors implementing propagation (§7.5) MUST take mode into account.

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

### 5.2 The `<argument>` Element

The `<argument>` element marks a region of body content that supports a claim through dialectical means — a thought experiment, a case in an argument-by-cases, an extended attribution to another author. It is a first-class node in the argument graph, but with a deliberately restricted role: an `<argument>` can support claims but cannot attack them. Refutation requires propositional commitment and belongs on `<claim>`; rhetorical work belongs here.

The restriction reflects a substantive principle. A thought experiment never refutes — it builds intuition for one position or another. The refutational work, if any, is done by an explicit proposition that the thought experiment helps the reader entertain. Forcing that proposition to appear as a `<claim>` (rather than being smuggled in via an `attacks` attribute on a region of prose) keeps the argument graph honest about what is actually being asserted.

`<argument>` does the same structural-region duty as a `<section>` — it groups prose and MAY set a default `mode` for any internal `<claim>` elements — but it adds participation in the argument graph as a unit, where a `<section>` is purely organizational.

#### 5.2.1 Mode and the dialectical-move vocabulary

The `mode` attribute on `<argument>` is required and names the kind of dialectical move the region performs. The RECOMMENDED vocabulary:

| `<argument mode="...">` | Default mode for contained claims | Use                                                       |
| ----------------------- | --------------------------------- | --------------------------------------------------------- |
| `thought-experiment`    | `supposed`                        | A hypothetical scenario constructed to expose intuitions. |
| `case`                  | `supposed`                        | One branch of an argument-by-cases.                       |
| `attributed`            | `attributed`                      | An extended attribution to another author or party.       |

The vocabulary is open; processors SHOULD treat unknown modes as opaque labels. Authors and tools MAY extend with values like `illustration` or `analogy` as conventions develop.

Argument modes are distinct from claim modes (§5.1) and serve a different purpose. A `<claim mode="...">` records the author's commitment level to a specific proposition; an `<argument mode="...">` records the type of dialectical move a region of prose performs. The two vocabularies are intentionally non-overlapping, though `attributed` appears in both with parallel meaning at different granularities.

#### 5.2.2 Support-only relations

`<argument>` carries the following relational attributes:

- `id` — identifier; required when the argument participates in the graph.
- `supports` — space-separated list of claim ids this argument provides support for.
- `rests-on` — assumption or imported-element ids the argument depends on (a scenario's setup may rest on background assumptions).
- `via` — identifier of an explicit `<inference>` element licensing the support.
- `attributed-to` — when `mode="attributed"`, the party to whom the argument is ascribed.
- `provenance` — generator references (§4.2).

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

Neither case-argument contains internal claims; the case as a region is the unit. Authors MAY introduce internal claims when they wish to make specific propositions individually addressable, but the spec does not require this — graduated formalization (per ArgML 0.1 §1.2) means structure is added only where it earns its place.

#### 5.2.3 Attacks belong on claims

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

_Reductio._ A reductio is a logical move, not a rhetorical one. It is captured by `pattern="reductio-ad-absurdum"` on `<inference>` (§6), with the supposition and the absurd consequence expressed as claims. No `<argument>` wrapping is needed.

#### 5.2.4 Composability

`<argument>` does not affect inference patterns, conflict relations, or term scoping. An `<inference>` element appearing inside an `<argument mode="thought-experiment">` does not have its conclusions automatically treated as supposed; the inference's `to` claim retains whatever mode it explicitly carries.

Arguments MAY nest. Mode inheritance for internal claims follows the nearest enclosing `<argument>`.

Lineage: Toulmin's _The Uses of Argument_ (1958), where "an argument" is a multi-part structured unit comprising data, warrant, backing, claim, qualifier, and rebuttal — ArgML's `<argument>` corresponds most closely to what Toulmin frames as the data-and-warrant region that supports a claim. Walton's argumentation schemes (Walton, Reed, and Macagno 2008), which type recurring patterns of presumptive support. Carneades' argument structures (Gordon, Prakken, and Walton 2007), where each argument is an instance of a scheme that contributes to or detracts from an issue. AIF's general principle that any argumentatively-significant unit is an addressable node (Chesñevar et al. 2006). TEI's typed structural regions (`<div type="...">`) for the markup pattern. The support-only restriction reflects the substantive position that rhetorical construction builds plausibility but does not refute, and that refutational moves require explicit propositional commitments — a position consonant with Walton's account of how schemes are challenged (via critical questions, which take the form of explicit claims, not via further schemes).

### 5.3 Attributed Claims and External References

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

### 5.4 The `same-as` Attribute and Claim Equivalence

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

## 6. Additions to `<inference>`: The `pattern` Attribute

The `scheme` attribute on `<inference>` (0.1 §10) names an _argumentation scheme_ — a recurring informal-reasoning pattern from the Walton catalogue, oriented toward _what kind_ of inference is deployed (argument from analogy, inference to best explanation, argument from sign). A new `pattern` attribute names the _compositional logical shape_ — _how_ premises combine — drawn from the natural-deduction tradition.

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

For `pattern="argument-by-cases"`, the conclusion is derived from a disjunctive premise plus per-case derivations. Each case SHOULD be wrapped in an `<argument mode="case">` (§5.2). The essay's dualism-as-semantics passage instantiates this pattern: the author considers two scenarios (consciousness as soul; consciousness as higher-dimensional reality) and argues that in both cases the same conclusion (collapse toward physicalism, in the appropriate sense) follows.

Lineage: Gerhard Gentzen's natural deduction system (1934–35), the canonical formalization of compositional inference shapes; Frege's _Begriffsschrift_ (1879); the standard inference rules described in any introductory logic textbook (Quine, Copi, Bergmann–Moor–Nelson). The orthogonality between `pattern` and `scheme` reflects the long-standing distinction in argumentation theory between _formal validity_ (the province of pattern) and _material reasoning_ (the province of scheme), articulated by Toulmin (1958) and elaborated by Walton (1996, 2008).

---

## 7. The Reader Overlay

### 7.1 Motivation

ArgML 0.1 has no reader-side. A reader who wishes to record "I disagree with assumption A1 in this document" has no place to write the record, no format for sharing it with tools, and no mechanism by which the record propagates to other documents in the corpus that depend on the same assumption. The original proposal motivating ArgML pitches exactly this propagation as the project's principal payoff:

> _"Imagine if you had already marked a disagreement with one standard assumption. When encountering a text which leaned on that assumption, you could identify immediately that your disagreement was not with any of the claims in the text, but the foundations of the argument itself."_

ArgML 0.2 introduces the `<reader-overlay>` document type as a separate companion to `<post>`, recording reader attitudes against imported posts. The same import-and-reference machinery resolves identifiers; propagation is computed by graph traversal at processing time without arithmetic or conditional-dependency assumptions.

### 7.2 Document Structure

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

`<imports>` is required and follows ArgML 0.1 §5.2 syntax. The prefixes bind references in `<attitude>` and `<substitution>` targets.

### 7.3 Attitudes

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
- `rejection-type` — required when `kind="reject"`; one of `rebut`, `undermine`, `undercut`. Parallels ArgML 0.1 §11.
- `credence` — optional; the reader's credence on the target, using the vocabulary of 0.1 §12.2.

The text content of `<attitude>`, if any, is the reader's note. It is not parsed for graph structure.

Attitudes targeting an `<inference>` (rather than a claim or assumption) modify the support relation flowing through that inference. A `kind="reject" rejection-type="undercut"` attitude on an inference breaks the support that inference would carry to its conclusion, but does not invalidate the premises.

The `kind="open"` attitude is the explicit "I have not decided" marker. It is distinct from the absence of any attitude: absence means no record exists, while `open` means the reader has registered the target as a node they are considering.

### 7.4 Substitutions

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

### 7.5 Propagation Semantics

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

Arguments (§5.2) participate in propagation as nodes. When a reader-overlay rejects an argument (via `target` pointing at the argument's id):

- The argument's `supports` relation to its target is broken; the targeted claim loses that path of support. If the targeted claim is a takeaway and has no remaining path of support, its status downgrades to `blocked`.
- Internal claims within the argument retain their independent propagation status. A reader who rejects the c-particle thought experiment as an unfair portrayal of extrinsic views does not thereby reject any internal definition, term, or neutral propositional content; those nodes remain individually addressable.

Because `<argument>` cannot attack (§5.2.2), there is no symmetric case where rejecting an argument restores degraded support. Refutational paths in the graph run through `<claim>` and are governed by the claim-rejection rules above.

Acceptance of an argument endorses its declared support relation without taking a stance on internal claims. A reader wishing to record finer-grained internal attitudes does so via additional `<attitude>` entries targeting internal-claim ids.

Processors MAY implement richer analyses (e.g., distinguishing between rebut-rejection of a conclusion versus undermine-rejection of a premise in their effect on downstream support). The minimum behavior for conformance is the four-status classification above.

The non-propagation principle of ArgML 0.1 §12.4 is preserved: no calculus combines credences on premises and strengths on inferences to derive credences on conclusions. Propagation here is monotonic graph traversal over rejection markers, not arithmetic over numeric credences.

A reader who wishes to record fine-grained Bayesian updates MAY do so via `credence` on individual attitudes, but such credences are not aggregated by conformant processors.

---

## 8. Element Reference (Additions)

Elements are listed alphabetically. Existing 0.1 elements receiving new attributes are noted in §9.

### `<argument>`

| Field         | Value                                                                                                                                                                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Appears in    | `<body>`, `<section>`, `<argument>` (nested)                                                                                                                                                                                                     |
| Content model | Prose (`<p>`, `<section>`, `<argument>`, inline elements)                                                                                                                                                                                        |
| Attributes    | `mode` (required), `id`, `supports`, `rests-on`, `via`, `attributed-to`, `provenance`                                                                                                                                                            |
| Lineage       | Toulmin (1958) "an argument" as multi-part unit; Walton, Reed, and Macagno (2008) argumentation schemes; Carneades argument structures (Gordon, Prakken, and Walton 2007); AIF addressable nodes (Chesñevar et al. 2006); TEI `<div type="...">` |

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

### `<generator>`

| Field         | Value                                                              |
| ------------- | ------------------------------------------------------------------ |
| Appears in    | `<provenance>`                                                     |
| Content model | Empty                                                              |
| Attributes    | `id` (required), `type`, `who`, `model`, `date`, `role`            |
| Lineage       | W3C PROV-O (2013); Schema.org `Author`; PREMIS preservation events |

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

---

## 9. Attribute Reference (Additions)

| Attribute        | Appears on                                                                            | Type                                                              | Description                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mode`           | `<claim>`, `<argument>`                                                               | Mode vocabulary (see §5.1 for `<claim>`; §5.2.1 for `<argument>`) | Speech-act / discourse status on `<claim>` (default `asserted`); dialectical-move type on `<argument>` (required). The two vocabularies are distinct. |
| `attributed-to`  | `<claim>`, `<argument>`                                                               | String                                                            | Party to whom an attributed claim or argument is ascribed.                                                                                            |
| `same-as`        | `<claim>`                                                                             | Identifier or `prefix:id`                                         | Reference to a claim expressing the same proposition. Required when `mode="restated"`.                                                                |
| `source`         | `<claim>`                                                                             | URL                                                               | External source for an attributed claim, when distinct from an importable ArgML document.                                                             |
| `pattern`        | `<inference>`                                                                         | Pattern vocabulary (see §6)                                       | Compositional logical shape. Orthogonal to `scheme`.                                                                                                  |
| `provenance`     | `<claim>`, `<inference>`, `<conflict>`, `<term>` (decl), `<assumption>`, `<takeaway>` | Space-separated list of `<generator>` ids                         | Provenance chain for this element, in order of contribution.                                                                                          |
| `priority`       | `<takeaway>`                                                                          | `primary` \| `secondary` \| `load-bearing` (open)                 | Author's classification of the takeaway's argumentative role.                                                                                         |
| `ref`            | `<takeaway>`                                                                          | Identifier or `prefix:id`                                         | The claim this takeaway points at.                                                                                                                    |
| `kind`           | `<attitude>`                                                                          | `accept` \| `reject` \| `open`                                    | The reader's stance toward the target.                                                                                                                |
| `rejection-type` | `<attitude>`                                                                          | `rebut` \| `undermine` \| `undercut`                              | When `kind="reject"`, the type of rejection. Parallels `attack-type` on `<conflict>` (0.1 §11).                                                       |
| `target`         | `<attitude>`, `<substitution>`                                                        | `prefix:id`                                                       | The element in an imported post being addressed.                                                                                                      |
| `use`            | `<substitution>`                                                                      | `prefix:id`                                                       | The replacement element used in place of the target.                                                                                                  |
| `reader`         | `<reader-overlay>`                                                                    | String                                                            | Identifier for the reader authoring the overlay.                                                                                                      |
| `updated`        | `<reader-overlay>`                                                                    | ISO 8601 date                                                     | Most recent revision date.                                                                                                                            |
| `type`           | `<generator>`                                                                         | `human` \| `llm` \| `automated` (open)                            | Kind of generator.                                                                                                                                    |
| `who`            | `<generator>`                                                                         | String                                                            | Human generator's identifier.                                                                                                                         |
| `model`          | `<generator>`                                                                         | String                                                            | LLM generator's model identifier.                                                                                                                     |
| `role`           | `<generator>`                                                                         | `original-author` \| `extractor` \| `reviewer` \| `editor` (open) | Contribution role.                                                                                                                                    |

In addition to the attributes listed above, ArgML 0.2 extends the appearance of the following attributes defined in ArgML 0.1 §8 to include `<argument>` as a host: `supports`, `rests-on`, `via`. The semantics on `<argument>` parallel the corresponding semantics on `<claim>`, with the argument's content for graph purposes defined in §5.2.2. The 0.1 attributes `attacks` and `attack-type` do NOT extend to `<argument>` — refutational relations remain confined to `<claim>` (§5.2.3).

---

## 10. Lineage and Acknowledgements (Additions)

The additions in this proposal extend 0.1's lineage along the following axes.

**Takeaways**. The structural declaration of intended takeaways has no exact analog in argumentation theory, where the conclusion of an argument is typically inferred from graph topology (the terminal node). The closest precedents are the scholarly abstract, the IMRaD "Conclusions" section, and the "Key Findings" or "Recommendations" sections in policy documents — all of which serve to make explicit what graph topology only implies. The `priority="load-bearing"` value structurally encodes what authors typically signal in prose (e.g., the "epistemic status" preamble in ACX-style writing).

**Provenance**. The `<provenance>` / `<generator>` model is a compact specialization of W3C PROV-O (Lebo, Sahoo, McGuinness, et al., W3C Recommendation, 2013), which formalizes the agent–activity–entity triad underlying provenance claims. The single-document scope of ArgML allows simplification: agents and activities are collapsed into `<generator>` entries, and entities are the elements that reference them via the `provenance` attribute. The role vocabulary (`original-author`, `extractor`, `reviewer`, `editor`) follows the Schema.org `creator`/`contributor` distinction and the PREMIS event taxonomy.

**Mode on claims**. The mode vocabulary draws from three traditions. First, _speech act theory_ (Austin 1962; Searle 1969), which distinguishes illocutionary forces: assertive, expressive, directive, commissive. ArgML's `asserted` corresponds to the canonical assertive; `conceded` is a constrained commissive; `attributed` is a reportative reframing. Second, _Discourse Representation Theory_ (Kamp 1981; Heim 1982), which models subordinated discourse contexts (counterfactuals, attitude reports, modal scopes) as nested representational boxes — directly analogous to ArgML's nested `<argument>` regions. Third, _commitment store models_ in argumentation theory (Hamblin 1970; Walton and Krabbe 1995), which track propositional commitments by speaker; `mode="attributed"` and `mode="anticipated-objection"` express claims in stores other than the author's.

**Argument**. The `<argument>` element marks regions of prose that perform dialectical work — building support for claims through thought experiments, case-by-case demonstration, or extended attribution. It is named after Toulmin's (1958) "an argument" as a multi-part structured unit comprising data, warrant, backing, and claim; `<argument>` corresponds most closely to the data-and-warrant region that supports a claim. The support-only restriction reflects a principled distinction: rhetorical construction can build plausibility for a position but cannot refute another; refutation requires explicit propositional commitment, which lives on `<claim>`. This is consonant with Walton's account of how argumentation schemes (Walton, Reed, and Macagno 2008) are challenged — via critical questions, which take the form of explicit claims, not via further schemes. The decision to make arguments first-class graph nodes follows AIF's general principle (Chesñevar et al. 2006) that any argumentatively-significant unit is an addressable node. The markup pattern follows TEI's typed structural regions (`<div type="...">`, Burnard, Bauman, and the TEI Consortium, 1987–present). The mode vocabulary (`thought-experiment`, `case`, `attributed`) is open; future additions like `illustration` or `analogy` are anticipated as conventions develop.

**Inference patterns**. The pattern vocabulary is drawn from Gerhard Gentzen's natural deduction system (Gentzen 1934–35), refined through the natural deduction tradition (Prawitz 1965; Quine 1950; Copi 1953) and the structural-proof-theory literature (Negri and von Plato 2001). The orthogonality between `pattern` (compositional shape) and `scheme` (informal-reasoning kind) reflects Toulmin's (1958) original distinction between _formal-deductive_ and _substantive_ argumentation, elaborated by Walton (1996, 2008). The fixed enumeration deliberately omits scheme-bearing patterns (e.g., "argument from expert opinion" is not a natural-deduction shape and belongs to the `scheme` vocabulary).

**Reader overlay**. The reader-overlay model adapts two distinct traditions. First, the W3C Web Annotation Data Model (Sanderson, Ciccarese, Young, W3C Recommendation, 2017) and the Hypothes.is annotation infrastructure, which establish the pattern of overlay documents that reference target documents by stable identifier. ArgML's reader-overlay is the argumentation-graph analog of a text-span annotation. Second, ASPIC+'s attack taxonomy: the reader-side `rejection-type` mirrors the author-side `attack-type`, so that reader rejections and author-asserted attacks share semantics. The decision to keep reader-overlays as separate root documents (rather than as nested elements in posts) follows the Akoma Ntoso amendment idiom and the legal-informatics principle that one document does not modify another inline.

**Propagation semantics**. The four-status classification (`endorsed` / `supported` / `provisional` / `blocked`) follows Dung's abstract argumentation semantics (Dung 1995) in spirit: a node's acceptability depends on the acceptability of its attackers and supporters. ArgML 0.2's choice of monotonic graph traversal rather than Dung's grounded/preferred/stable semantics reflects the practical need for processors that can run on partial reader overlays without requiring full graph equilibrium computation. Implementations that wish to apply Dung semantics to the resolved graph MAY do so; the four-status classification is the minimum behavior.

---

## 11. References (Additions)

Austin, J. L. (1962). _How to Do Things With Words_. Harvard University Press.

Frege, G. (1879). _Begriffsschrift, eine der arithmetischen nachgebildete Formelsprache des reinen Denkens_.

Gentzen, G. (1934–35). _Untersuchungen über das logische Schließen_. Mathematische Zeitschrift, 39, 176–210, 405–431. English translation in Szabo (ed.), _The Collected Papers of Gerhard Gentzen_ (1969).

Hamblin, C. L. (1970). _Fallacies_. Methuen.

Heim, I. (1982). _The Semantics of Definite and Indefinite Noun Phrases_. PhD dissertation, University of Massachusetts Amherst.

Kamp, H. (1981). _A Theory of Truth and Semantic Representation_. In Groenendijk, Janssen, and Stokhof (eds.), _Formal Methods in the Study of Language_.

Lebo, T., Sahoo, S., and McGuinness, D. (eds.) (2013). _PROV-O: The PROV Ontology_. W3C Recommendation.

Negri, S. and von Plato, J. (2001). _Structural Proof Theory_. Cambridge University Press.

Prawitz, D. (1965). _Natural Deduction: A Proof-Theoretical Study_. Almqvist & Wiksell.

Reed, C., Wells, S., Devereux, J., and Rowe, G. _AIF+: Dialogue in the Argument Interchange Format_. Proceedings of COMMA 2008.

Sanderson, R., Ciccarese, P., and Young, B. (eds.) (2017). _Web Annotation Data Model_. W3C Recommendation.

Searle, J. R. (1969). _Speech Acts: An Essay in the Philosophy of Language_. Cambridge University Press.

Toulmin, S. E. (1958). _The Uses of Argument_. Cambridge University Press.

Walton, D. (1996). _Argumentation Schemes for Presumptive Reasoning_. Lawrence Erlbaum.

Walton, D. and Krabbe, E. C. W. (1995). _Commitment in Dialogue: Basic Concepts of Interpersonal Reasoning_. SUNY Press.

---

## Appendix A — RELAX NG Schema Additions (Informative)

The following RELAX NG Compact fragment extends the schema given in ArgML 0.1 Appendix A. Where production names collide with 0.1 productions, the 0.2 production supersedes.

```rnc
default namespace = "urn:argml:v1"

# --- Root: two document types ---

start = post | reader-overlay

# --- Additions to head ---

head = element head {
  metadata,
  provenance?,
  imports?,
  terms?,
  assumptions?,
  takeaways?
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

takeaways = element takeaways { takeaway* }

takeaway = element takeaway {
  attribute ref        { reference },
  attribute priority   { text }?,
  attribute provenance { id-list }?
}

# --- Claim additions ---

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

# --- Inference additions ---

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

# --- Productions inherited from 0.1 (id-list, reference, mixed-prose,
# credence-bucket, strength-bucket, numeric-credence) are unchanged ---
```

---

## Appendix B — Worked Example with New Features (Informative)

The following fragment marks up a section of "Morality without Consciousness" (IanWS, 2026) using ArgML 0.2 features. It demonstrates `<takeaways>`, `<provenance>`, `mode` on `<claim>`, `<argument>`, attribution, restatement via `same-as`, and `pattern` on `<inference>`. A companion `<reader-overlay>` follows.

### B.1 Post excerpt

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

Under the propagation semantics of §7.5, a conformant processor evaluating this overlay against the post computes:

| Takeaway | Status        | Reason                                                                                                                                                                              |
| -------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `C6.7`   | `provisional` | Same as `C4.9`; an ancestor (`C4.5`) is `open` in the overlay; no ancestor is rejected.                                                                                             |
| `C4.9`   | `provisional` | Same reason; ancestor `C4.5` is `open`.                                                                                                                                             |
| `C3.6`   | `blocked`     | The licensing inference `I-3.1` is rejected (undercut). The reader's rejection of `A-c-particle` further weakens the path to C3.5, though C3.5 retains independent textual support. |

The reader's rejection of `O4.1` (an anticipated-objection claim attacking C4.5) is itself an undercut-rejection of an attack: it does not block any takeaway, and it strengthens C4.7's status by endorsing its response. The reader's rejection of `A-c-particle` breaks the argument's support to C3.5 but does not propagate inward to any term or definition referenced inside the argument's prose (§5.2.2).

The substitution of `preference` is recorded but does not by itself alter the status of any claim. The reader's `open` attitude on `C4.5` reflects that the substitution's downstream consequences for the preference-based ethics framework remain unevaluated.

---

_End of ArgML 1.0 Working Draft 0.2 (proposed) — Additions._
