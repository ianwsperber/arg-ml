# Proposal: deductive bindings beyond `given` and `independent`

Status: **deferred**. Received during review of PR #15 (Working Draft 0.3) as a
"0.4 deductive bindings" proposal, revised after review, and split: two of its
four bindings (`given`, `independent`), the factorization reading of edges, the
strict-edge amendment to the likelihood ratio, and the `INFER` diagnostic family
were folded into WD 0.3 before ratification. The two bindings below were not.
This file records them, the defects found, what survives without them, and the
trigger for revisiting.

## Constraints any revival must keep

1. **SBBN's format is untouched.** No new node type, metadata key, or table
   convention. Every construct resolves against the DAG, the outcome lists, the
   tables, and the observations SBBN already records, and the snapshot still
   byte-slices back to `bn.xml`.
2. **One binding element.** `<claim>` remains the only ArgML element with
   semantics.
3. **Computed, never asserted.** A new credence is a conditional posterior by
   exact inference; a new structural claim is a property of the DAG a
   processor checks.
4. **Graduated formalization.** Additions are optional attributes; a 0.3
   document stays conformant.

## `warrant` binding — deferred

### What was proposed

A **warrant** (Toulmin 1958) is the licence that carries a premise to a
conclusion; an attack on it is Pollock's **undercutting defeater** (Pollock
1987), a reason to doubt that P supports Q that is neither a reason against P
nor against Q. In Bayesian epistemology the same object is the **reliability
node** of Bovens and Hartmann (2003, ch. 3): a parentless variable that gates
whether one variable bears on another. ASPIC+ (Modgil and Prakken 2013) adds
that only defeasible rules can be undercut; strict rules cannot.

The proposal defined a *warrant pattern* on the tables: for a child c with
parents {p, w} ∪ R, node w is a warrant for the edge p → c iff (W1) w is
`latent` with no `GIVEN`; (W2) c is w's only child; (W3, inertness) for every
assignment r of R, P(c | p = pᵢ, w = w₂, r) is the same for every i; (W4,
effect) for some r the rows with w = w₁ are not all equal. It then added
`<claim warrant="p c" state="…">`, resolving to the unique w satisfying W1–W4
for that edge, with credence P(w = state | O ∪ G). It also classified every
edge as **strict** (every effect row a point mass), **defeasible** (some w is a
warrant for it), or **probabilistic**.

### Why it was deferred

- **W2 fails on the proposal's own example and on philosophy generally.** In
  the network below, `regress-valid` is the warrant for
  `reducible → criticism-possible`, but it also has `regress-published` as a
  child, because testimonial evidence about the regress hangs off it. A
  validity node will normally have evidence children. Under W2 the example's
  own `warrant` claim fails to resolve.
- **A binding resolved by inspecting table values is fragile.** Any
  `bn-revise` edit to the child's table can silently retarget or break it, and
  "more than one parent satisfies W1–W4" has no principled tie-break.

### What survives without it

- An undercut is a **node claim on the warrant node at its failing state**,
  which 0.3 already supports: `<claim node="regress-valid" state="False">`.
- The **strict / probabilistic** classification is in WD 0.3 §10.7.
- The **gating check** is worth keeping as an optional inference-time report:
  given a node claim on w and an edge p → c with w a parent of c, report
  whether w gates the edge (inertness as in W3) and, if so, classify the edge
  **defeasible** alongside strict and probabilistic. Before this can be
  specified it needs a rule for *which* edge is being checked when w has
  several children; that rule is the open question.
- Uniform encoding of undercuts (a warrant node rather than a softened row)
  belongs in the elicitation skill's instructions, where SBBN already keeps
  its one-hypothesis convention.

## `partition` binding — deferred

### What was proposed

`<claim partition="node">` bound a claim to a node's **outcome list**,
asserting that the outcomes are exclusive and exhaustive for the proposition
in its description (Kolmogorov 1933; Savage 1954). It had no credence. With
sections conditioning on each outcome, the processor would report the thesis
credence under each case (Gentzen's ∨-elimination, proof by cases). A warning
was proposed for partition claims on two-outcome nodes as vacuous.

### Why it was deferred

- The outcome list is already visible, and a disputed partition is a
  `bn-revise` change that the comparison profile already flags (`DIFF003`).
- The vacuity warning was wrong. Only complementary outcomes (`True`/`False`)
  are vacuous; a binary node with outcomes such as *stable* / *collapses*
  hides horns as easily as any other. The correct check, "the second outcome
  is the negation of the first", is not detectable from the format, so the
  warning should be dropped rather than fixed.

### What survives without it

Case-split reporting needs only `given`: when a document has sections
conditioning on each outcome of a node, a processor MAY report the thesis
credence under each. That is what-if conditioning (WD 0.3 §10.4) applied to
the sections' conditioning sets (§6.7, §10.5) and needs no new binding.

## Revisit trigger

After Phase 9 has run `argml infer` on a real essay, revisit both against
actual undercut and case-split usage. A revival should arrive as a delta
against the ratified spec with a worked example whose numbers are computed,
not estimated.

## Appendix: the example network

`end-relative-fallback`, five nodes, one observation (`regress-published =
True`). It passes SBBN's XSD and `validate_bn.py`. Its tables are format
placeholders, not elicited credences; the essay's real network would be built
through `bn-revise` with sources on every row. It is kept here rather than
under `examples/` because of that, and because it shows two things the
smoking example cannot: a **strict edge** (both edges into `fallback-fate`)
and a **refuted supposition**.

Values computed with pgmpy 1.1.2, exact variable elimination:

| Query | Value |
| ----- | ----- |
| P(reducible = True \| O) | 0.60 |
| P(regress-valid = True \| O) | 0.60 |
| P(criticism-possible = False \| O) | 0.49 |
| P(criticism-possible = False \| reducible = True, O) | 0.68 |
| P(fallback-fate \| O), stable / categorical / descriptive | 0.19 / 0.40 / 0.41 |
| P(fallback-fate \| regress-valid = True, O) | 0.00 / 0.40 / 0.60 |
| P(regress-valid = True, fallback-fate = stable \| O) | 0.00 (a section supposing both is refuted: `INFER002`) |
| regress-published ⊥ fallback-fate \| {regress-valid} | holds (d-separated) |
| regress-published ⊥ fallback-fate \| ∅ | fails (`ARGML046`) |

Edge classes under WD 0.3 §10.7: `reducible → criticism-possible` and
`regress-valid → criticism-possible` probabilistic (the first would be
*defeasible* under the deferred gating check); `regress-valid →
regress-published` probabilistic; both edges into `fallback-fate` strict.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<BIF VERSION="0.3">
<NETWORK>
<NAME>end-relative-fallback</NAME>

<VARIABLE TYPE="nature">
<NAME>fallback-fate</NAME>
<OUTCOME>stable</OUTCOME>
<OUTCOME>categorical</OUTCOME>
<OUTCOME>descriptive</OUTCOME>
<PROPERTY>sbbn:meta = {"type": "hypothesis", "description": "What becomes of the error theorist's end-relative fallback: it is stable (reducible reasons that can still criticise), it collapses into categorical normativity, or it collapses into non-normative description.", "rationale": "The thesis node. A deterministic function of reducibility and the possibility of criticism: the three outcomes are the three horns.", "sources": [], "last_updated": "2026-09-08"}</PROPERTY>
</VARIABLE>

<VARIABLE TYPE="nature">
<NAME>reducible</NAME>
<OUTCOME>True</OUTCOME>
<OUTCOME>False</OUTCOME>
<PROPERTY>sbbn:meta = {"type": "latent", "description": "End-relative reasons reduce without remainder to facts about what promotes an agent's ends.", "rationale": "Olson's fallback premise; a root because nothing in the snapshot explains it.", "sources": [{"title": "Olson, Moral Error Theory: History, Critique, Defence", "date": "2014", "note": "ch. 7-8, reducibly normative reasons"}], "last_updated": "2026-09-08"}</PROPERTY>
</VARIABLE>

<VARIABLE TYPE="nature">
<NAME>regress-valid</NAME>
<OUTCOME>True</OUTCOME>
<OUTCOME>False</OUTCOME>
<PROPERTY>sbbn:meta = {"type": "latent", "description": "Korsgaard's regress is valid: if the instrumental principle stands alone, nothing requires an agent to retain an end, so no criticism of the agent who drops it is available.", "rationale": "Warrant for the edge reducible -> criticism-possible. Parentless latent; when False, reducibility carries no information about criticism (the edge is inert). Testimonial evidence about the regress hangs off this node too.", "sources": [{"title": "Korsgaard, The Normativity of Instrumental Reason", "date": "1997"}], "last_updated": "2026-09-08"}</PROPERTY>
</VARIABLE>

<VARIABLE TYPE="nature">
<NAME>criticism-possible</NAME>
<OUTCOME>True</OUTCOME>
<OUTCOME>False</OUTCOME>
<PROPERTY>sbbn:meta = {"type": "latent", "description": "The theory can criticise an agent who abandons an end rather than take the means to it.", "rationale": "The property the fallback must preserve to make its own recommendations coherent.", "sources": [], "last_updated": "2026-09-08"}</PROPERTY>
</VARIABLE>

<VARIABLE TYPE="nature">
<NAME>regress-published</NAME>
<OUTCOME>True</OUTCOME>
<OUTCOME>False</OUTCOME>
<PROPERTY>sbbn:meta = {"type": "evidence", "description": "A regress argument of this form has been published and has survived in the literature.", "rationale": "Testimonial evidence bearing on validity.", "sources": [{"title": "Korsgaard, The Normativity of Instrumental Reason", "date": "1997"}], "observation": {"state": "True", "source": {"title": "Korsgaard 1997", "date": "1997"}}, "last_updated": "2026-09-08"}</PROPERTY>
</VARIABLE>

<DEFINITION>
<FOR>reducible</FOR>
<TABLE>0.6 0.4</TABLE>
</DEFINITION>

<DEFINITION>
<FOR>regress-valid</FOR>
<TABLE>0.5 0.5</TABLE>
</DEFINITION>

<DEFINITION>
<FOR>criticism-possible</FOR>
<GIVEN>reducible</GIVEN>
<GIVEN>regress-valid</GIVEN>
<TABLE>0.0 1.0 0.8 0.2 0.8 0.2 0.8 0.2</TABLE>
<PROPERTY>sbbn:edge:reducible = {"relation": "undermines", "rationale": "If reasons reduce to promotion facts, and the regress is valid, the agent who drops her end has made no error and cannot be criticised. When the regress is invalid the edge is inert.", "sources": [{"title": "Korsgaard 1997"}]}</PROPERTY>
<PROPERTY>sbbn:edge:regress-valid = {"relation": "undermines_partially", "rationale": "Warrant: gates whether reducibility bears on criticism at all.", "sources": [{"title": "Korsgaard 1997"}]}</PROPERTY>
</DEFINITION>

<DEFINITION>
<FOR>fallback-fate</FOR>
<GIVEN>reducible</GIVEN>
<GIVEN>criticism-possible</GIVEN>
<TABLE>1.0 0.0 0.0 0.0 0.0 1.0 0.0 1.0 0.0 0.0 1.0 0.0</TABLE>
<PROPERTY>sbbn:edge:reducible = {"relation": "supports_partially", "rationale": "Reducible and criticism possible: stable. Reducible and no criticism: descriptive. Not reducible: categorical, whatever criticism does.", "sources": []}</PROPERTY>
<PROPERTY>sbbn:edge:criticism-possible = {"relation": "supports_partially", "rationale": "Deterministic: see the reducible edge.", "sources": []}</PROPERTY>
</DEFINITION>

<DEFINITION>
<FOR>regress-published</FOR>
<GIVEN>regress-valid</GIVEN>
<TABLE>0.9 0.1 0.6 0.4</TABLE>
<PROPERTY>sbbn:edge:regress-valid = {"relation": "supports", "rationale": "A valid regress is likelier to be published and survive than an invalid one, but invalid arguments are published too.", "sources": []}</PROPERTY>
</DEFINITION>

</NETWORK>
</BIF>
```

## References

Bovens, L. and Hartmann, S. (2003). *Bayesian Epistemology*. Oxford University Press.
Kolmogorov, A. N. (1933). *Grundbegriffe der Wahrscheinlichkeitsrechnung*. Springer.
Modgil, S. and Prakken, H. (2013). A general account of argumentation with preferences. *Artificial Intelligence* 195: 361–397.
Pollock, J. (1987). Defeasible reasoning. *Cognitive Science* 11: 481–518.
Savage, L. J. (1954). *The Foundations of Statistics*. Wiley.
Toulmin, S. (1958). *The Uses of Argument*. Cambridge University Press.
