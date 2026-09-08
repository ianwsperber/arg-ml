# ArgML 0.3 — Argument Markup Language

**Specification, Working Draft, Version 0.3**

| Field        | Value                 |
| ------------ | --------------------- |
| Date         | 8 September 2026      |
| Editor       | Ian Walker-Sperber    |
| Status       | Working Draft         |
| This version | `urn:argml:spec:v0.3` |
| Supersedes   | `urn:argml:spec:v0.2` |
| Namespace    | `urn:argml:v2`        |

## Abstract

ArgML is an XML vocabulary for inline annotation of natural-language argumentative prose. Working Draft 0.3 binds that prose to a Bayesian belief network in the format of the SBBN Workbench: a `<claim>` in the body names a node of the network and one of its states, or names an edge, and the document's head embeds a verbatim snapshot of the subgraph the essay argues over. A claim's credence is not asserted by the author. It is the posterior probability of the bound node-state, computed by exact inference over the embedded snapshot given the observations the snapshot records. Because the snapshot is self-contained, an essay's numbers remain reproducible after the live network changes, and a processor can report how far the two have drifted.

Working Draft 0.3 is a breaking revision. It removes the argumentation-theoretic vocabulary of 0.1 and 0.2 (support and attack relations, inferences, conflicts, argument regions, discourse modes, schemes, patterns, author-asserted credences, and reader overlays) and replaces it with a single mechanism: binding to a network whose conditional structure has already been elicited elsewhere. The primary users of 0.3 are expected to be AI agents conducting philosophical research, for whom reproducible and comparable belief states matter more than rhetorical taxonomy.

## Status of This Document

This is a Working Draft of the ArgML specification at version 0.3. It is **not** backwards compatible with Working Drafts 0.1 and 0.2. Documents conformant with 0.2, including `<reader-overlay>` documents, are not conformant with 0.3, and there is no mechanical migration: a 0.2 argument graph carries no conditional probability tables and cannot be converted into a 0.3 snapshot without the elicitation work that the SBBN Workbench performs. The XML namespace has been changed from `urn:argml:v1` to `urn:argml:v2` so that a 0.3 processor can reject a 0.2 document with a single diagnostic.

The prior specification is preserved at `spec/historical/argml-spec-0.2.md` in the reference repository. Implementations are encouraged but should expect further breaking changes prior to a 1.0 Recommendation. Comments and corrections may be filed against the editor.

## Contents

1. Introduction
2. Conformance
3. Terminology
4. Document Structure
5. The Head Section
   5.1 Metadata
   5.2 Provenance
   5.3 The Model
6. The Body Section
   6.1 Prose and Presentational Markup
   6.2 Node-State Claims
   6.3 Edge Claims
   6.4 Unbound Claims
   6.5 Surface Form and Description
   6.6 Multiple Claims per Node
7. Element Reference
8. Attribute Reference
9. Binding and Resolution
10. Semantics
11. Snapshot and Live Comparison
12. Validation
13. Lineage and Acknowledgements
14. References

Appendix A — RELAX NG Compact Schema (Informative)
Appendix B — Worked Example (Informative)

---

## 1. Introduction

### 1.1 Motivation

Earlier drafts of ArgML aimed to make the structure of an essay visible enough that two readers could localise a disagreement to a specific definition, premise, or inferential step, in the spirit of the _double-crux_ technique (Sabien 2017). They did so by importing a vocabulary from argumentation theory: support and attack relations between claims, typed defeaters, inference schemes, and discourse modes. Those drafts deliberately refused to compute anything from the credences an author wrote down, on the grounds that prose does not carry the conditional dependencies a sound calculation would need.

The SBBN Workbench (Bryant 2026) supplies exactly what was missing. It represents a single belief topic as a Bayesian network in an augmented XMLBIF file: a root hypothesis, latent mechanisms, and observable evidence, connected by causal edges whose conditional probability tables are elicited deliberately and recorded with rationale and sources. SBBN leaves "a formal argumentation layer" out of scope. ArgML 0.3 is that layer for prose. It adds no formalism of its own. An essay binds its sentences to the nodes of a topic network, carries a snapshot of the subgraph it argues over, and lets a processor compute what the author's own model says about each sentence.

The result relocates disagreement. A reader who rejects a 0.3 claim is not rejecting a sentence; they are contesting a prior, a row of a conditional probability table, or a recorded observation, each of which has an identifier, a rationale, and cited sources. Those are better targets for a double crux than a number attached to a sentence.

### 1.2 Design Goals

1. **Annotation, not translation.** An ArgML document is readable as ordinary prose when its tags are stripped. The markup augments the text rather than replacing it.
2. **Binding, not restating.** Structure and numbers live in the network. The document binds prose to that structure by node identifier and does not re-encode it in a second vocabulary.
3. **Self-containment.** A document embeds the subgraph it depends on, verbatim, so its credences are reproducible from the document alone and remain interpretable after the live network changes.
4. **Computed, not asserted, credence.** A claim's credence is a posterior over the embedded snapshot. There is no attribute by which an author asserts a credence.
5. **Graduated formalization.** Authors bind only what they wish to make computable. Unmarked prose remains prose, and a marked sentence with no binding is permitted.

### 1.3 Non-Goals

ArgML is not a network editor. Adding a node, refining an edge into a mechanism, or eliciting a table are SBBN Workbench operations, and a document that needs new structure should obtain it there first. ArgML does not define soft (uncertain) evidence; observations are hard states, as in SBBN. ArgML does not link topics: every claim in a document binds to one snapshot of one topic. ArgML does not require an implementation to contain an inference engine; a processor may delegate inference to a reference tool, and the format's numbers are defined by exact inference regardless of which engine produces them.

### 1.4 Relationship to Prior Work

The network format is the SBBN Workbench's augmented XMLBIF (Bryant 2026), itself standard XMLBIF (Cozman 1998) with JSON metadata carried in `PROPERTY` elements. The inline-markup posture derives from the Text Encoding Initiative. The provenance record follows W3C PROV-O in simplified form. The semantics of credence are those of Bayesian networks (Pearl 1988); the worked example is a reframing of the Asia network of Lauritzen and Spiegelhalter (1988). Full lineage attribution is given in Section 13, including a note on the traditions 0.3 no longer draws on.

---

## 2. Conformance

A _conformant ArgML document_ is a well-formed XML document whose root element is `<post>` in the `urn:argml:v2` namespace, whose head contains exactly one `<model>` element, and which satisfies the structural, closure, and binding constraints of this specification (Sections 5, 6, 9, and 12).

A _conformant ArgML processor_ is software that accepts conformant documents and:

- Validates the embedded snapshot as an SBBN network according to the rules of Section 12, without requiring any external file.
- Resolves every claim binding against the snapshot (Section 9).
- Computes, or delegates to a reference tool the computation of, the posterior distribution of every bound node given the snapshot's recorded observations, by exact inference (Section 10). A processor MUST NOT substitute an approximate method without saying so in its output.
- Preserves all unmarked prose verbatim when rendering or transforming.

A _conformant comparison processor_ additionally implements Section 11 when given a live network alongside a document. The comparison profile is OPTIONAL.

A processor MUST reject a document whose root is in the retired `urn:argml:v1` namespace with a diagnostic that identifies it as a 0.2 document.

The keywords _MUST_, _MUST NOT_, _SHOULD_, _SHOULD NOT_, and _MAY_ in this specification are to be interpreted as described in RFC 2119.

---

## 3. Terminology

**Topic** — One independent belief domain, maintained as one SBBN network file (`bn.xml`). A document plugs into exactly one topic.

**Live network** — The current `bn.xml` of a topic, located by the `topic` attribute of `<model>`. It may have changed since the document was written.

**Snapshot** — The SBBN network embedded verbatim in a document's `<model>` element. It is a subgraph of the topic as it stood when the document was written, and it is the sole input to the document's own credences.

**Node** — A `VARIABLE` of the network: a proposition with two or more declared outcomes. Identified by its `NAME`.

**Outcome, state** — One of a node's declared values. SBBN's default is `True` followed by `False`.

**Node type** — SBBN's classification of a node as `hypothesis` (the topic's root question; exactly one per network), `latent` (an unobservable mechanism), or `evidence` (an observable fact about the topic's subject).

**Edge** — A causal, generative dependency of a child node on a parent node, recorded as a `GIVEN` in the child's `DEFINITION`. Edges point from cause to effect, which is the opposite of the direction in which evidence flows inferentially.

**Relation** — SBBN's qualitative sign on an edge (`supports`, `undermines`, their `_partially` variants, or free text), recording how the parent bears on the child in the source argument.

**Observation** — A hard record, in a node's metadata, that the topic's subject has been observed in one specific state, together with its source.

**Thesis** — The node the document argues. Defaults to the snapshot's hypothesis node.

**Node-state claim** — A `<claim>` bound to a node and one of its states. Its credence is the posterior probability of that state.

**Edge claim** — A `<claim>` bound to an edge. It asserts the dependency the child's table encodes; it has no single credence.

**Credence** — The posterior probability, under the snapshot, of a node-state given the snapshot's recorded observations. Always computed, never asserted.

**Prior view** — The same quantity with no observations conditioned on.

**Drift** — The difference between a posterior computed under the snapshot and the same posterior computed under the live network.

**Surface form** — The prose inside a `<claim>` element. **Description** — the canonical statement of the proposition, carried in the node's SBBN metadata.

---

## 4. Document Structure

Every ArgML document consists of a root `<post>` element containing exactly one `<head>` element followed by exactly one `<body>` element:

```xml
<post xmlns="urn:argml:v2" id="is-a-a-smoker">
  <head>
    <!-- metadata, optional provenance, the model -->
  </head>
  <body>
    <!-- prose with inline claims bound to the model -->
  </body>
</post>
```

The `<head>` is declarative and contains no prose intended for rendering. The `<body>` contains the document's prose with claims marked inline. 0.3 defines a single document type; the 0.2 `<reader-overlay>` type is withdrawn.

The `id` attribute on `<post>` is OPTIONAL and identifies the document for record-keeping only. Nothing in 0.3 references it.

---

## 5. The Head Section

The head's children appear in the fixed order `<metadata>`, `<provenance>` (optional), `<model>`.

### 5.1 Metadata

```xml
<metadata>
  <title>Is celebrity A a smoker?</title>
  <author>IanWS</author>
  <date>2026-09-08</date>
  <source>https://example.org/posts/is-a-a-smoker</source>
</metadata>
```

`<title>` is required. `<author>` may repeat. `<date>` is an ISO 8601 date and refers to the essay, not to the snapshot (see `taken`, Section 5.3.1). `<source>` is the document's own canonical URL, if it has one. The 0.2 `<epistemic-status>` element is withdrawn: the document's epistemic status is the thesis posterior (Section 10.4).

### 5.2 Provenance

The OPTIONAL `<provenance>` element contains zero or more `<generator>` elements, each declaring an entity that produced or reviewed the document:

```xml
<provenance>
  <generator id="g1" type="human" who="IanWS" date="2026-09-08" role="author"/>
  <generator id="g2" type="llm" model="claude-opus-4-7" date="2026-09-08" role="extractor"/>
</provenance>
```

Attributes on `<generator>` are unchanged from 0.2: `id` (required, unique), `type` (`human`, `llm`, `automated`; open), `who` (required for `human`), `model` (required for `llm`), `date`, and `role` (`author`, `extractor`, `reviewer`, `editor`; open). The 0.2 per-element `provenance` attribute is withdrawn; provenance in 0.3 is a document-level audit record, kept because the expected authors are agents whose model and date matter for later review.

### 5.3 The Model

The `<model>` element carries the snapshot and locates the topic it was taken from:

```xml
<model topic="topics/celebrity-smoking-status/bn.xml"
       thesis="is-smoker" taken="2026-07-06" revision="4f2c9e1">
  <BIF xmlns="" VERSION="0.3">
  <NETWORK>
  <NAME>celebrity-smoking-status</NAME>
  <!-- VARIABLE and DEFINITION elements, copied verbatim from bn.xml -->
  </NETWORK>
  </BIF>
</model>
```

Exactly one `<model>` MUST appear in the head. Its only element child is `<BIF>`.

#### 5.3.1 Attributes

| Attribute  | Required | Type          | Meaning                                                                                                                                                                                                                                                                       |
| ---------- | -------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `topic`    | yes      | URI reference | Location of the live `bn.xml` the snapshot was taken from, resolved against the document's own location. Relative paths and `http(s)` URLs are both permitted. Processors MUST NOT fetch it during validation or inference; only the comparison profile (Section 11) reads it. |
| `thesis`   | no       | node id       | The node the document argues. Defaults to the snapshot's unique `hypothesis` node. MUST name a node in the snapshot. Lets an essay argue a sub-question of a topic while still plugging into the full graph.                                                                 |
| `taken`    | no       | ISO 8601 date | When the snapshot was taken from the live network. Distinct from `<metadata><date>`.                                                                                                                                                                                          |
| `revision` | no       | string        | An opaque version identifier of the live file at `taken`, typically a git commit hash, so that an agent can reproduce the exact live state without date heuristics.                                                                                                              |

If the path component of `topic` ends in `<slug>/bn.xml`, then `<slug>` SHOULD equal the snapshot's `NETWORK/NAME`. A mismatch is a warning, not an error, because a URL's path layout is not always under the author's control.

#### 5.3.2 The snapshot

The `<BIF>` subtree is SBBN-augmented XMLBIF exactly as the SBBN Workbench specification (Bryant 2026, §5) defines it, and this section is a normative restatement of the parts a processor must understand. Where the two disagree, SBBN is authoritative for the network format and this document is authoritative for how ArgML uses it.

**Namespace.** The subtree MUST reset the default namespace with `xmlns=""` on `<BIF>`. SBBN's schema declares no target namespace, and inference tools expect unqualified element names. A snapshot whose `<BIF>` inherits `urn:argml:v2` is invalid.

**Structure.** `BIF` (with a `VERSION` attribute) contains one `NETWORK`, which contains a `NAME`, one or more `VARIABLE` elements, and one or more `DEFINITION` elements. Each `VARIABLE` has `TYPE="nature"`, a `NAME`, two or more `OUTCOME` elements in declared order, and exactly one `PROPERTY` whose text begins `sbbn:meta = ` followed by a single-line JSON object. Each `DEFINITION` has a `FOR`, zero or more `GIVEN` parents in declared order, a `TABLE`, and one `PROPERTY` per `GIVEN` whose text begins `sbbn:edge:<parent-id> = ` followed by a JSON object.

**Identifiers.** Node identifiers (`NAME`, `FOR`, `GIVEN`) match `[a-z0-9]+(-[a-z0-9]+)*`. The human-readable proposition lives in the metadata `description`, never in the identifier.

**Node metadata.** The `sbbn:meta` object has required fields `type` (`hypothesis`, `latent`, or `evidence`), `description`, `rationale`, `sources` (an array, possibly empty, of `{title, url?, date?, note?}`), and `last_updated`; and an optional `observation` of the form `{"state": <an OUTCOME>, "source": {title, url?, date?, note?}}`. Exactly one node in a snapshot has `type` `hypothesis`.

**Edge metadata.** The `sbbn:edge:<parent>` object has required fields `relation`, `rationale`, and `sources`. `relation` is one of `supports`, `undermines`, `supports_partially`, `undermines_partially`, or free text.

**Tables.** For a `DEFINITION` with `FOR` node X (outcomes x₁…xₙ in declared order) and parents P₁…Pₖ in `GIVEN` order, `TABLE` is a whitespace-separated list of numbers grouped into one block per combination of parent outcomes, enumerated in nested-loop order with P₁ outermost and Pₖ innermost. Within a block the entries are P(X = x₁ | combination) … P(X = xₙ | combination). Each block sums to 1.0 within ±0.001. A root node's table is a single block: its prior. Full tables are REQUIRED; 0.3 defines no shorthand.

**Verbatim.** The subtree SHOULD be a byte-faithful copy of the corresponding elements of the live network at `taken`, including whitespace. Processors MUST NOT normalise, reorder, or re-serialise it other than to hand it to an XMLBIF reader, and a processor that exports the snapshot to a standalone file MUST do so by copying the source text and removing only the `xmlns=""` reset. The format does not require the snapshot to agree with the live network: an author MAY deliberately fork a prior or a table, and Section 11 is how such a fork is made visible.

#### 5.3.3 Closure

The snapshot MUST be a valid SBBN network on its own. In particular: every `FOR` and every `GIVEN` names a `VARIABLE` in the snapshot; every `VARIABLE` has exactly one `DEFINITION`; the parent graph is acyclic; exactly one node is the hypothesis. Additionally, every node named by a `<claim>` (through `node`, or either endpoint of `edge`) and by `thesis` MUST be present.

The consequence is that a snapshot is a **parent-closed** sub-DAG of the topic. An author may omit descendants of the nodes they argue over, including observed ones, and the posteriors will differ from the live network's accordingly (Section 11 reports it). An author may not omit a parent, because doing so would require rewriting the child's table, which the verbatim rule forbids. The topic's hypothesis node is always present because the one-hypothesis rule requires it.

---

## 6. The Body Section

### 6.1 Prose and Presentational Markup

The `<body>` contains prose organised into paragraphs (`<p>`) and optional sections (`<section>` with a `<heading>` child). Sections may nest. The inline elements `<em>`, `<strong>`, `<code>`, and `<a>` are permitted and treated as presentational; any other non-ArgML inline element is likewise treated as presentational and passed through. Presentational elements MUST NOT contain a `<claim>`.

### 6.2 Node-State Claims

A claim is bound to a node and a state by wrapping the asserting sentence or clause in a `<claim>` element:

```xml
<p><claim id="c-thesis" node="is-smoker">A is, I think, a regular smoker.</claim></p>
<p><claim node="dyspnoea">A has been short of breath for months.</claim></p>
<p><claim node="tuberculosis" state="False">TB is unlikely to be the whole story.</claim></p>
```

Attributes:

- `node` — the `NAME` of a `VARIABLE` in the snapshot.
- `state` — one of that node's declared `OUTCOME` values. It MAY be omitted only when the node has exactly two outcomes, in which case it denotes the **first declared outcome** (`True` under SBBN's default). For a node with three or more outcomes `state` is REQUIRED.
- `id` — OPTIONAL. Identifiers exist so that prose can be anchored and quoted; the binding key is the node, not the identifier. If present, `id` MUST be unique within the document.

The claim's proposition is the node's description evaluated at the given state. For a two-outcome node, binding to the second outcome asserts the negation of the description. Claims MUST NOT nest.

### 6.3 Edge Claims

A sentence that asserts a causal or evidential dependency, rather than a fact about the subject, is bound to an edge:

```xml
<p><claim edge="is-smoker lung-cancer">Smoking is the dominant cause of lung cancer.</claim></p>
```

The `edge` attribute holds exactly two whitespace-separated node identifiers, `parent child`, in causal order. The pair MUST correspond to a `GIVEN` of the child's `DEFINITION`. A reversed pair is an error, and processors SHOULD say so when the reverse edge exists. `node` and `state` MUST NOT appear together with `edge`.

An edge claim asserts the dependency encoded in the child's table: that P(child | parent, other parents) varies with the parent in the direction the edge's `relation` declares. Its numerical content is given in Section 10.5.

### 6.4 Unbound Claims

A `<claim>` with neither `node` nor `edge` is permitted. It marks a sentence the author regards as a claim for which the topic has no node yet. It has no credence, and processors SHOULD emit a warning so that the gap is visible; for agent workflows the warning is the signal that a `bn-revise` step is owed.

### 6.5 Surface Form and Description

The prose inside a `<claim>` is the **surface form**: the author's wording in this document, which may differ from the node's `description` in emphasis, register, or tense but MUST NOT differ in meaning. The description is the **canonical proposition**. Processors are not expected to check the two mechanically; they SHOULD present the description alongside the surface form so that a reviewer can catch drift. This is the 0.3 replacement for the 0.2 term mechanism: ambiguity is resolved in the node's description, once per topic, rather than in a per-document glossary.

### 6.6 Multiple Claims per Node

Several claims MAY bind the same node and state. They express the same proposition, share one credence, and SHOULD be linked by renderers. This replaces the 0.2 `same-as` attribute and `restated` mode, and it is the normal way an essay restates its thesis in a conclusion.

---

## 7. Element Reference

Elements are listed alphabetically. The SBBN elements inside `<BIF>` are listed under their upper-case names; they are foreign to the ArgML namespace and are defined normatively by SBBN.

### `<a>`, `<em>`, `<strong>`, `<code>`

| Field         | Value                                          |
| ------------- | ---------------------------------------------- |
| Appears in    | `<p>`, `<heading>`, `<claim>`, each other      |
| Content model | Text and presentational inline elements        |
| Attributes    | Any; passed through (`href` on `<a>`)          |
| Lineage       | HTML                                           |

Presentational markup. Ignored by the semantics layer. MUST NOT contain `<claim>`.

### `<author>`

| Field         | Value        |
| ------------- | ------------ |
| Appears in    | `<metadata>` |
| Content model | Text         |
| Attributes    | None         |

An author of the document. May repeat.

### `<BIF>` (foreign)

| Field         | Value                                  |
| ------------- | -------------------------------------- |
| Appears in    | `<model>`                              |
| Content model | One `NETWORK`                          |
| Attributes    | `VERSION` (required), `xmlns=""` (required) |
| Lineage       | XMLBIF (Cozman 1998); SBBN §5          |

Root of the embedded snapshot. See Section 5.3.2.

### `<body>`

| Field         | Value                       |
| ------------- | --------------------------- |
| Appears in    | `<post>`                    |
| Content model | `<section>` and `<p>`       |
| Attributes    | None                        |

Container for the document's prose.

### `<claim>`

| Field         | Value                                                       |
| ------------- | ----------------------------------------------------------- |
| Appears in    | `<p>`, `<heading>`                                          |
| Content model | Text and presentational inline elements; no nested `<claim>` |
| Attributes    | `id`, `node`, `state`, `edge`                               |
| Lineage       | TEI inline annotation; the I-node of AIF, now bound to a BN variable |

A sentence or clause bound to a node-state (Section 6.2), to an edge (Section 6.3), or to nothing (Section 6.4).

### `<date>`

| Field         | Value           |
| ------------- | --------------- |
| Appears in    | `<metadata>`    |
| Content model | ISO 8601 date   |
| Attributes    | None            |

Date of the essay.

### `<DEFINITION>`, `<FOR>`, `<GIVEN>`, `<TABLE>` (foreign)

| Field         | Value                                                              |
| ------------- | ------------------------------------------------------------------ |
| Appears in    | `<NETWORK>`                                                        |
| Content model | `FOR`, `GIVEN`*, `TABLE`, `PROPERTY`* (one per `GIVEN`)            |
| Lineage       | XMLBIF; SBBN §5.4–5.5                                              |

A node's parents and conditional probability table. See Section 5.3.2.

### `<generator>`

| Field         | Value                                                   |
| ------------- | ------------------------------------------------------- |
| Appears in    | `<provenance>`                                          |
| Content model | Empty                                                   |
| Attributes    | `id` (required), `type`, `who`, `model`, `date`, `role` |
| Lineage       | PROV-O agent                                            |

An entity that produced or reviewed the document.

### `<head>`

| Field         | Value                                           |
| ------------- | ----------------------------------------------- |
| Appears in    | `<post>`                                        |
| Content model | `<metadata>`, `<provenance>`?, `<model>` in order |
| Attributes    | None                                            |

### `<heading>`

| Field         | Value                                  |
| ------------- | -------------------------------------- |
| Appears in    | `<section>`                            |
| Content model | Text, presentational inline, `<claim>` |
| Attributes    | `level` (integer)                      |

### `<metadata>`

| Field         | Value                                              |
| ------------- | -------------------------------------------------- |
| Appears in    | `<head>`                                           |
| Content model | `<title>`, `<author>`+, `<date>`?, `<source>`?     |
| Attributes    | None                                               |

### `<model>`

| Field         | Value                                        |
| ------------- | -------------------------------------------- |
| Appears in    | `<head>`                                     |
| Content model | One `<BIF>`                                  |
| Attributes    | `topic` (required), `thesis`, `taken`, `revision` |

The embedded snapshot and its provenance in the topic. See Section 5.3.

### `<NETWORK>`, `<NAME>` (foreign)

| Field         | Value                                       |
| ------------- | ------------------------------------------- |
| Appears in    | `<BIF>`; `<NETWORK>` and `<VARIABLE>`       |
| Content model | `NAME`, `VARIABLE`+, `DEFINITION`+          |
| Lineage       | XMLBIF                                      |

### `<p>`

| Field         | Value                                  |
| ------------- | -------------------------------------- |
| Appears in    | `<body>`, `<section>`                  |
| Content model | Text, presentational inline, `<claim>` |
| Attributes    | None                                   |

### `<post>`

| Field         | Value                     |
| ------------- | ------------------------- |
| Appears in    | Document root             |
| Content model | `<head>`, `<body>`        |
| Attributes    | `xmlns` (required, `urn:argml:v2`), `id` |

### `<PROPERTY>` (foreign)

| Field         | Value                                                            |
| ------------- | ---------------------------------------------------------------- |
| Appears in    | `<VARIABLE>`, `<DEFINITION>`                                     |
| Content model | Text: `sbbn:meta = {…}` or `sbbn:edge:<parent> = {…}`            |
| Lineage       | XMLBIF property; SBBN §5.3–5.4; PromptBN metadata                |

### `<provenance>`

| Field         | Value           |
| ------------- | --------------- |
| Appears in    | `<head>`        |
| Content model | `<generator>`*  |
| Attributes    | None            |

### `<section>`

| Field         | Value                                    |
| ------------- | ---------------------------------------- |
| Appears in    | `<body>`, `<section>`                    |
| Content model | `<heading>`?, then `<p>` and `<section>` |
| Attributes    | `id`                                     |

### `<source>`

| Field         | Value        |
| ------------- | ------------ |
| Appears in    | `<metadata>` |
| Content model | URL          |

The document's own canonical URL.

### `<title>`

| Field         | Value        |
| ------------- | ------------ |
| Appears in    | `<metadata>` |
| Content model | Text         |

### `<VARIABLE>`, `<OUTCOME>` (foreign)

| Field         | Value                                              |
| ------------- | -------------------------------------------------- |
| Appears in    | `<NETWORK>`                                        |
| Content model | `NAME`, `OUTCOME`{2,}, one `PROPERTY`              |
| Attributes    | `TYPE="nature"`                                    |
| Lineage       | XMLBIF; SBBN §5.3                                  |

A node of the network. See Section 5.3.2.

---

## 8. Attribute Reference

| Attribute  | Appears on                                    | Type                                     | Description                                                                                                          |
| ---------- | --------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `date`     | `<generator>`                                 | ISO 8601 date                            | When the generator acted.                                                                                            |
| `edge`     | `<claim>`                                     | Two node ids, `parent child`             | Binds the claim to an edge of the snapshot. Exclusive with `node` and `state`.                                        |
| `id`       | `<post>`, `<section>`, `<claim>`, `<generator>` | Unique identifier                      | Local identifier; MUST be unique within the document where present. Required only on `<generator>`.                  |
| `level`    | `<heading>`                                   | Integer 1–6                              | Heading depth.                                                                                                       |
| `model`    | `<generator>`                                 | String                                   | LLM generator's model identifier. Required when `type="llm"`.                                                        |
| `node`     | `<claim>`                                     | Node id                                  | Binds the claim to a `VARIABLE` of the snapshot.                                                                     |
| `revision` | `<model>`                                     | String                                   | Version identifier of the live network at `taken`.                                                                   |
| `role`     | `<generator>`                                 | `author` \| `extractor` \| `reviewer` \| `editor` (open) | Contribution role.                                                                                   |
| `state`    | `<claim>`                                     | An `OUTCOME` of `node`                   | The bound state. Defaults to the first declared outcome on two-outcome nodes; required otherwise.                    |
| `taken`    | `<model>`                                     | ISO 8601 date                            | When the snapshot was taken.                                                                                         |
| `thesis`   | `<model>`                                     | Node id                                  | The node the document argues. Defaults to the hypothesis node.                                                       |
| `topic`    | `<model>`                                     | URI reference                            | Location of the live network.                                                                                        |
| `type`     | `<generator>`                                 | `human` \| `llm` \| `automated` (open)   | Kind of generator.                                                                                                   |
| `who`      | `<generator>`                                 | String                                   | Human generator's identifier. Required when `type="human"`.                                                          |
| `xmlns`    | `<post>`, `<BIF>`                             | Namespace URI                            | `urn:argml:v2` on `<post>`; the empty string on `<BIF>`.                                                             |

Attributes on the foreign elements (`VERSION`, `TYPE`) are defined by XMLBIF and SBBN.

---

## 9. Binding and Resolution

Resolution is local to the document. There are no cross-document references in 0.3; the 0.2 import mechanism is withdrawn.

1. A `node` attribute resolves to the `VARIABLE` whose `NAME` equals it. Failure is an error.
2. A `state` attribute resolves to one of that variable's `OUTCOME` values. Failure is an error. An absent `state` resolves to the first declared outcome if the variable has exactly two outcomes, and is an error otherwise.
3. An `edge` attribute is split on whitespace into exactly two identifiers, `parent` and `child`; it resolves to the `DEFINITION` whose `FOR` is `child` and which lists `parent` among its `GIVEN` elements. Failure is an error.
4. A `thesis` attribute resolves as a `node`. Its absence resolves to the unique `hypothesis` node.
5. Identifiers on `<claim>`, `<section>`, and `<generator>` share one namespace and MUST be unique.

Node identifiers are shared across every document written against the same topic. Two documents that bind the same identifier assert propositions about the same node, which is what allows a reader to compare or merge them (Section 11).

---

## 10. Semantics

### 10.1 Credence as Posterior

Let S be the snapshot and let O be the set of pairs (n, s) such that node n's metadata records an `observation` with `state` s. The **credence** of a node-state claim bound to (n, s) is

P_S(n = s | O),

the posterior probability computed by exact inference over S conditioned on every recorded observation. Exact inference means variable elimination or an equivalent method that returns the true posterior; SBBN networks are small and sparse, so this is cheap. Every claim bound to the same (n, s) has the same credence.

Credences are computed, never asserted. There is no attribute by which an author records a credence on a claim, and a processor MUST NOT accept one.

### 10.2 Observed Nodes

If n has a recorded observation with state s₀, then its posterior is a point mass: the credence of a claim bound to (n, s₀) is 1, and the credence of a claim bound to (n, s) for s ≠ s₀ is 0. Processors SHOULD mark such claims as observed rather than merely as certain, and SHOULD warn when a claim binds an observed node at a state other than the recorded one.

### 10.3 Prior View and What-If

The **prior view** of a node-state is P_S(n = s) with no observations conditioned on. Processors SHOULD report prior and posterior side by side. Processors MAY additionally offer **what-if** conditioning, in which the recorded observations are overridden or extended with caller-supplied states; this is a processor feature and leaves the document unchanged.

Elicited tables are coarse, so posteriors SHOULD be presented to two decimal places. Additional digits are spurious.

### 10.4 The Thesis

The document's headline result is the full posterior distribution over the thesis node's outcomes given O. This replaces the 0.2 `<takeaways>` and `<epistemic-status>` mechanisms: what an essay concludes, and how confidently, is read off its own model rather than declared.

### 10.5 Edge Claims

An edge claim bound to parent p and child c denotes the **edge effect**: for every assignment o of c's other parents, the rows P(c | p = pᵢ, o) for each outcome pᵢ of p. It has no single credence, because the existence of an edge is not a random variable in the network.

Processors SHOULD display the edge's `relation` and its effect rows. When both p and c have exactly two outcomes, processors SHOULD additionally report the likelihood ratio

LR(o) = P(c = c₁ | p = p₁, o) / P(c = c₁ | p = p₂, o),

where c₁ and p₁ are the first declared outcomes, as a single number when c has no other parents and as a minimum-to-maximum range across o otherwise.

### 10.6 The Relation-Sign Rule

The `relation` on an edge is the author's declared qualitative sign. For an edge p → c where both nodes have exactly two outcomes, the table determines the sign, and a processor SHOULD check them against each other. Let a(o) = P(c = c₁ | p = p₁, o) and b(o) = P(c = c₁ | p = p₂, o) for every assignment o of c's other parents, with c₁ and p₁ the first declared outcomes.

- `supports` and `supports_partially` expect a(o) ≥ b(o) for every o, with strict inequality for at least one.
- `undermines` and `undermines_partially` expect a(o) ≤ b(o) for every o, with strict inequality for at least one.
- A strict violation anywhere is a warning: the declared sign contradicts the table.
- a(o) = b(o) for every o is a separate warning: the edge carries no information.

Other `relation` values, and edges involving a node with more than two outcomes, are not checked. Because the check uses the first declared outcome as the positive state, it agrees with the `state` default of Section 6.2; a topic whose nodes declare outcomes in another order will be checked against that order.

### 10.7 Reversal of 0.2 Section 12.4

Working Draft 0.2 refused to specify any calculus over credences, giving three reasons: sound propagation requires conditional dependencies that authors will not annotate at the needed density; unsound numeric outputs invite mistaken trust; and the structural information alone is independently useful.

0.3 accepts the first reason as correct and answers it. The conditional structure is not annotated in prose. It is supplied by the SBBN network, whose tables were elicited deliberately, with rationale and sources, and are preserved verbatim in the snapshot. The second reason is addressed by making computation exact and reproducible rather than heuristic, and by the two-decimal presentation rule. The third survives unchanged: the graph is still there, and it is now a graph whose edges mean something precise.

What is given up is author-asserted credence as a signal distinct from the model. Under 0.3 a disagreement with a credence is a disagreement with a prior, a table row, or an observation, each addressable by node identifier. That is the trade this draft makes, and it is made deliberately.

---

## 11. Snapshot and Live Comparison

A conformant comparison processor is given a document with snapshot S and reads the live network L from `topic`. If L cannot be read, the processor reports that and stops; the document remains valid on its own.

The processor reports:

- **Structure.** Nodes in S but not L and in L but not S. Edges (parent–child pairs) in S but not L and in L but not S. For nodes present in both, changes to the outcome list (which make the node incomparable) and to `type`.
- **Parameters.** For every `DEFINITION` present in both, whether the table differs, and the largest absolute difference per block. Root nodes' priors are included.
- **Evidence.** Observations added, removed, or changed in state. Changes to `description` are reported as informational.
- **Posteriors.** For the thesis and for every node bound by a claim, three values: P_S(· | O_S), P_L(· | O_L), and P_L(· | O_S), the last being the live structure evaluated under the snapshot's evidence. Reporting all three lets structural drift and evidential drift be told apart.

**Drift** is |P_S(thesis) − P_L(thesis)| on the thesis's first outcome. Processors SHOULD flag drift above a caller-configurable threshold. Nodes bound by claims but absent from L are reported as unresolvable in the live network; they are not errors.

Comparison is read-only. Folding a document's snapshot back into a live network is an SBBN Workbench operation and is out of scope for this specification.

---

## 12. Validation

A conformant processor checks the following and reports each failure with a stable diagnostic code. Severity `error` means the document is not conformant; `warning` means it is conformant but suspect. Codes retired from 0.2 are never reused.

**Parse-stage (structural)**

| Code       | Severity | Rule                                                                                   |
| ---------- | -------- | -------------------------------------------------------------------------------------- |
| `PARSE001` | error    | Malformed XML.                                                                         |
| `PARSE002` | error    | Root `<post>` is not in `urn:argml:v2`.                                                |
| `PARSE003` | error    | Root element is not `<post>`.                                                          |
| `PARSE004` | error    | `<post>` lacks `<head>` or `<body>`.                                                   |
| `PARSE005` | warning  | Unknown element in a recognised parent; dropped.                                       |
| `PARSE006` | warning  | `<head>` lacks `<metadata>`; placeholder substituted.                                  |
| `PARSE008` | warning  | `<heading level>` is not an integer; defaults to 1.                                    |
| `PARSE010` | warning  | Head children out of order (`metadata`, `provenance`, `model`).                        |
| `PARSE013` | warning  | `<generator>` lacks `id`.                                                              |
| `PARSE017` | error    | Root declares the retired `urn:argml:v1`: this is a 0.2 document.                      |
| `PARSE018` | error    | `<head>` has zero or more than one `<model>`.                                          |
| `PARSE019` | error    | `<model>` has no `<BIF>` child, or `<BIF>` is not in the null namespace.               |
| `PARSE020` | error    | `<model>` lacks `topic`.                                                               |

**Network (`MODEL`)**

| Code       | Severity | Rule                                                                                                                       |
| ---------- | -------- | -------------------------------------------------------------------------------------------------------------------------- |
| `MODEL001` | error    | Snapshot fails the XMLBIF profile: no `NETWORK` or `NAME`, `BIF` without `VERSION`, `VARIABLE` without `NAME` or with `TYPE` other than `nature`, `DEFINITION` without `FOR` or `TABLE`. |
| `MODEL002` | error    | An identifier does not match `[a-z0-9]+(-[a-z0-9]+)*`.                                                                    |
| `MODEL003` | error    | Duplicate `VARIABLE` `NAME`.                                                                                                |
| `MODEL004` | error    | Fewer than two `OUTCOME` values, or duplicate outcomes, on a node.                                                          |
| `MODEL005` | error    | A `VARIABLE` does not carry exactly one `sbbn:meta` property.                                                               |
| `MODEL006` | error    | An `sbbn:meta` or `sbbn:edge:*` payload is not valid JSON.                                                                  |
| `MODEL007` | error    | Metadata lacks a required field, or `type` is not one of `hypothesis`, `latent`, `evidence`, or edge metadata lacks `relation`, `rationale`, or `sources`. |
| `MODEL008` | error    | The number of nodes with `type` `hypothesis` is not exactly one.                                                            |
| `MODEL009` | error    | `observation.state` is not one of the node's outcomes.                                                                      |
| `MODEL010` | error    | `FOR` or `GIVEN` names an undeclared node, or a node has zero or multiple `DEFINITION` elements.                            |
| `MODEL011` | error    | `TABLE` contains a non-numeric entry, or its length is not the product of the child's and parents' outcome counts.          |
| `MODEL012` | error    | A table block does not sum to 1.0 within ±0.001.                                                                           |
| `MODEL013` | error    | A `GIVEN` has no matching `sbbn:edge:<parent>` property on the same `DEFINITION`.                                          |
| `MODEL014` | warning  | An `sbbn:edge:<x>` property names an `x` that is not a `GIVEN` of that `DEFINITION`.                                        |
| `MODEL015` | error    | The parent graph contains a cycle.                                                                                          |
| `MODEL016` | warning  | The declared `relation` contradicts the table's sign, or the table is constant in the parent (Section 10.6).                |

**Binding (`ARGML`)**

| Code       | Severity | Rule                                                                                             |
| ---------- | -------- | ------------------------------------------------------------------------------------------------ |
| `ARGML001` | error    | Duplicate `id` within the document.                                                              |
| `ARGML031` | warning  | Unbound `<claim>` (neither `node` nor `edge`).                                                    |
| `ARGML032` | error    | `node` does not resolve to a snapshot `VARIABLE`.                                                 |
| `ARGML033` | error    | `state` is not one of the node's outcomes, or is omitted on a node with more than two outcomes.  |
| `ARGML034` | error    | `edge` is not exactly two identifiers, or the pair is not a `GIVEN` of the child (message notes a reversed edge if one exists). |
| `ARGML035` | error    | A claim carries both `node` and `edge`, or `state` together with `edge`.                          |
| `ARGML036` | error    | Claims are bound but the head has no usable `<model>`.                                            |
| `ARGML037` | error    | `thesis` does not resolve to a snapshot `VARIABLE`.                                               |
| `ARGML038` | warning  | A claim binds an observed node at a state other than the recorded observation; its credence is 0. |
| `ARGML039` | warning  | `NETWORK/NAME` differs from the `<slug>` in `topic="…/<slug>/bn.xml"`.                            |
| `ARGML040` | error    | Nested `<claim>`.                                                                                 |

**Comparison (`DIFF`, comparison profile only)**

| Code      | Severity | Rule                                                    |
| --------- | -------- | ------------------------------------------------------- |
| `DIFF001` | warning  | The live network at `topic` could not be read.          |
| `DIFF002` | warning  | A node bound by a claim is absent from the live network. |
| `DIFF003` | warning  | A node's outcome list changed; it is incomparable.      |
| `DIFF004` | info     | A table or prior changed.                               |
| `DIFF005` | info     | An edge was added or removed.                           |
| `DIFF006` | info     | An observation was added, removed, or changed.          |
| `DIFF007` | warning  | Thesis drift exceeds the configured threshold.          |

---

## 13. Lineage and Acknowledgements

### 13.1 Retained from Earlier Drafts

**Inline semantic markup of prose.** From the Text Encoding Initiative (Burnard, Bauman, and the TEI Consortium, 1987–present) and RDFa (W3C 2008). The `<claim>` element wrapping a span of prose is the same construction as TEI inline references.

**Double crux.** The design driver remains the double-crux protocol (Sabien 2017). 0.3 changes what a crux points at: a node, a table row, or an observation rather than a sentence.

**Provenance.** The `<provenance>` and `<generator>` model remains a compact specialisation of W3C PROV-O (Lebo, Sahoo, McGuinness, et al., 2013).

### 13.2 New in Working Draft 0.3

**The SBBN Workbench** (Bryant 2026). The network format, the hypothesis / latent / evidence typing, the elicitation discipline, the observation record, the distinction between causal edge direction and inferential `relation`, and the five manual validation checks are all SBBN's. ArgML 0.3 is designed as the prose layer SBBN describes as future work, and it deliberately adds no formalism of its own on top of SBBN's.

**XMLBIF** (Cozman 1998). The interchange format for Bayesian networks that SBBN augments. Embedding it verbatim, rather than translating it, is what lets SBBN's schema, validator, visualiser, and inference tool run unchanged on an exported snapshot.

**Bayesian networks** (Pearl 1988). The semantics of credence, conditional independence, and explaining-away that 0.3 inherits without modification.

**The Asia network** (Lauritzen and Spiegelhalter 1988). The worked example is a reframing of this classic network, following SBBN's own example, with lung cancer and tuberculosis linked directly to their shared symptoms rather than through an aggregator node.

**pgmpy** (Ankan and Panda 2015). The reference inference engine.

**PromptBN** (arXiv:2511.00574). The idea of carrying per-node and per-edge natural-language metadata inside a BN interchange file so that structure elicited from text does not lose its rationale.

### 13.3 Withdrawn Lineage

0.1 and 0.2 drew on the Argument Interchange Format, ASPIC+, Pollock's defeasible reasoning, Walton's argumentation schemes, Gentzen's natural deduction, Dung's abstract argumentation, and Toulmin's argument layout. 0.3 no longer draws on any of them. The reason is not that they are wrong but that they answer a different question. They classify how a piece of prose argues; 0.3 asks only what a proposition's probability is under a model whose structure has been elicited elsewhere. A rebuttal, an undercut, an anticipated objection, and a thought experiment are all, under 0.3, either changes to the network (which belong in the workbench) or sentences bound to nodes whose posteriors already reflect them. The 0.2 specification, with its full lineage, is preserved in the reference repository for anyone who needs that vocabulary.

---

## 14. References

Ankan, A. and Panda, A. (2015). _pgmpy: Probabilistic Graphical Models using Python_. Proceedings of the 14th Python in Science Conference (SciPy 2015).

Bryant, K. (2026). _SBBN Workbench: Second Brain as Bayesian Networks_, Specification v0.3. https://github.com/kristoforusbryant/sbbn-workbench

Cozman, F. G. (1998). _The Interchange Format for Bayesian Networks_ (XMLBIF). Carnegie Mellon University.

Lauritzen, S. L. and Spiegelhalter, D. J. (1988). _Local Computations with Probabilities on Graphical Structures and Their Application to Expert Systems_. Journal of the Royal Statistical Society, Series B, 50(2), 157–224.

Lebo, T., Sahoo, S., and McGuinness, D. (eds.) (2013). _PROV-O: The PROV Ontology_. W3C Recommendation.

Pearl, J. (1988). _Probabilistic Reasoning in Intelligent Systems: Networks of Plausible Inference_. Morgan Kaufmann.

_Bayesian Network Structure Discovery Using Large Language Models_ (PromptBN). arXiv:2511.00574.

Sabien, D. (2017). _Double Crux: A Strategy for Mutual Understanding_. LessWrong.

Text Encoding Initiative Consortium. _TEI P5: Guidelines for Electronic Text Encoding and Interchange_.

W3C (2008, updated). _RDFa Core 1.1: Syntax and Processing Rules for Embedding RDF Through Attributes_. W3C Recommendation.

---

## Appendix A — RELAX NG Compact Schema (Informative)

The following RELAX NG Compact fragment captures the structural constraints of ArgML 0.3. It is informative; the prose of this specification is normative where the two diverge. Constraints that require reading the JSON payloads or summing tables (Section 12, `MODEL005` onward) are not expressible here.

```rnc
default namespace = "urn:argml:v2"
namespace local = ""        # the SBBN XMLBIF subtree carries no namespace

start = post

post = element post { attribute id { xsd:NCName }?, head, body }

head = element head { metadata, provenance?, model }

metadata = element metadata {
  element title  { text },
  element author { text }+,
  element date   { xsd:date }?,
  element source { xsd:anyURI }?
}

provenance = element provenance { generator* }
generator  = element generator {
  attribute id    { xsd:NCName },
  attribute type  { text }?,
  attribute who   { text }?,
  attribute model { text }?,
  attribute date  { xsd:date }?,
  attribute role  { text }?
}

model = element model {
  attribute topic    { xsd:anyURI },
  attribute thesis   { node-id }?,
  attribute taken    { xsd:date }?,
  attribute revision { text }?,
  bif
}

# --- Verbatim SBBN-augmented XMLBIF (SBBN v0.3, §5), null namespace ---
bif = element local:BIF {
  attribute VERSION { text },
  element local:NETWORK {
    element local:NAME { node-id },
    variable+,
    definition+
  }
}
variable = element local:VARIABLE {
  attribute TYPE { "nature" },
  element local:NAME { node-id },
  element local:OUTCOME { text }+,        # at least two (MODEL004)
  element local:PROPERTY { text }+        # exactly one "sbbn:meta = {json}" (MODEL005)
}
definition = element local:DEFINITION {
  element local:FOR   { node-id },
  element local:GIVEN { node-id }*,
  element local:TABLE { text },           # whitespace-separated numbers
  element local:PROPERTY { text }*        # one "sbbn:edge:<parent> = {json}" per GIVEN
}

# --- Body ---
body    = element body { (section | p)* }
section = element section {
  attribute id { xsd:NCName }?,
  element heading { attribute level { xsd:integer }?, prose }?,
  (p | section)*
}
p = element p { prose }

prose = mixed { (claim | presentational)* }

presentational = element (em | strong | code | a) {
  attribute * { text }*,
  prose-no-claim
}
prose-no-claim = mixed { presentational* }   # presentational tags may not introduce claims

claim = element claim {
  attribute id { xsd:NCName }?,
  ( node-claim | edge-claim | empty ),        # empty = unbound (ARGML031)
  prose-no-claim                              # claims do not nest (ARGML040)
}
node-claim = attribute node { node-id }, attribute state { text }?
edge-claim = attribute edge { list { node-id, node-id } }

node-id = xsd:string { pattern = "[a-z0-9]+(-[a-z0-9]+)*" }
```

---

## Appendix B — Worked Example (Informative)

### B.1 The document

The example is "Is celebrity A a smoker?", an essay written against the `celebrity-smoking-status` topic that the SBBN Workbench uses as its own acceptance walkthrough. The topic is a reframing of the Asia network (Lauritzen and Spiegelhalter 1988): the hypothesis `is-smoker`; latent mechanisms `bronchitis`, `lung-cancer`, and `tuberculosis`; and evidence nodes `dyspnoea`, `abnormal-xray`, and `visited-asia`, the last three observed `True`. The snapshot contains the full seven-node network. The essay binds nine claims to nodes and seven to edges, restates its thesis twice, negates one node, and leaves one section unmarked. The reference repository ships this document at `examples/celebrity-smoking-status/is-a-a-smoker.argml.xml`, with the live network it was taken from at `bn.xml` alongside it.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<post xmlns="urn:argml:v2" id="is-a-a-smoker">
  <head>
    <metadata>
      <title>Is celebrity A a smoker?</title>
      <author>IanWS</author>
      <date>2026-09-08</date>
    </metadata>
    <provenance>
      <generator id="g1" type="human" who="IanWS" date="2026-09-08" role="author"/>
      <generator id="g2" type="llm" model="claude-opus-4-7" date="2026-09-08" role="extractor"/>
    </provenance>
    <model topic="topics/celebrity-smoking-status/bn.xml" thesis="is-smoker" taken="2026-07-06">
<BIF xmlns="" VERSION="0.3">
<NETWORK>
<NAME>celebrity-smoking-status</NAME>

<VARIABLE TYPE="nature">
  <NAME>is-smoker</NAME>
  <OUTCOME>True</OUTCOME>
  <OUTCOME>False</OUTCOME>
  <PROPERTY>sbbn:meta = {"type": "hypothesis", "description": "A is a regular smoker.", "rationale": "The question this topic exists to answer. A cannot be examined directly, so smoking is inferred from reported health signals.", "sources": [], "last_updated": "2026-07-06"}</PROPERTY>
</VARIABLE>

<VARIABLE TYPE="nature">
  <NAME>bronchitis</NAME>
  <OUTCOME>True</OUTCOME>
  <OUTCOME>False</OUTCOME>
  <PROPERTY>sbbn:meta = {"type": "latent", "description": "A has chronic bronchitis.", "rationale": "One mechanism from smoking to breathlessness. Introduced to replace a direct smoking-to-dyspnoea edge with an explicit pathway.", "sources": [{"title": "Surgeon General, The Health Consequences of Smoking: respiratory diseases", "url": "https://www.ncbi.nlm.nih.gov/books/NBK294322/", "date": "2014-01-17", "note": "Smoking causes chronic bronchitis and shortness of breath."}], "last_updated": "2026-07-06"}</PROPERTY>
</VARIABLE>

<VARIABLE TYPE="nature">
  <NAME>lung-cancer</NAME>
  <OUTCOME>True</OUTCOME>
  <OUTCOME>False</OUTCOME>
  <PROPERTY>sbbn:meta = {"type": "latent", "description": "A has lung cancer.", "rationale": "A second, distinct pathway from smoking to breathlessness, and the only smoking-related cause of an abnormal chest X-ray in this model.", "sources": [{"title": "Surgeon General, The Health Consequences of Smoking: cancer", "url": "https://www.ncbi.nlm.nih.gov/books/NBK294322/", "date": "2014-01-17", "note": "Smoking is the dominant cause of lung cancer."}], "last_updated": "2026-07-06"}</PROPERTY>
</VARIABLE>

<VARIABLE TYPE="nature">
  <NAME>tuberculosis</NAME>
  <OUTCOME>True</OUTCOME>
  <OUTCOME>False</OUTCOME>
  <PROPERTY>sbbn:meta = {"type": "latent", "description": "A has tuberculosis.", "rationale": "A non-smoking cause of both breathlessness and an abnormal X-ray. Its presence lets the model explain A's symptoms without smoking.", "sources": [{"title": "WHO tuberculosis fact sheet", "url": "https://www.who.int/news-room/fact-sheets/detail/tuberculosis", "date": "2025-03-01", "note": "TB presents with breathlessness and chest imaging findings."}], "last_updated": "2026-07-06"}</PROPERTY>
</VARIABLE>

<VARIABLE TYPE="nature">
  <NAME>dyspnoea</NAME>
  <OUTCOME>True</OUTCOME>
  <OUTCOME>False</OUTCOME>
  <PROPERTY>sbbn:meta = {"type": "evidence", "description": "A presents with dyspnoea (shortness of breath).", "rationale": "First observed fact about A. Later connected to smoking through bronchitis and lung cancer, and to tuberculosis.", "sources": [{"title": "Interview transcript, The Morning Show", "url": "", "date": "2026-01-15", "note": "A describes being winded on stairs for months."}], "observation": {"state": "True", "source": {"title": "Interview transcript, The Morning Show", "url": "", "date": "2026-01-15", "note": "A observed to report shortness of breath."}}, "last_updated": "2026-07-06"}</PROPERTY>
</VARIABLE>

<VARIABLE TYPE="nature">
  <NAME>abnormal-xray</NAME>
  <OUTCOME>True</OUTCOME>
  <OUTCOME>False</OUTCOME>
  <PROPERTY>sbbn:meta = {"type": "evidence", "description": "A's chest X-ray is abnormal.", "rationale": "Produced by lung cancer or tuberculosis. Observing it raises belief in both, and through lung cancer in smoking.", "sources": [{"title": "Tabloid report of a hospital visit", "url": "", "date": "2026-02-20", "note": "A's team confirms an abnormal chest film."}], "observation": {"state": "True", "source": {"title": "Tabloid report of a hospital visit", "url": "", "date": "2026-02-20", "note": "A's X-ray observed abnormal."}}, "last_updated": "2026-07-06"}</PROPERTY>
</VARIABLE>

<VARIABLE TYPE="nature">
  <NAME>visited-asia</NAME>
  <OUTCOME>True</OUTCOME>
  <OUTCOME>False</OUTCOME>
  <PROPERTY>sbbn:meta = {"type": "evidence", "description": "A recently returned from a region with high tuberculosis prevalence.", "rationale": "A risk factor for tuberculosis. Observing it activates the competing explanation for A's symptoms.", "sources": [{"title": "Travel column", "url": "", "date": "2026-06-01", "note": "A photographed returning from a three-month shoot."}], "observation": {"state": "True", "source": {"title": "Travel column", "url": "", "date": "2026-06-01", "note": "A observed to have recently returned."}}, "last_updated": "2026-07-06"}</PROPERTY>
</VARIABLE>

<DEFINITION>
  <FOR>is-smoker</FOR>
  <TABLE>0.5 0.5</TABLE>
</DEFINITION>

<DEFINITION>
  <FOR>bronchitis</FOR>
  <GIVEN>is-smoker</GIVEN>
  <TABLE>0.6 0.4 0.3 0.7</TABLE>
  <PROPERTY>sbbn:edge:is-smoker = {"relation": "supports", "rationale": "Smoking roughly doubles the chance of chronic bronchitis.", "sources": []}</PROPERTY>
</DEFINITION>

<DEFINITION>
  <FOR>lung-cancer</FOR>
  <GIVEN>is-smoker</GIVEN>
  <TABLE>0.1 0.9 0.01 0.99</TABLE>
  <PROPERTY>sbbn:edge:is-smoker = {"relation": "supports", "rationale": "Smoking raises lung-cancer risk by about an order of magnitude.", "sources": []}</PROPERTY>
</DEFINITION>

<DEFINITION>
  <FOR>tuberculosis</FOR>
  <GIVEN>visited-asia</GIVEN>
  <TABLE>0.05 0.95 0.01 0.99</TABLE>
  <PROPERTY>sbbn:edge:visited-asia = {"relation": "supports", "rationale": "Travel to a high-prevalence region raises exposure.", "sources": []}</PROPERTY>
</DEFINITION>

<DEFINITION>
  <FOR>dyspnoea</FOR>
  <GIVEN>lung-cancer</GIVEN>
  <GIVEN>tuberculosis</GIVEN>
  <GIVEN>bronchitis</GIVEN>
  <TABLE>0.9 0.1 0.7 0.3 0.9 0.1 0.7 0.3 0.9 0.1 0.7 0.3 0.8 0.2 0.1 0.9</TABLE>
  <PROPERTY>sbbn:edge:lung-cancer = {"relation": "supports", "rationale": "Lung cancer impairs breathing.", "sources": []}</PROPERTY>
  <PROPERTY>sbbn:edge:tuberculosis = {"relation": "supports", "rationale": "Tuberculosis impairs breathing.", "sources": []}</PROPERTY>
  <PROPERTY>sbbn:edge:bronchitis = {"relation": "supports", "rationale": "Bronchitis obstructs the airways, independently of the lung diseases.", "sources": []}</PROPERTY>
</DEFINITION>

<DEFINITION>
  <FOR>abnormal-xray</FOR>
  <GIVEN>lung-cancer</GIVEN>
  <GIVEN>tuberculosis</GIVEN>
  <TABLE>0.98 0.02 0.98 0.02 0.98 0.02 0.05 0.95</TABLE>
  <PROPERTY>sbbn:edge:lung-cancer = {"relation": "supports", "rationale": "A tumour is visible on a chest film.", "sources": []}</PROPERTY>
  <PROPERTY>sbbn:edge:tuberculosis = {"relation": "supports", "rationale": "TB lesions are visible on a chest film.", "sources": []}</PROPERTY>
</DEFINITION>

<DEFINITION>
  <FOR>visited-asia</FOR>
  <TABLE>0.01 0.99</TABLE>
</DEFINITION>

</NETWORK>
</BIF>
    </model>
  </head>

  <body>
    <p>I want to argue that <claim id="c-thesis" node="is-smoker">A is, on the balance of what has been reported, a regular smoker</claim>. Nobody has photographed A with a cigarette. The case is indirect, and I want to lay it out so that each step can be contested on its own.</p>

    <section id="symptom">
      <heading level="2">The symptom</heading>
      <p>The starting point is a fact, not an inference. <claim node="dyspnoea">A has been short of breath for months</claim>, by A's own account in a January interview. On its own this tells us nothing about smoking. It becomes evidence only once we say how breathlessness comes about.</p>
    </section>

    <section id="bronchitis">
      <heading level="2">The first pathway</heading>
      <p><claim edge="is-smoker bronchitis">Smoking is a leading cause of chronic bronchitis</claim>, and <claim edge="bronchitis dyspnoea">bronchitis is a common cause of breathlessness</claim>. So <claim node="bronchitis">A plausibly has bronchitis</claim>, and if so the breathlessness is partly explained by smoking. This is the weaker of the two pathways: bronchitis has other causes, and the reported symptom is compatible with a smoker who has no bronchitis at all.</p>
    </section>

    <section id="lung-cancer">
      <heading level="2">The second pathway</heading>
      <p>The stronger pathway runs through the lungs themselves. <claim edge="is-smoker lung-cancer">Smoking is the dominant cause of lung cancer</claim>, and <claim edge="lung-cancer abnormal-xray">lung cancer shows up on a chest film</claim>. In February <claim node="abnormal-xray">A's chest X-ray was reported as abnormal</claim>. That report is what moved me from curiosity to a real suspicion, because an abnormal film is hard to produce without disease, and <claim node="lung-cancer">lung cancer would explain both the film and the breathlessness at once</claim>.</p>
    </section>

    <section id="rival">
      <heading level="2">The rival explanation</heading>
      <p>There is an honest alternative. <claim edge="tuberculosis dyspnoea">Tuberculosis causes breathlessness</claim> and <claim edge="tuberculosis abnormal-xray">tuberculosis produces an abnormal chest film</claim>, so everything observed so far is also what we would see if <claim node="tuberculosis">A had tuberculosis</claim> and had never smoked. Tuberculosis is rare in A's home country, which is why I did not take this seriously at first. But <claim edge="visited-asia tuberculosis">travel to a high-prevalence region raises the risk of tuberculosis</claim>, and in June <claim node="visited-asia">A returned from a three-month shoot in exactly such a region</claim>.</p>
    </section>

    <section id="explaining-away">
      <heading level="2">Explaining away</heading>
      <p>The travel report matters more than it looks. Once tuberculosis can account for both the film and the breathlessness, those two findings say less about lung cancer, and therefore less about smoking. My credence that A smokes fell when the travel column appeared, even though the column said nothing about smoking. I still think <claim node="tuberculosis" state="False">tuberculosis is unlikely to be the whole story</claim>, because its base rate is low even after travel, and so I still hold that <claim node="is-smoker">A is a smoker</claim>, but with less confidence than the X-ray alone would have justified.</p>
    </section>

    <section id="cruxes">
      <heading level="2">What would change my mind</heading>
      <p>Two numbers carry this argument. The first is how much more likely an abnormal film is under lung cancer than under nothing at all; if abnormal films were common in healthy people, the February report would be noise. The second is the tuberculosis rate after travel; if it were several times higher than I have assumed, the rival explanation would win outright. A sceptic should contest those rows before contesting anything I have said in prose.</p>
    </section>

    <section id="conclusion">
      <heading level="2">Conclusion</heading>
      <p>A reports breathlessness, has an abnormal chest film, and has recently travelled somewhere tuberculosis is common. Two of those three facts favour smoking through lung disease; the third weakens that inference without cancelling it. My conclusion is the posterior on the thesis above, and every step that produced it is a node or a table a reader can dispute.</p>
    </section>
  </body>
</post>
```

### B.2 What a processor computes

All values below were produced by pgmpy 1.1.2 exact variable elimination over the snapshot and are recorded in `examples/celebrity-smoking-status/expected-posteriors.json`. They are shown to two decimals as Section 10.3 recommends.

**Thesis.** The prior on `is-smoker` is 0.50. Under the three recorded observations the posterior is **0.70**. Both claims bound to `is-smoker` (the opening sentence and the restatement in "Explaining away") carry this credence.

**Node-state claims.**

| Claim (surface form, abbreviated)          | Binding                          | Prior | Credence      |
| ------------------------------------------ | -------------------------------- | ----- | ------------- |
| A is a regular smoker                      | `is-smoker` = True               | 0.50  | 0.70          |
| A has been short of breath                 | `dyspnoea` = True                | 0.44  | 1.00 observed |
| A plausibly has bronchitis                 | `bronchitis` = True              | 0.45  | 0.63          |
| A's chest X-ray was reported as abnormal   | `abnormal-xray` = True           | 0.11  | 1.00 observed |
| Lung cancer would explain both findings    | `lung-cancer` = True             | 0.06  | 0.44          |
| A had tuberculosis                         | `tuberculosis` = True            | 0.01  | 0.39          |
| A returned from a high-prevalence region   | `visited-asia` = True            | 0.01  | 1.00 observed |
| TB is unlikely to be the whole story       | `tuberculosis` = False           | 0.99  | 0.61          |

**The trajectory the essay narrates**, reproduced by what-if conditioning (Section 10.3):

| Evidence conditioned on                        | P(`is-smoker` = True) |
| ---------------------------------------------- | --------------------- |
| none (prior)                                   | 0.50                  |
| `dyspnoea`                                     | 0.63                  |
| `dyspnoea`, `abnormal-xray`                    | 0.79                  |
| `dyspnoea`, `abnormal-xray`, `visited-asia`    | 0.70                  |

The final row is the explaining-away move: adding an observation that says nothing about smoking lowers the smoking posterior, because it activates tuberculosis as a rival explanation for the two symptoms. `argml infer --set visited-asia=False` on the snapshot gives 0.79 again.

**Edge claims.** Each shows its `relation` and, since every node here is binary, a likelihood ratio (Section 10.5):

| Claim                                              | Edge                            | Relation | LR                      |
| -------------------------------------------------- | ------------------------------- | -------- | ----------------------- |
| Smoking is a leading cause of chronic bronchitis   | `is-smoker` → `bronchitis`      | supports | 2.0                     |
| Bronchitis is a common cause of breathlessness     | `bronchitis` → `dyspnoea`       | supports | 1.29 to 8.0 across other parents |
| Smoking is the dominant cause of lung cancer       | `is-smoker` → `lung-cancer`     | supports | 10.0                    |
| Lung cancer shows up on a chest film               | `lung-cancer` → `abnormal-xray` | supports | 1.0 to 19.6             |
| Tuberculosis causes breathlessness                 | `tuberculosis` → `dyspnoea`     | supports | 1.0 to 7.0              |
| Tuberculosis produces an abnormal chest film       | `tuberculosis` → `abnormal-xray`| supports | 1.0 to 19.6             |
| Travel raises the risk of tuberculosis             | `visited-asia` → `tuberculosis` | supports | 5.0                     |

The ranges whose lower bound is 1.0 reflect that when another cause is already present the additional parent changes nothing in this table; the relation-sign rule (Section 10.6) accepts these because the inequality is strict for at least one assignment.

### B.3 A deliberate mismatch

If the author had written `"relation": "undermines"` on the `is-smoker` → `bronchitis` edge while leaving the table `0.6 0.4 0.3 0.7`, a processor reports:

```
is-a-a-smoker.argml.xml:76:3: warning MODEL016 edge is-smoker -> bronchitis declares relation "undermines" but P(bronchitis=True | is-smoker=True) = 0.60 exceeds P(bronchitis=True | is-smoker=False) = 0.30
```

The document remains conformant; the warning tells the reviewer that either the sign or the table is wrong.

### B.4 Drift

The repository also ships `drifted-bn.xml`, a later state of the same topic in which the tuberculosis table after travel was revised from 0.05 to 0.15, the X-ray observation was withdrawn, and an unobserved `cough` node was added under `bronchitis`. A comparison processor (Section 11) reports one node added, one table changed, one observation removed, and a thesis posterior of 0.70 under the snapshot against 0.61 under the live network with its own evidence (0.61 as well when the live structure is evaluated under the snapshot's evidence). The 0.09 drift is above the suggested threshold, so the reader is told that the author's conclusion no longer follows from the topic as it now stands, and can see exactly which changes are responsible.
