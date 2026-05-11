# ArgML 1.0 — Argument Markup Language

**Specification, Working Draft, Version 0.1**

| Field        | Value                 |
| ------------ | --------------------- |
| Date         | 11 May 2026           |
| Editor       | Ian Walker-Sperber    |
| Status       | Working Draft         |
| This version | `urn:argml:spec:v0.1` |
| Namespace    | `urn:argml:v1`        |

## Abstract

ArgML is an XML vocabulary for inline annotation of natural-language argumentative prose. It enables authors to mark up _term references_, _claims_, _inferences_, _assumptions_, and _conflicts_ directly within the body of a document, and to reference structures defined in other documents via a namespaced import mechanism. The primary target use case is rendering the argumentative structure of philosophical and rationalist essays explicit enough to support _double-cruxing_ — the localization of disagreement to a specific term, claim, assumption, or inference rule. ArgML borrows its argument-graph ontology from the Argument Interchange Format (AIF), its defeasibility model from ASPIC+, its inline-markup posture from the Text Encoding Initiative (TEI) and RDFa, and its cross-document reference model from XML Namespaces and Akoma Ntoso. Our long-term hope is that better specification languages for natural-language arguments can eventually assist in verification of machine-generated prose.

## Status of This Document

This is a Working Draft of the ArgML specification at version 0.1. It is subject to change. Implementations are encouraged but should expect breaking changes prior to a 1.0 Recommendation. Comments and corrections may be filed against the editor.

## Contents

1. Introduction
2. Conformance
3. Terminology
4. Document Structure
5. The Head Section
6. The Body Section
7. Element Reference
8. Attribute Reference
9. Identifier and Reference Resolution
10. Argumentation Schemes
11. Defeasibility and Conflict Types
12. Epistemic Markers
13. Lineage and Acknowledgements
14. References

Appendix A — RELAX NG Compact Schema (Informative)
Appendix B — Worked Example

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

ArgML draws on five distinct traditions. The argument-graph ontology — informational nodes (claims) bridged by scheme nodes (inferences, conflicts) — derives from the Argument Interchange Format (Chesñevar et al. 2006; Reed et al.). The defeasibility model — strict vs defeasible rules, with rebutting, undermining, and undercutting attacks — derives from ASPIC+ (Modgil & Prakken 2013) and ultimately from Pollock (1987). The inline-markup posture — wrapping spans of prose with semantically meaningful tags rather than producing a parallel formal artifact — derives from the Text Encoding Initiative (TEI 1987–) and RDFa (W3C 2008). The cross-document reference mechanism — namespace prefixes binding short identifiers to external resources — derives from XML Namespaces (W3C 1999) and the document-amendment patterns of Akoma Ntoso and LegalRuleML (OASIS). The canonical-reference pattern for terms — distinguishing a local identifier from a globally canonical IRI — derives from SKOS (W3C 2009). Full lineage attribution is given in Section 12.

---

## 2. Conformance

A _conformant ArgML document_ is a well-formed XML document whose root element is `<post>` in the `urn:argml:v1` namespace, and which satisfies the structural and reference constraints described in this specification.

A _conformant ArgML processor_ is software that accepts conformant ArgML documents as input and processes them according to the semantics described in this specification, in particular:

- Resolves identifier references within a document.
- Resolves namespaced cross-document references via declared imports.
- Distinguishes elements appearing in the `<head>` (declarations) from those appearing in `<body>` (annotations on prose).
- Preserves all unmarked prose verbatim when rendering.

The keywords _MUST_, _MUST NOT_, _SHOULD_, _SHOULD NOT_, and _MAY_ in this specification are to be interpreted as described in RFC 2119.

---

## 3. Terminology

**Argument graph** — The directed graph induced by a document's claims (nodes) and the support, attack, and dependency relations among them (edges).

**Claim** — A proposition asserted by the author, marked inline with a `<claim>` element. Claims are I-nodes in AIF terms.

**Assumption** — A proposition the author treats as foundational and does not argue for within the present document. Assumptions are id-addressable but semantically distinguished from claims by virtue of having no upstream support.

**Term** — A concept whose meaning is fixed for the duration of a document, either by reference to an external canonical definition or by an inline gloss. Terms have a _declaration_ (in the head) and zero or more _references_ (in the body).

**Inference** — A relation by which one or more claims support another claim. Inferences may be implicit (inferred from a `supports` attribute on a claim) or explicit (declared via an `<inference>` element).

**Conflict** — A relation by which one claim attacks another. Conflicts come in three varieties: _rebut_ (attack on a conclusion), _undermine_ (attack on a premise), and _undercut_ (attack on an inference rule). This taxonomy follows ASPIC+ and ultimately Pollock (1987).

**Defeasible** — An inference is defeasible if the author intends it as presumptive rather than deductive. Defeasible inferences can be undercut without their premises being false.

**Import** — A binding declared in the document head between a short prefix and an external document URL. Imports enable cross-document references via the syntax `prefix:identifier`.

**Double crux** — A protocol for localizing disagreement to a single shared upstream commitment (CFAR; Sabien 2017). ArgML's design is shaped by the goal of making such localization mechanically straightforward.

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

### 5.2 Imports

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

### 5.3 Terms

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

### 5.4 Assumptions

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
- `defeasible` — `"true"` (default) or `"false"`.
- `strength` — optional; the author's confidence that the premises license the conclusion. Qualitative bucket or numeric value in [0, 1]. Distinct from `defeasible`: defeasibility is a type (presumptive vs deductive), strength is a degree. See Section 12.

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

### `<assumption>`

| Field         | Value                                       |
| ------------- | ------------------------------------------- |
| Appears in    | `<assumptions>`                             |
| Content model | Text, optional `<note>`                     |
| Attributes    | `id` (required), `rests-on`                 |
| Lineage       | AIF I-node; Pollock's "prima facie" reasons |

Declares a proposition the author treats as foundational within the document.

### `<assumptions>`

| Field         | Value                                |
| ------------- | ------------------------------------ |
| Appears in    | `<head>`                             |
| Content model | Zero or more `<assumption>` elements |
| Attributes    | None                                 |

Container for assumption declarations.

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

| Field         | Value                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------ |
| Appears in    | `<body>` (inline within prose)                                                                               |
| Content model | Mixed: text, `<term>`, `<evidence>`, inline presentational markup                                            |
| Attributes    | `id` (required), `supports`, `attacks`, `attack-type`, `rests-on`, `via`, `defeasible`, `scheme`, `credence` |
| Lineage       | AIF I-node; ASPIC+ conclusion of a defeasible rule                                                           |

Wraps the prose asserting a proposition. The text content of the element _is_ the claim's natural-language statement.

### `<conflict>`

| Field         | Value                                                       |
| ------------- | ----------------------------------------------------------- |
| Appears in    | `<body>`                                                    |
| Content model | `<attacker>`, `<target>`, optional `<response>`             |
| Attributes    | `id` (required), `attack-type`                              |
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

### `<gloss>`

| Field         | Value                                 |
| ------------- | ------------------------------------- |
| Appears in    | `<term>`, `<evidence>`                |
| Content model | Text, with limited inline markup      |
| Attributes    | None                                  |
| Lineage       | TEI `<gloss>`; SKOS `skos:definition` |

A short natural-language definition or explanatory note.

### `<head>`

| Field         | Value                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------ |
| Appears in    | `<post>`                                                                                         |
| Content model | `<metadata>`, optional `<imports>`, optional `<terms>`, optional `<assumptions>` (in that order) |
| Attributes    | None                                                                                             |

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
| Appears in    | `<head>`                         |
| Content model | Zero or more `<import>` elements |
| Attributes    | None                             |

### `<inference>`

| Field         | Value                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------- |
| Appears in    | `<body>`                                                                                 |
| Content model | Optional text (the warrant)                                                              |
| Attributes    | `id` (required), `from` (required), `to` (required), `scheme`, `defeasible`, `strength`  |
| Lineage       | AIF RA-node (Rule of Inference Application); ASPIC+ defeasible rule; Toulmin's "warrant" |

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

### `<term>` (declaration form)

| Field         | Value                                      |
| ------------- | ------------------------------------------ |
| Appears in    | `<terms>`                                  |
| Content model | Optional `<gloss>`, zero or more `<alias>` |
| Attributes    | `id` (required), `canonical`, `scope`      |
| Lineage       | SKOS Concept; TEI `<term>`                 |

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

This section enumerates attributes that recur across multiple elements.

| Attribute     | Appears on                                                                                     | Type                                 | Description                                                                                 |
| ------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------- |
| `id`          | `<post>`, `<claim>`, `<inference>`, `<conflict>`, `<term>` (decl), `<assumption>`, `<section>` | Unique identifier                    | Local identifier; MUST be unique within the document.                                       |
| `ref`         | `<term>` (ref), `<evidence>`                                                                   | Identifier or `prefix:id`            | Reference to a declaration in the head or in an imported document.                          |
| `canonical`   | `<term>` (decl)                                                                                | URL or `prefix:id`                   | Globally canonical definition of the concept.                                               |
| `supports`    | `<claim>`                                                                                      | Space-separated id list              | Claims this claim supports.                                                                 |
| `attacks`     | `<claim>`                                                                                      | Space-separated id list              | Claims this claim attacks.                                                                  |
| `rests-on`    | `<claim>`, `<assumption>`                                                                      | Space-separated id list              | Assumptions or imported claims relied upon without local argument.                          |
| `attack-type` | `<claim>`, `<conflict>`                                                                        | `rebut` \| `undermine` \| `undercut` | Kind of attack. Default `rebut`. See Section 11.                                            |
| `via`         | `<claim>`                                                                                      | Inference id                         | Names the inference rule licensing this claim's support or attack.                          |
| `from`        | `<inference>`                                                                                  | Space-separated id list              | Premise claims or assumptions.                                                              |
| `to`          | `<inference>`                                                                                  | Identifier                           | Conclusion claim.                                                                           |
| `defeasible`  | `<claim>`, `<inference>`                                                                       | `true` \| `false`                    | Whether the inference is intended deductively. Default `true`.                              |
| `credence`    | `<claim>`                                                                                      | Bucket or numeric                    | Author's degree of belief in the proposition. See Section 12.                               |
| `strength`    | `<inference>`                                                                                  | Bucket or numeric                    | Author's confidence that premises license conclusion. See Section 12.                       |
| `scheme`      | `<claim>`, `<inference>`                                                                       | Scheme name (string)                 | Names an argumentation scheme. See Section 10.                                              |
| `scope`       | `<term>` (decl)                                                                                | `local` \| absent                    | If `local`, definition applies only within this document.                                   |
| `type`        | `<evidence>`                                                                                   | Evidence kind                        | One of `survey`, `experiment`, `testimony`, `citation`, `dataset`, `observation`, or other. |
| `prefix`      | `<import>`                                                                                     | NCName                               | Short prefix bound to an imported document.                                                 |
| `doc`         | `<import>`                                                                                     | URL                                  | URL of the imported document.                                                               |
| `status`      | `<note>`                                                                                       | String                               | Free-form status marker (e.g. `acknowledged-open`).                                         |
| `level`       | `<heading>`                                                                                    | Integer 1–6                          | Heading depth.                                                                              |

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

## 10. Argumentation Schemes

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

## 13. Lineage and Acknowledgements

ArgML is a synthesis rather than an invention. Each major design decision can be traced to a specific tradition:

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

---

## 14. References

Athan, T., Boley, H., Governatori, G., Palmirani, M., Paschke, A., and Wyner, A. (2013). _OASIS LegalRuleML_. Proceedings of the 14th International Conference on Artificial Intelligence and Law (ICAIL).

Bray, T., Hollander, D., Layman, A., Tobin, R., and Thompson, H. (eds.). _Namespaces in XML 1.0_. W3C Recommendation.

Chesñevar, C., McGinnis, J., Modgil, S., Rahwan, I., Reed, C., Simari, G., South, M., Vreeswijk, G., and Willmott, S. (2006). _Towards an Argument Interchange Format_. Knowledge Engineering Review, 21(4), 293–316.

Dung, P. M. (1995). _On the Acceptability of Arguments and Its Fundamental Role in Nonmonotonic Reasoning, Logic Programming and n-Person Games_. Artificial Intelligence, 77(2), 321–357.

Gordon, T. F., Prakken, H., and Walton, D. (2007). _The Carneades Model of Argument and Burden of Proof_. Artificial Intelligence, 171(10–15), 875–896.

Lenat, D. B. (1995). _CYC: A Large-Scale Investment in Knowledge Infrastructure_. Communications of the ACM, 38(11), 33–38.

Miles, A. and Bechhofer, S. (eds.) (2009). _SKOS Simple Knowledge Organization System Reference_. W3C Recommendation.

Modgil, S. and Prakken, H. (2013). _A General Account of Argumentation with Preferences_. Artificial Intelligence, 195, 361–397.

Pollock, J. L. (1987). _Defeasible Reasoning_. Cognitive Science, 11(4), 481–518.

Prakken, H. (2010). _An Abstract Framework for Argumentation with Structured Arguments_. Argument and Computation, 1(2), 93–124.

Sabien, D. (2017). _Double Crux: A Strategy for Mutual Understanding_. LessWrong.

Text Encoding Initiative Consortium. _TEI P5: Guidelines for Electronic Text Encoding and Interchange_.

W3C (2008, updated). _RDFa Core 1.1: Syntax and Processing Rules for Embedding RDF Through Attributes_. W3C Recommendation.

Walton, D., Reed, C., and Macagno, F. (2008). _Argumentation Schemes_. Cambridge University Press.

---

## Appendix A — RELAX NG Compact Schema (Informative)

The following RELAX NG Compact fragment captures the structural constraints of ArgML 1.0. It is informative; the prose of this specification is normative where the two diverge.

```rnc
default namespace = "urn:argml:v1"

start = post

post = element post {
  attribute id { xsd:ID },
  head,
  body
}

head = element head {
  metadata,
  imports?,
  terms?,
  assumptions?
}

metadata = element metadata {
  element title    { text },
  element author   { text }+,
  element date     { xsd:date }?,
  element source   { xsd:anyURI }?,
  element epistemic-status { mixed-prose }?
}

imports = element imports { import* }
import  = element import {
  attribute prefix { xsd:NCName },
  attribute doc    { xsd:anyURI }
}

terms = element terms { term-decl* }
term-decl = element term {
  attribute id        { xsd:ID },
  attribute canonical { xsd:anyURI | reference }?,
  attribute scope     { "local" }?,
  element gloss { mixed-prose }?,
  element alias { text }*
}

assumptions = element assumptions { assumption* }
assumption  = element assumption {
  attribute id       { xsd:ID },
  attribute rests-on { id-list }?,
  mixed-prose,
  element note { text }?
}

body = element body {
  ( section | p | inline-arg-element )*
}

section = element section {
  attribute id { xsd:ID }?,
  element heading {
    attribute level { xsd:integer },
    mixed-prose
  }?,
  ( p | section | inline-arg-element )*
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
  attribute id          { xsd:ID },
  attribute supports    { id-list }?,
  attribute attacks     { id-list }?,
  attribute attack-type { "rebut" | "undermine" | "undercut" }?,
  attribute rests-on    { id-list }?,
  attribute via         { reference }?,
  attribute defeasible  { "true" | "false" }?,
  attribute scheme      { text }?,
  attribute credence    { credence-bucket | numeric-credence }?,
  mixed-prose
}

inference = element inference {
  attribute id         { xsd:ID },
  attribute from       { id-list },
  attribute to         { reference },
  attribute scheme     { text }?,
  attribute defeasible { "true" | "false" }?,
  attribute strength   { strength-bucket | numeric-credence }?,
  mixed-prose
}

conflict = element conflict {
  attribute id          { xsd:ID },
  attribute attack-type { "rebut" | "undermine" | "undercut" }?,
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

mixed-prose = mixed { inline-arg-element* }
id-list     = list { reference+ }
reference   = xsd:string  # IDREF or "prefix:id"

credence-bucket  = "speculative" | "tentative" | "considered" | "confident" | "near-certain"
strength-bucket  = "weak" | "moderate" | "strong" | "deductive"
numeric-credence = xsd:decimal  # constrained to [0, 1]
```

---

## Appendix B — Worked Example (Informative)

The following fragment marks up an opening passage of "Morality without Consciousness" (IanWS, 2026) in ArgML 1.0.

```xml
<post xmlns="urn:argml:v1" id="morality-without-consciousness">

  <head>
    <metadata>
      <title>Morality without Consciousness</title>
      <author>IanWS</author>
      <date>2026-04-17</date>
      <source>https://www.lesswrong.com/posts/bWuhKA8bhsPGN7zRJ/morality-without-consciousness</source>
      <epistemic-status>Considered but speculative. The intrinsic/extrinsic
        distinction in section 2 is the load-bearing move; I would defend it
        but expect reasonable disagreement.</epistemic-status>
    </metadata>
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
      <term id="physicalism" canonical="sep:physicalism"/>
      <term id="preference" scope="local">
        <gloss>An expressed interest counter to the second law of thermodynamics.</gloss>
      </term>
    </terms>
    <assumptions>
      <assumption id="A1">I have phenomenal experience.</assumption>
    </assumptions>
  </head>

  <body>
    <section>
      <heading level="1">Introduction</heading>
      <p>A recent post by Linch, "The Fourth World", gets at an important
      implication of <term ref="consciousness">consciousness</term> — namely,
      that we ought to suspect further aspects of reality than we can today
      observe — but I am not sure it arrives there the right way.</p>

      <p>The author makes two assumptions which ought not to come for free.
      <claim id="C1.1" attacks="linch:dualism-premise" attack-type="undermine"
             credence="confident">
        Firstly, the author assumes that we could not explain
        <term ref="consciousness">consciousness</term> through
        <term ref="physicalism">physicalism</term>.
      </claim>
      <claim id="C1.2" supports="C1.1" credence="near-certain">
        This is already a strong claim, one with which about half of surveyed
        philosophers disagree<evidence type="survey"
        ref="https://survey2020.philpeople.org"/>.
      </claim></p>
    </section>

    <section>
      <heading level="1">Phenomena are Intrinsic</heading>
      <p>If we suppose an intrinsic, physicalist theory of
      <term ref="consciousness">consciousness</term>, then
      <claim id="C3" rests-on="A1" supports="C5" via="I2" credence="considered">our experience of
      pain is by definition inseparable from the pain reaction itself</claim>.</p>

      <inference id="I2" from="C1.1 C1.2" to="C3"
                 scheme="inference-to-best-explanation" defeasible="true"
                 strength="moderate">
        An intrinsic theory requires less deviation from contemporary
        neuroscience and sidesteps the problems of epiphenomenalism.
      </inference>
    </section>
  </body>
</post>
```

---

_End of ArgML 1.0 Specification, Working Draft 0.1._
