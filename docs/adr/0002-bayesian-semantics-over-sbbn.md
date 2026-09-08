# ADR 0002: Bayesian semantics over an SBBN topic graph

- **Status**: Accepted
- **Date**: 2026-09-08
- **Phase**: 6 (Spec ratification, ArgML Working Draft 0.3)

## Context

ArgML 0.2 annotated prose with an argumentation-theory vocabulary: supports and attacks, inferences, conflicts, argument regions with dialectical modes, Walton schemes, and natural-deduction patterns. Credence was author-asserted and did not propagate (0.2 §12.4). A reader overlay let a second person accept or reject claims, and a four-status propagation pass walked the graph to show what survived.

That design no longer fits the users we have. The primary consumers are AI agents doing philosophy research. They need belief states that are reproducible from the document and comparable across documents and over time. A hand-typed credence with no rule for how it moves under evidence gives them neither.

Prose does not carry conditional dependencies. The SBBN Workbench (https://github.com/kristoforusbryant/sbbn-workbench) already supplies them. One topic is one Bayesian network in augmented XMLBIF. Nodes are propositions, edges are causal, CPTs are elicited, and observations are hard evidence. SBBN ships an XSD, a validator, and pgmpy inference. It lists "a formal argumentation layer" as out of scope. ArgML 0.3 becomes that layer for prose and adds no formalism beyond the BN itself.

## Decision

1. **Binding.** A `<claim>` binds to an SBBN node id (with an optional `state`) or to an edge written as `edge="parent child"`. Structure lives in the BN. New structure goes through SBBN's `bn-revise` first, never through the essay.
2. **Verbatim snapshot.** The head embeds the subgraph the essay argues over as verbatim SBBN XMLBIF inside `<model topic="…">`, with `xmlns=""` on `<BIF>`. There is no native re-encoding. The snapshot must be a valid SBBN network on its own and must contain every node a claim or `thesis` names, so it is a parent-closed sub-DAG.
3. **Full CPTs are required**, exactly as in SBBN.
4. **Credence is computed.** A node claim's credence is P(node = state | snapshot observations). Author priors and CPTs are preserved in the snapshot. This reverses 0.2 §12.4, and the spec says so in a titled subsection.
5. **Snapshot-vs-live comparison.** A diff tool reports the author's snapshot against a live `bn.xml`: structure, CPTs, observations, and posteriors under both. There is no revise-from-essay skill.
6. **Inference shells out** to Python and pgmpy. There is no TypeScript inference engine (ADR 0003).
7. **Edge sign.** SBBN's `relation` is kept. The validator checks it against the CPT for binary nodes and warns on contradiction.
8. **Dropped:** `<argument>` and modes, claim `mode`, `scheme`, `pattern`, `<conflict>`, attack types, `<inference>`, defeasible and strength, `supports`, `attacks`, `rests-on`, `via`, `same-as`, `attributed-to`, `<assumption>`, `<term>`, gloss, alias, `<imports>`, `<takeaways>`, inline `<evidence>`, `<note>`, author `credence`, `<epistemic-status>`, `<reader-overlay>`, `src/propagation/**`, per-element `provenance` attributes, the HTML renderer, and `argml render`.
9. **Kept:** `<post>`, `<head>`, `<body>`, `<metadata>` (title, author, date, source), optional `<provenance>` and `<generator>`, `<section>`, `<heading>`, `<p>`, the presentational inline tags, and `<claim>`. Unmarked prose stays prose.
10. **Namespace** bumps to `urn:argml:v2`. Documents in `urn:argml:v1` are rejected with a dedicated diagnostic.
11. **Delivery** is spec first (Phase 6), then code in Phases 7 to 10, one PR each.

## Consequences

**Positive**

- Credences are exact and reproducible. Two agents reading the same document compute the same numbers.
- Explaining-away comes for free. The worked example shows a travel report lowering belief in smoking without saying anything about smoking.
- Disagreement is localised. A reader who disputes the conclusion can point at a prior, a CPT row, or an observation. Each carries an id, a rationale, and sources.
- Documents are self-contained, and their drift from the live BN is measurable rather than guessed.
- The vocabulary shrinks to one binding element and one model element.
- SBBN tooling is reused directly. The exported snapshot runs unchanged through SBBN's XSD, validator, visualizer, and pgmpy.

**Negative (accepted, with mitigations)**

- **Reader overlays are gone.** A second reader cannot record their own view inside the format. Mitigation: deferred until SBBN supports soft evidence; the `--set` flag on `argml infer` covers the what-if case in the meantime.
- **Double-crux by accept/reject traversal over rhetoric is gone.** Mitigation: the crux moves to numbers. Contesting a CPT row is the 0.3 form of contesting a step.
- **Attack typing is gone.** Rebuttal, undercut, and undermine collapse into edges with a `relation` sign. Mitigation: the CPT carries the strength that the typing only named.
- **Author-asserted credence as an independent signal is gone.** Mitigation: the author's beliefs survive as priors and CPTs, which is where they can be argued with.
- **The AIF, ASPIC+, and Walton lineage is dropped.** Mitigation: the spec's Lineage section records why, so the decision is traceable.
- **Cross-document imports and terms are gone.** Mitigation: cross-topic linking is listed as deferred work in the roadmap.
- **The 0.2 renderer is removed.** Mitigation: a 0.3 renderer is deferred work; the 0.2 screenshot is kept under `docs/images/` with a historical note.

## Alternatives considered

1. **A native ArgML vocabulary for nodes and CPTs.** Rejected. Translation invites drift between the two encodings and requires a second validator. Verbatim XMLBIF lets SBBN's XSD, validator, visualizer, and pgmpy run unchanged on the exported snapshot.
2. **A reference-only pointer to the topic with no snapshot.** Rejected. The live BN mutates, so the essay's numbers would silently change after publication. Embedding is what makes comparison possible.
3. **A qualitative noisy-OR shorthand instead of full CPTs.** Rejected. It adds a mechanic SBBN lacks, and the converter skill can elicit full tables.
4. **Keeping reader overlays as prior and observation overrides.** Deferred. Hard overrides would work today, but the interesting case is soft evidence, which waits on SBBN's Jeffrey's-rule work.
5. **Keeping a TypeScript inference engine.** See ADR 0003.

## Revisit triggers

- SBBN adds soft evidence. Reader overlays as prior or observation overrides become worth specifying.
- A need for documents that argue across more than one topic.
- A browser-only deployment that cannot shell out to Python.
