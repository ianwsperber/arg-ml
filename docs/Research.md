# Research 1 \- Prior Art

## Prompt

*I am researching existing methodologies for formal specification for arbitrary knowledge work. Your job is to help me understand existing software, methodologies, and research on this topic.*

*Consider, for example, an academic paper in philosophy. The paper will contain a mix of logical arguments, assertions, examples, etc. The paper may even employ formal logical diagrams and formulas. Ultimately, however, the paper will rely on some set of definitions and assumptions.* 

*Our concern is that papers often waste time on semantic arguments, due to implicit assumptions or different assumptions. For example, one might argue that Daniel Dennet’s “Quining Qualia” relies on a very narrow definition of qualia, or that Chalmer’s dualist claims rely on a narrow definition of physical substance. Even more broadly, professional and amateur philosophers risk engaging in anti-rational arguments that reduce entirely to a fairly to recognize differing assumptions or definitions between parties.*

*Our thesis is that one could create an equivalent to the LEAN language, used for mathematical proofs, for any arbitrary knowledge work. For example, one could parse an academic paper, to distinguish between formal logic, assumptions, definitions, etc., to quickly compare theories between two academics, or to “compile” a paper to highlight major gaps.* 

*We already know there are systems like prepositional logic, decision theory and LEAN, which may be used to formalize arguments in narrow domains. We’d like your help understanding what equivalent, generalizable approaches have been found for arbitrary knowledge work. Our primary use case is philosophy, but we’d also like to apply this system to any academic text, whether in philosophy, computer science, physics, literary theory, etc.*

*Please help us research all prior art in this domain, current systems/software, and how we might advance our theories of how to formalize academic arguments similar to how LEAN does for mathematical proofs.*

## Claude: Toward a proof assistant for arguments: the state of the art

**A formal verification system for arbitrary knowledge work — a "LEAN for philosophy" — does not yet exist, but the infrastructure is closer than most realize.** Decades of research in computational argumentation, defeasible reasoning, knowledge representation, and argument mining have produced a rich but fragmented ecosystem of frameworks, tools, and techniques that collectively address many pieces of this puzzle. The most advanced existing work is Christoph Benzmüller's Shallow Semantical Embedding approach, which embeds modal, deontic, and epistemic logics into Isabelle/HOL — enabling machine-verified analysis of philosophical arguments like Gödel's ontological proof. The critical barriers are not purely technical: they involve the inherent ambiguity of natural language, essentially contested concepts whose definitions are themselves disputed, and the dominance of non-deductive reasoning in philosophy. The most promising path forward is *graduated formalization* — systems that track definitional commitments and make assumptions explicit without demanding complete logical formalization.

---

### The formal argumentation landscape is mature but fragmented

The theoretical foundations for formalizing arguments are far more developed than most people outside the field realize. **Dung's Abstract Argumentation Frameworks** (1995) established that arguments and their attack relationships can be analyzed as directed graphs, with multiple "semantics" (grounded, preferred, stable, complete) offering different strategies for determining which arguments survive conflict. This single paper unified default logic, logic programming, and game-theoretic reasoning under one roof, and has generated thousands of follow-up papers.

Building on Dung, the **ASPIC+ framework** (Prakken and Modgil, 2013\) adds internal structure to arguments. Arguments become derivation trees built from strict rules (logically entailing) and defeasible rules (creating presumptions), with three kinds of attack: undermining premises, rebutting conclusions, and undercutting inference rules themselves. ASPIC+ is the closest existing theoretical analog to what a "type system for arguments" would look like — it specifies precisely how arguments are constructed, how they interact, and when one defeats another. The **Argument Interchange Format (AIF)**, developed by an international consortium led by Chris Reed at the University of Dundee, provides a standardized ontology for exchanging argument data between tools, with information nodes (propositions), scheme application nodes (inferences and conflicts), and locution nodes (dialogue acts).

Other important frameworks fill specific niches. **Assumption-Based Argumentation (ABA)**, developed by Francesca Toni at Imperial College London, focuses on identifying which assumptions underpin conclusions — directly relevant to the user's goal of surfacing implicit assumptions. **Defeasible Logic Programming (DeLP)**, from García and Simari at Universidad Nacional del Sur, combines logic programming with dialectical trees that evaluate whether conclusions survive counterargument. **Abstract Dialectical Frameworks (ADFs)**, from Brewka and Woltran, generalize Dung's model by allowing arbitrary acceptance conditions on each argument node, capturing support, attack, and more complex dependencies in a single structure.

The **Carneades model** (Thomas F. Gordon and Douglas Walton) introduced variable proof standards — scintilla of evidence, preponderance, clear and convincing, beyond reasonable doubt — applied per-issue within argument graphs. This directly addresses a key difference between mathematical proof (one standard: deductive validity) and real-world argumentation (context-dependent standards). The **Handbook of Formal Argumentation** (Baroni, Gabbay, Giacomin, van der Torre, 2018; Volume 2, 2021; Volume 3 forthcoming) provides the definitive reference, with the biennial **COMMA conference** and the journal *Argument & Computation* serving as primary venues.

---

### Software tools exist but none achieves the full vision

No tool currently functions as a true proof assistant for informal arguments. The landscape divides into four categories, each covering part of the problem.

**Argument notation and mapping tools** provide syntax for expressing arguments. **Argdown** (Christian Voigt, KIT DebateLab) is the most promising — a Markdown-like syntax where statements go in square brackets, arguments in angle brackets, with `+` for support and `-` for attack. Each argument can have a full premise-conclusion structure. It has a VS Code extension, CLI tools, and an Obsidian plugin. However, Argdown has no verification engine — it is purely a notation system. **Rationale** (ReasoningLab) provides a commercial web-based argument mapper with color-coded evaluation. **Kialo** has over a million users but is designed for structured debate, not formal analysis — it lacks premise-conclusion decomposition, argumentation schemes, and logic checking.

**Formal reasoning libraries** implement argumentation semantics computationally. **TweetyProject** is the most comprehensive — a Java library implementing Dung frameworks, ASPIC+, ABA, bipolar argumentation, probabilistic argumentation, and more, with SAT solver integration and support for all standard semantics. It powers the International Competition on Computational Models of Argumentation (ICCMA). **Carneades** (version 4, written in Go) combined formal argument evaluation with **106 programmed argumentation schemes** and an inference engine for automatic argument construction, but development has been largely dormant since \~2016.

**Argument mining pipelines** use NLP to extract arguments from text. The **oAMF** (Open Argument Mining Framework) from ARG-tech provides a modular, open-source pipeline with 17+ modules for segmentation, component detection, relation identification, and scheme classification, outputting to the xAIF interchange format. **IBM Project Debater**, published in *Nature* (2021), demonstrated claim detection, evidence extraction, stance classification, and argument quality assessment at scale, trained on **200,000+ labeled examples**.

The most directly relevant emerging project is **Argunauts** (Gregor Betz, KIT DebateLab, announced February 2025 on Hugging Face). This project explicitly trains open LLMs to perform comprehensive argumentative analysis, document reconstructions in standardized Argdown form, and use external tools like the **Z3 theorem prover** for validity checking. Argunauts confronts a key bootstrapping problem: LLMs see virtually no Argdown during pretraining (\~266 Argdown files exist on all of GitHub versus 1.8 million YAML files), and logical argument analysis is "extremely rare" in training corpora. This is the closest active project to the user's vision.

---

### Proof assistants have been applied to philosophy with striking results

The most developed infrastructure for machine-verified philosophical reasoning comes from **Christoph Benzmüller** (Universität Bamberg), who developed the **Shallow Semantical Embedding (SSE)** technique. SSE encodes higher-order modal logics into classical higher-order logic (HOL), allowing off-the-shelf HOL provers and the Isabelle/HOL proof assistant to reason about modal, deontic, epistemic, and paraconsistent logics. This single technique enables the closest existing thing to a "LEAN for philosophy."

The landmark result: Benzmüller and Bruno Woltzenlogel Paleo formalized **Gödel's ontological argument for God's existence** in both Coq and Isabelle/HOL (2013). The automated theorem prover LEO-II then independently discovered that Gödel's original 1970 axioms are **inconsistent** — a fact unnoticed by philosophers for over 40 years. Dana Scott's 1972 variant, which unknowingly fixed this inconsistency, was shown consistent. This is the paradigmatic example of what formal verification can do for philosophy: it found a deep error that informal analysis missed.

The **LogiKEy framework** (Benzmüller, Parent, van der Torre; *Artificial Intelligence*, 2020\) extends this to ethical and legal reasoning, providing a three-layer architecture embedding multiple deontic logics into Isabelle/HOL. Case studies include formalizing **Gewirth's Principle of Generic Consistency** (revealing missing implicit premises), **automated Kantian ethics** (Lavanya Singh, 2022), and GDPR analysis revealing Contrary-to-Duty structures. Benzmüller's broader vision of **"Universal Reasoning"** explicitly aims to use proof assistants for any domain of rational argumentation — "Classical higher-order logic, when utilized as a meta-logic... is well suited for realising a universal logic reasoning approach. Universal logic reasoning, as envisioned already by Leibniz, may support the rigorous formalisation and deep logical analysis of rational arguments within machines."

**Edward Zalta's computational metaphysics** at Stanford represents a parallel effort. His Abstract Object Theory (AOT) was implemented in the PROVER9 automated reasoning system, where it automatically discovered a simplified ontological argument (Oppenheimer and Zalta, 2011\) and automated Leibniz's theory of concepts (Alama, Oppenheimer, and Zalta, 2015). The most ambitious project, mechanizing AOT in Isabelle/HOL (Kirchner, Benzmüller, and Zalta, *Review of Symbolic Logic*, 2020), uncovered a **deeply-rooted paradox** reintroduced when complex terms are added to AOT's comprehension principle — another case of formal methods revealing problems invisible to informal analysis.

Notably, **no substantial philosophical formalization projects exist in Lean**. All major work uses Isabelle/HOL (Benzmüller's preferred tool) or occasionally Coq. This represents a genuine gap — Lean's active community and modern tooling could make philosophical formalization more accessible if someone built the necessary libraries.

---

### Non-monotonic reasoning provides the missing logical infrastructure

Mathematical proofs are monotonic: once proven, a theorem stays proven. **Philosophical arguments are fundamentally defeasible** — conclusions can be overturned by new evidence, counterarguments, or refined definitions. This is the deepest technical difference between mathematical proof verification and argument verification.

The field of non-monotonic logic provides the theoretical infrastructure. **Default Logic** (Reiter, 1980\) formalizes rules that hold "by default" unless contradicted. **Autoepistemic Logic** (Moore, 1985\) models an idealized agent reasoning about its own beliefs. **Circumscription** (McCarthy, 1980\) minimizes the extension of predicates — treating entities as "normal" unless there is explicit evidence otherwise. These are all computationally hard (ΣP₂-complete or worse), but **Answer Set Programming (ASP)** provides a practical implementation. The **Clingo** solver, from the University of Potsdam, handles non-monotonic reasoning efficiently and has been used to encode ASPIC+ argumentation frameworks (Lehtonen, Wallner, and Järvisalo, KR 2020\) and model judicial reasoning in child custody cases (Dik and Markovich, ICAIL 2025).

**Defeasible Logic** (Nute; Governatori) offers an even more practical option with **linear-time complexity** (O(n), proven by Maher 2001\) — far cheaper than default logic's second-level polynomial hierarchy. Its three rule types (strict, defeasible, and defeaters) with a superiority relation map naturally onto how academic arguments actually work: some inferences are deductive, others are presumptive, and some rules exist only to block conclusions without deriving anything themselves.

Legal informatics provides **40 years of lessons** about formalizing defeasible arguments in practice. The LKIF (Legal Knowledge Interchange Format), LegalRuleML (an OASIS standard), and Akoma Ntoso (for document structure) form a stack from structured documents through extracted rules to argumentation evaluation. Key lessons transfer directly: defeasibility is non-negotiable; variable proof standards are essential; the formal representation should structurally mirror the source text (Bench-Capon's "isomorphism principle"); and context-dependent interpretation requires something like CYC's microtheories — the same norm means different things in different jurisdictions, just as the same philosophical term means different things in different theoretical frameworks.

---

### Argument mining can partially automate extraction but faces hard limits

Current NLP can identify argument components (claims, premises, evidence) in well-structured text with **F1 scores of \~70–87%** depending on task and domain. Relation classification (support/attack) reaches **macro F1 \~75** using Llama 70B in zero-shot settings (arXiv:2402.11243, 2024). The field has undergone a paradigm shift from pipeline-based supervised classifiers to LLM-driven approaches, with GPT-4 matching fine-tuned BERT variants on argument type classification via in-context learning alone.

However, **philosophical and highly abstract text remains the hardest domain**. Very few annotated corpora exist for philosophy. The key unsolved problems are enthymeme reconstruction (recovering unstated premises — fundamental to the user's vision of making implicit assumptions explicit), long-range argument dependencies spanning multiple sections of a paper, and the gap between flat NLP labels (claim/premise/support/attack) and the formal logical representations needed for verification. The AIF-to-ASPIC+ bridge exists formally (Bex, Modgil, Prakken, and Reed, *Journal of Logic and Computation*, 2013\) and has been demonstrated on BBC Question Time debates, but **automating this mapping at scale for mined arguments remains unsolved**.

The **OpenDebateEvidence** dataset (Roush et al., NeurIPS 2024\) — **3.5 million documents** from competitive debate — represents the largest argument mining resource ever assembled. The Dagstuhl Seminar 22432 on "Towards a Unified Model of Scholarly Argumentation" (2022) addressed the specific problem of modeling arguments in academic papers. But the most realistic near-term path combines LLM-based component detection fine-tuned for academic text, oAMF-style modular pipelines with AIF output, ASPIC+ formalization layers, and new annotation schemas distinguishing formal logic from informal argumentation in scholarly discourse.

---

### Why this hasn't been built yet — and what would be needed

The barriers are simultaneously theoretical, practical, and social, and they are worth understanding in detail because they determine the design constraints for any viable system.

**The most fundamental barrier is that philosophical primitives are themselves disputed.** In Lean, primitives (natural numbers, types, functions) have exact definitions. In philosophy, the equivalent primitives — consciousness, knowledge, justice, truth — are what W.B. Gallie called **"essentially contested concepts"**: disputes about their proper use "cannot be settled by appeal to empirical evidence, linguistic usage, or the canons of logic alone." A formal system can verify arguments *relative to* particular definitions, but it cannot adjudicate definitional disputes. However — and this is crucial — the user's vision of *surfacing* these definitional differences and showing where disagreements reduce to differing definitions is precisely the right response. The system need not resolve disputes; it needs to make them transparent.

**Implicit background knowledge is vast and uncodified.** A typical philosophy paper presupposes hundreds of unstated assumptions. CYC's 40-year attempt to manually encode common-sense knowledge (reaching \~25 million rules and \~1.5 million concepts) never achieved the "knowledge pump" tipping point where the system could begin learning on its own. The qualification problem compounds this: any rule about the real world has an essentially unbounded set of exceptions. The labor cost is staggering even in mathematics — Kevin Buzzard estimates his PhD thesis would take "many thousands of person hours" to formalize in Lean, and **Lean's mathlib had formalized only \~210,000 theorems as of 2025**.

**Most philosophical reasoning is ampliative, not deductive.** Abduction (inference to the best explanation) is NP-hard in general and relies on inherently contested notions of "best." Analogical reasoning resists simple formalization. Induction is truth-extending by nature. Formal systems excel at verifying truth-preserving deductive inferences, but most interesting philosophical work involves reasoning that *extends* beyond what premises strictly entail. Additionally, Quine's indeterminacy of translation means that any mapping from natural language to formal notation involves underdetermined choices — there are always multiple incompatible but equally adequate formalizations.

The practical barriers are equally severe. The expertise barrier (vanishingly few people combine domain expertise with formal methods skill), the incentive problem (academics are evaluated on publications, not formalizations), and the brittleness of formal representations (small changes in wording require completely different formalizations) all work against adoption.

---

### A realistic architecture and the path forward

The most promising approach is not a monolithic "LEAN for everything" but a **layered, graduated formalization system** that combines existing components:

* **Layer 0 — Document structure**: Adapted from Akoma Ntoso / academic markup, parsing papers into sections, claims, definitions, examples, and citations  
* **Layer 1 — Argument extraction**: LLM-based argument mining (oAMF-style pipeline) identifying claims, premises, and relations, outputting to AIF/xAIF format  
* **Layer 2 — Argument notation**: Argdown or similar human-readable syntax for explicit argument reconstruction, where authors (or AI-assisted tools) articulate premise-conclusion structures  
* **Layer 3 — Formal evaluation**: ASPIC+ or Carneades-style evaluation with defeasible and strict rules, variable proof standards, and ASP-based solvers (Clingo) for computing acceptable argument sets  
* **Layer 4 — Verified reasoning**: For the deductive core of arguments, Benzmüller-style SSE embeddings into Isabelle/HOL (or, with new library development, Lean) for machine-checked verification of logical validity

The key design insight from the legal informatics community is that **the system should support graduated commitment to formalization**. Not every claim needs to be fully formalized. The highest-value intervention is making definitions and assumptions explicit and tracking where they diverge between authors — exactly the user's stated goal. Benzmüller's universal reasoning vision, the Argunauts project's use of LLMs for Argdown generation with Z3 verification, and the AIF/ASPIC+ interoperability standards provide the most mature building blocks. The "Thirteen Challenges in Formal and Computational Argumentation" (Yu, van der Torre, and Markovich, Handbook of Formal Argumentation Vol. 3\) maps the remaining open problems.

### Conclusion

The intellectual lineage of this idea stretches from Leibniz's *characteristica universalis* through logical positivism to modern computational argumentation. What has changed is that the component technologies — formal argumentation frameworks, argument mining, non-monotonic reasoning engines, and proof assistants — have each matured significantly, even though they have not been integrated. The theoretical frameworks (ASPIC+, ABA, AIF) provide rigorous foundations. The tools exist in prototype (Argdown for notation, TweetyProject and Clingo for reasoning, oAMF for extraction, Isabelle/HOL for verification). The most important insight from this survey is that **full formalization is neither necessary nor desirable** — a system that makes definitions explicit, surfaces hidden assumptions, maps argument structure, and identifies exactly where two theories diverge would capture most of the value while remaining achievable. The Argunauts project (2025) represents the first serious attempt to build exactly this using modern LLMs, and the legal informatics community's four decades of hard-won experience with defeasible argument formalization provides the roadmap for extending it to arbitrary knowledge work.

## Gemini \- Computational Formalization of Arbitrary Knowledge Work: Paradigms, Systems, and Methodologies for Inter-theoretic Verification

## 

The historical ambition to reduce human reasoning to a rigorous, calculable system has transitioned from a philosophical ideal to a burgeoning technical reality. At the core of this transition is the recognition that arbitrary knowledge work—ranging from metaphysical treatises to complex scientific derivations—suffers from a pervasive "semantic friction" caused by implicit assumptions, divergent definitions, and the lack of a unified logical infrastructure for comparison. The thesis that a formal language, analogous to the Lean theorem prover used in mathematics, could be developed for general academic discourse suggests a shift from interpretive narrative toward verifiable construction. By distinguishing between formal logic, foundational assumptions, and explicit definitions, such a system would enable the "compilation" of academic texts to identify logical gaps and facilitate direct theoretical alignment. This report provides an exhaustive analysis of the prior art, current software systems, and emerging research methodologies required to advance this vision across philosophy, computer science, physics, and literary theory.

### Foundations of Formal Specification and Computational Epistemology

Formal specification, traditionally rooted in software engineering, provides a mathematically based framework for describing system behavior and verifying properties of interest through rigorous reasoning tools.1 These specifications possess a clear syntax and semantics that allow for the inference of useful information, serving not as an implementation but as a model of what a system should do.1 When extended to arbitrary knowledge work, a formal specification serves as the foundational contract against which an argument's "correctness" is measured. A design or a claim cannot be declared correct in isolation; it is only correct with respect to a given specification.1

#### Paradigms of Formal Modeling

The application of formal methods to arbitrary domains requires a selection of modeling paradigms that match the structural characteristics of the knowledge being formalized. The computer science literature identifies several established paradigms that can be adapted for academic work:

| Specification Paradigm | Operational Mechanism | Academic Application Context |
| :---- | :---- | :---- |
| **State-based** | Systems described as a sequence of states (e.g., Z, VDM, B). | Modeling discrete shifts in a philosopher's conceptual framework. |
| **History-based** | Behavior interpreted over time and system histories. | Analyzing the evolution of an argument through successive revisions. |
| **Transition-based** | Focus on transitions between states (e.g., Statecharts, TLA+). | Modeling reactive reasoning or process-oriented scientific theories. |
| **Functional** | Systems defined as mathematical function structures (e.g., HOL, PVS). | Formalizing derivations where conclusions are functions of premises. |
| **Operational** | Uses process algebras or Petri nets to specify behavior. | Representing procedural knowledge or rule-following in social systems. |
| **Multi-paradigm** | Combines behavioral and actor-based models (e.g., FizzBee). | Complex interdisciplinary papers involving both agents and logic. |

The utility of these paradigms in arbitrary knowledge work lies in their ability to define "correct behaviors"—which, in the context of a philosophical paper, corresponds to the set of all valid inferences permitted by the paper’s axioms.2 A formal specification acts as a device that can answer whether a specific behavior satisfies the spec; in academic terms, it checks if a conclusion is a member of the set of all possible correct behaviors generated by the initial premises.2

#### Computational Epistemology and Solvability

Computational epistemology advances the idea that the acquisition and validation of knowledge should be treated as a computational process.3 It challenges the sharp dichotomy between "relations of ideas" (a priori logic) and "matters of fact" (a posteriori science) by demonstrating that both domains involve decidable and undecidable questions.4 For instance, the formally undecidable "halting problem" in computability theory is structurally analogous to the empirical problem of induction; both involve a failure to "digest" infinite or unbounded input.4

Formal learning theory, as a normative epistemology, focuses on the efficiency of truth-finding methods.4 It suggests that background knowledge serves to reduce the inductive complexity of a problem, allowing it to cross the threshold from unsolvability to solvability.5 In this framework, theories are evaluated based on their reliability and their ability to converge on a correct answer in a finite time, providing a metric for the "compilation" of academic arguments.4

### Theorem Provers as Engines for General Knowledge Work

Interactive theorem provers (ITPs) such as Lean, Coq, and Isabelle represent the most sophisticated tools currently available for the formalization of arbitrary knowledge work.6 These systems are built upon a small, trusted kernel—often based on dependent type theory or higher-order logic—ensuring that every claim is supported by a proof that traces back to basic axioms.7 This "absolute rigor" prevents the logical errors common in computer algebra systems (CAS) or informal text.9

#### The Lean Theorem Prover and Chemical Physics

Recent research has demonstrated that Lean is expressive enough to formalize complex scientific theories outside of pure mathematics, specifically in chemical physics.9 By formalizing the Langmuir and BET theories of adsorption, researchers have shown how Lean can be used to precisely define assumptions and derivations.10

Key features of Lean applied to non-mathematical domains include:

1. **Explicit Hypothesis Management:** Lean forces the inclusion of constraints often omitted in informal writing, such as the requirement that certain rate constants or site concentrations be non-zero to avoid division by zero.10  
2. **Tactic-Based Reasoning:** Users manipulate expressions through "tactics" (e.g., rw for rewrite, field\_simp for simplification), while the "Tactic State" window provides real-time feedback on the proof's progress.10  
3. **Modular Hierarchies:** Scientific objects are defined as "Structures" that can extend one another. For example, a "thermodynamic system" structure can be extended to an "ideal gas" structure, inheriting all base properties while adding specific constraints.10  
4. **Networked Definitions:** By building definitions off each other, researchers can create a "common basis" for various fields, allowing the derivation of laws (like Boyle's Law) from first principles in a single unified network.10

This approach transforms scientific discourse into a machine-readable library of formally-proven theories, facilitating automated scientific discovery and the integration of theorem provers with generative AI.12

#### Comparison of Primary Theorem Proving Environments

| System | Logical Basis | Architecture | Primary Strength in Knowledge Work |
| :---- | :---- | :---- | :---- |
| **Lean** | Dependent Type Theory (CIC) | Small trusted kernel with rich API. | Constructive synthesis and hierarchical structures.6 |
| **Coq** | Calculus of Inductive Constructions | Tactic-based proof development; Ltac. | System verification and biological pathway modeling.8 |
| **Isabelle/HOL** | Higher-Order Logic | LCF tradition; axiomatic type classes. | Modeling abstract algebraic structures and spacetime ontologies.8 |
| **HOL Light** | Higher-Order Logic | Minimalist; foundationalist. | Reaction kinetics and formal verification of physical systems.8 |

These systems bridge the gap between verifying a piece of mathematics and verifying the correctness of a physical or philosophical system.7 The shift from informal "pencil-and-paper" proofs to machine-checked formalization ensures that even the most complex theories are reduced back to their foundational axioms.9

### Bridging Natural Language and Formal Logic

A central challenge in formalizing arbitrary knowledge work is the translation from ambiguous natural language (NL) to precise formal representations. This process, often called "auto-formalization," leverages large language models (LLMs) to map informal propositions into verifiable code.17

#### Controlled Natural Languages (CNLs)

Controlled Natural Languages provide an intermediate solution between full NL and formal logic.20 They are precisely defined subsets of natural language engineered to reduce ambiguity while remaining intuitively readable to non-specialists.21

* **Attempto Controlled English (ACE):** Translates a well-defined subset of English into first-order logic via discourse representation structures (DRS).23 ACE supports language constructs like subject/object relative clauses, negation, and anaphoric references.23  
* **Processable English (PENG):** Similar to ACE but uses a predictive editor to guide the user in real-time, enforcing grammatical restrictions and providing look-ahead information.23  
* **Computer Processable Language (CPL):** Aimed at improving the translatability of technical documents and the acquisition of knowledge for reasoning systems.20

The PENS classification scheme is used to evaluate the expressiveness of CNLs, focusing on their ability to handle universal quantification, relations of arity greater than 1, general rule structures, and negation.21 By mapping academic claims into these modularly-extensible fragments of natural language, researchers can bridge the knowledge gap between domain experts and formal verification tools.25

#### LLM-Driven Auto-formalization Workflows

The emergence of transformer architectures has enabled the use of LLMs as translation engines for formal logic.19 Recent research focuses on reinforcing the verifiability of LLM-generated outputs through several mechanisms:

1. **Iterative Formalization:** A dialogue-based approach where the system asks clarifying questions about ambiguous terms or implicit assumptions.27  
2. **LogicSim Metrics:** A similarity metric that measures logic-relevant information, such as premise count and overlap between answers, to evaluate the quality of NL-to-FOL translations.28  
3. **PRoSFI Framework:** Trains models to output structured intermediate steps aligned with NL reasoning, each of which is then verified by a formal prover like Lean or Coq.29 This ensures that the model is rewarded for the correctness of the entire reasoning process rather than just the final answer.29  
4. **Construction-Verification Workflow:** A Lean 4 framework that compels agents to define explicit solutions (constructive synthesis) before proving their correctness, preventing shortcuts in reasoning.13

These methodologies allow for the automatic extraction of ontologies and structured data from informal text, providing a scalable foundation for the "compilation" of academic papers.27

### Structuring Argumentation: The Argument Interchange Format (AIF)

While theorem provers handle internal consistency, the Argument Interchange Format (AIF) provides a representational mechanism for exchanging argument resources across different tools and domains.31 AIF introduces a common core ontology for expressing argumentative information and relations, serving as an abstract "interlingua" between formal languages like ASPIC+ or Description Logic.33

#### The AIF Ontology and Node Constraints

The AIF core ontology is divided into the Upper Ontology (syntax) and the Forms Ontology (semantics).33 It represents arguments as networks of connected nodes, classified into two primary types: Information nodes (I-nodes) and Scheme nodes (S-nodes).

| Node Type | Functional Definition | AIF Graph Constraints |
| :---- | :---- | :---- |
| **I-nodes** | Propositions, sentences, or data (e.g., "Qualia are narrow"). | Cannot connect directly to other I-nodes.33 |
| **RA-nodes** | Rule Application (Inference relations). | At least one premise predecessor; one conclusion successor.33 |
| **CA-nodes** | Conflict Application (Inference conflict). | One conflicting element predecessor; one conflicted element successor.33 |
| **PA-nodes** | Preference Application (Strength of arguments). | One preferred element predecessor; one dispreferred successor.33 |
| **F-nodes** | Schematic Forms (General patterns). | Instantiated by RA, CA, and PA nodes to provide meaning.33 |

By using S-nodes to bridge I-nodes, the AIF explicitly represents the rationale behind every relationship in an argument.33 This structure is ideal for parsing philosophy papers, as it separates the "what" (I-nodes) from the "how" (RA-nodes), allowing a system to identify where two academics disagree—whether on the truth of an information node or the validity of an inference scheme.33

#### Dialogic Argumentation and AIF+

The AIF+ extension enables the representation of dialogic argumentation, tying together the rules of dialogue protocols with inferential relations.35 It maintains a clear separation between the normative structures of inference (rules) and the actual characterization of how individual arguments stand in relation to one another in a history.35 This allows for the formal comparison of academic positions by mapping their interactions into a three-layered scheme: an abstract ontology, protocol forms, and actual fragments of argument text.35

### Detecting Gaps through Abductive Reasoning

One of the primary goals of an academic "compiler" is to highlight major logical gaps. Recent research suggests that abductive reasoning—the process of inferring the best or most plausible explanation for a set of facts—can serve as a "missing-premise engine".36

#### Abductive Logic Programming (ALP) for CoT Verification

Abduction begins with a surprising or observed fact and works backward to find the hypothesis that, if true, would make the fact intelligible.36 In the context of Chain-of-Thought (CoT) reasoning in LLMs, abductive frameworks treat each generated explanation as a hypothesis to be tested against counter-abductive challenges.38

| Reasoning Type | Logic Direction | Utility in Paper Compilation |
| :---- | :---- | :---- |
| **Deduction** | **![][image1]** | Verifying if conclusion ![][image2] follows from premises ![][image3] and ![][image4]. |
| **Abduction** | **![][image5]** | Identifying the missing premises ![][image4] required to reach ![][image2].38 |

Abductive analysis involves five distinct steps that can be automated to detect "hallucinations" or logical leaps in an academic paper:

1. Identifying surprising observations or conclusions that need explanation.38  
2. Generating candidate hypothetical explanations (the abductive inference).38  
3. Iteratively confronting these hypotheses with existing evidence and data.38  
4. Searching for negative cases and alternative interpretations (counter-abduction).38  
5. Formulating a general theoretical contribution or flagging the gap if no consistent premise can be found.38

Because abduction operates solely on the output and does not depend on model internals, it provides a robust mechanism for detecting unsupported premises and hidden contradictions in high-fluency academic text.38

### Managing Semantic Variability: Cyc and CDC

The problem of Daniel Dennett and David Chalmers using different definitions of "qualia" or "physical substance" is a problem of ontological alignment. Several systems address the formalization of definitions across domains.

#### Cyc and Microtheories

The Cyc knowledge base (KB) is designed to serve as an encyclopedic repository of human common-sense knowledge.39 It is structured into "microtheories"—compartmentalized theories that account for the specificity of a given domain or context.39 Cyc's spatial ontology, for instance, highlights that reasoning about objects in space relies on an underlying "substantivalist" vs. "relational" metaphysics.39 To formalize a paper, one must first identify which microtheory its definitions inhabit, as this determines the valid interpretations of its assertions.39

#### Domain-Contextualized Concept Graphs (CDC)

The CDC framework addresses the rigidity of traditional ontologies by treating domains as explicit structural components rather than implicit context.41 It adopts a triple structure: ![][image6], where domain specifications serve as dynamic classification dimensions.41

This allows for context-aware reasoning where a single concept can shift meaning based on the domain:

* **Computer Science:** A "neural network" is an algorithm.41  
* **Neuroscience:** A "neural network" is a biological organ structure.41  
* **Mathematics:** A "neural network" is a function approximation.41

By operationalizing how humans understand concepts through "domain-dependent frames," the CDC framework faithfully represents cognitive organization and allows for cross-domain analogies and personalized knowledge modeling.41 This is precisely the mechanism needed to "quickly compare theories between two academics" by highlighting exactly where their definitions of the same term diverge across different disciplinary domains.

### Sophimatics and Philosophical Formalization

Sophimatics is an emerging computational framework specifically designed to translate philosophical categories into working algorithms.42 It rejects the purely syntactic manipulation of symbols in favor of a hybrid approach that integrates intentionality, temporal consciousness, and dialectical reasoning.42

#### Complex Temporality (![][image7])

A core innovation of Sophimatics is the integration of "complex time," where chronological time (![][image8]) is combined with experiential dimensions of memory and imagination (![][image9]).44

* **Memory (![][image10]):** Historical patterns and previous states.  
* **Present Awareness (![][image11]):** Current awareness and perception.  
* **Imagination (![][image12]):** Future projections and creative scenarios.44

The Super Time-Cognitive Neural Network (STCNN) implements these philosophical constraints through geometric parameters ![][image13] (memory accessibility) and ![][image14] (creative projection), allowing the system to perform temporal-philosophical reasoning.44 This enables AI systems to go beyond pattern recognition toward genuine understanding and ethical judgment, as demonstrated in Data Protection Policy use cases where regulatory compliance and decision confidence were significantly improved.42

#### The Six Phases of Sophimatics Development

| Phase | Strategic Focus | Computational Outcome |
| :---- | :---- | :---- |
| **Phase 1** | Grounding in key philosophical categories. | Identification of base axioms and ontologies.44 |
| **Phase 2** | Mapping categories into computational constructs. | Translation of Aristotelian substance theory and Husserlian intentionality.42 |
| **Phase 3** | STCNN architecture implementation. | Symbolic, ethical, and memory modules with complex-time geometry.44 |
| **Phase 4** | Modeling context and complex temporality. | Management of two-dimensional time and paradox resolution.44 |
| **Phase 5** | Ethical reasoning and intentional states. | Integration of value systems and goal-oriented behaviors.44 |
| **Phase 6** | Human-in-the-loop iterative refinement. | Expert-provided ontological corrections and neural parameter optimization.44 |

This multi-phase approach provides a roadmap for advancing the formalization of academic arguments by systematically integrating human "wisdom" with computational "sophistication".44

### Methodologies for Theory Comparison and Inter-theoretic Reduction

The goal of comparing two theories—such as those of Dennett and Chalmers—requires formal notions of inter-theoretic reduction.50 One way to understand the notion of truth or a conceptual claim is to examine the principles we are willing to associate with it via an axiomatic approach.50

#### Logical Strength and Theoretical Virtues

Scientific and philosophical theories are standardly selected based on their adequacy to data and theoretical virtues like "strength".52 Timothy Williamson characterizes logical strength in terms of deductive power: a theory ![][image15] is logically stronger than ![][image16] if every theorem of ![][image16] is a theorem of ![][image15], but not vice versa.52

To compare theories ![][image17] and ![][image18], one can define an "interpretation"—a translation that preserves provability.52 If a translation ![][image19] from ![][image20] of ![][image17] to ![][image21] of ![][image18] ensures that for every set of ![][image20]\-sentences ![][image22] and sentence ![][image23], ![][image24] implies ![][image25], then ![][image17] is successfully interpreted into ![][image18].52 This formal method allows for the evaluation of whether a reduction of one theory to another is viable, or if they are conceptually equivalent truth predicates.50

#### A 5-Step Paradigm for Theoretical Comparison

A proposed methodology for pitting academic theories against each other includes:

1. **Define Theory Scope:** Select theories addressing the same research problem.53  
2. **Verify Non-Contradictory Assumptions:** Ensure base axioms don't directly negate each other in ways that make comparison disputable.53  
3. **Define the Essential Disagreement:** Identify a crucial effect or feature on which the theories take opposing positions.53  
4. **Operationalize:** Propose an operationalization (paradigm) that can test this essential position.53  
5. **Critical Testing:** Measure opposing hypotheses using a shared paradigm to disentangle the theories.53

This rigorous approach addresses the "theory crisis" in disciplines like psychology, where high degrees of "underdetermination" (multiple theories fitting the same data) can only be resolved by adopting formal modeling as a aid for thinking and a non-experimental method for theory evaluation.54

### Domain-Specific Applications: Narratology and Literary Theory

The primary use case of philosophy is extensible to other "arbitrary" knowledge work, such as formal narratology and literary theory. Formal narratology seeks ahistorical taxonomic descriptions of narrative forms, often separated from content-specific interpretation.55

* **Cybertext Theory:** Views a text as a machine consisting of medium, operator, and signs (textons and scriptons).56 It specifies operations using Aarseth's traversal function (dynamics, determinability, transience, perspective, etc.), expanding the options for formal analysis.56  
* **Computational Narratology:** Uses narrative information extraction to create "audience models," which are increasingly applied to AI safety to help agents act in the best interest of humanity by "reading and understanding stories".57  
* **Interactive Storytelling:** Employs analytical lenses (believability, adaptivity, performativity) and "constrained readings" to overcome the indeterminate nature of interactive narratives.58

These fields demonstrate that even "soft" humanities can be subjected to formalization through the identification of structuralist frameworks, such as Vladimir Propp's morphology of the folktale, which allows story generating programs to use problem-solving techniques and grammar production.57

### Advanced Paradigms for Verification and Alignment

To realize the "LEAN for arbitrary knowledge work," we must advance theories of how to align LLM-generated formalizations with expert intent.

#### Adversarial Learning with Instructive Verbal Evaluation (ALIVE)

The ALIVE framework moves beyond scalar rewards (like binary "correct/incorrect" flags) toward intrinsic reasoning acquisition.60 By coupling adversarial learning with instructive verbal feedback, the model internalizes evaluative criteria directly from raw corpora.60 This "hands-free" alignment transforms external critiques into an endogenous reasoning faculty, mitigating the "reward bottleneck" that often makes formal models brittle across different academic domains.60

#### Inductive Bias and Social Choice

Alignment in arbitrary knowledge work is also a "Social Choice Problem".61 Techniques like Reinforcement Learning from Human Feedback (RLHF) often fail to satisfy properties such as respecting the majority or Condorcet consistency.61 Current research explores Nash Learning from Human Feedback (NLHF) to approximate "maximal lottery outcomes," ensuring that a formal system aggregating diverse philosophical preferences remains principled and counter-intuitive results are minimized.61

### Conclusion: Strategic Roadmap for a Unified Knowledge Compiler

The synthesis of existing research identifies several critical pathways for advancing the formal specification of arbitrary knowledge work. The foundational requirement is the adoption of Interactive Theorem Provers like Lean or Coq as the "kernel" of the system, providing absolute logical rigor for derivations. To address semantic arguments, the system must integrate Domain-Contextualized Concept Graphs (CDC) or Cyc-like microtheories to explicitly track the "domain @ context" of every definition, ensuring that Dennett and Chalmers are compared on their actual assumptions rather than lexical shadows.

The transition from natural language to this formal kernel should be mediated by Controlled Natural Languages (ACE/PENG) and LLM-driven auto-formalization workflows like PRoSFI, which prioritize step-level verification over final-answer probability. To "compile" a paper and find major gaps, abductive reasoning should be implemented as a structural corrective layer for Chain-of-Thought, identifying missing premises and enforcing global coherence. Finally, Sophimatics provides a blueprint for integrating "wisdom"—context, intentionality, and complex time—into the heart of the computation, ensuring that formal academic arguments are not just valid, but meaningfully aligned with human experiential reality. By creating a networked library of such formalized theories, the academic community can move beyond "anti-rational" semantic friction toward a truly cumulative and verifiable science of arbitrary knowledge work.

#### Works cited

1. Formal specification \- Wikipedia, accessed March 12, 2026, [https://en.wikipedia.org/wiki/Formal\_specification](https://en.wikipedia.org/wiki/Formal_specification)  
2. Formal specs as sets of behaviors \- Surfing Complexity, accessed March 12, 2026, [https://surfingcomplexity.blog/2025/07/26/formal-specs-as-sets-of-behaviors/](https://surfingcomplexity.blog/2025/07/26/formal-specs-as-sets-of-behaviors/)  
3. Computational Philosophy, accessed March 12, 2026, [https://plato.stanford.edu/entries/computational-philosophy/](https://plato.stanford.edu/entries/computational-philosophy/)  
4. Computational Epistemology \- Department of Philosophy \- Dietrich College of Humanities and Social Sciences \- Carnegie Mellon University, accessed March 12, 2026, [https://www.cmu.edu/dietrich/philosophy/research/areas/science-methodology/computational-epistemology.html](https://www.cmu.edu/dietrich/philosophy/research/areas/science-methodology/computational-epistemology.html)  
5. Formal Learning Theory \- Stanford Encyclopedia of Philosophy, accessed March 12, 2026, [https://plato.stanford.edu/entries/learning-formal/](https://plato.stanford.edu/entries/learning-formal/)  
6. The Lean Theorem Prover (system description) \- Carnegie Mellon University \- Figshare, accessed March 12, 2026, [https://kilthub.cmu.edu/articles/journal\_contribution/The\_Lean\_Theorem\_Prover\_system\_description\_/6492815](https://kilthub.cmu.edu/articles/journal_contribution/The_Lean_Theorem_Prover_system_description_/6492815)  
7. The Lean Theorem Prover (system description), accessed March 12, 2026, [https://lean-lang.org/papers/system.pdf](https://lean-lang.org/papers/system.pdf)  
8. Theorem Provers \- From Zero to QED, accessed March 12, 2026, [https://sdiehl.github.io/zero-to-qed/03\_theorem\_provers.html](https://sdiehl.github.io/zero-to-qed/03_theorem_provers.html)  
9. Formalizing Chemical Physics in Lean | PDF | Mathematical Proof | Adsorption \- Scribd, accessed March 12, 2026, [https://www.scribd.com/document/847780981/Formalizing-Chemical-Physics-Using-the-Lean-Theorem-Prover](https://www.scribd.com/document/847780981/Formalizing-Chemical-Physics-Using-the-Lean-Theorem-Prover)  
10. Formalizing chemical physics using the Lean theorem prover ..., accessed March 12, 2026, [https://pubs.rsc.org/en/content/articlehtml/2024/dd/d3dd00077j](https://pubs.rsc.org/en/content/articlehtml/2024/dd/d3dd00077j)  
11. FORMALIZING CHEMICAL THEORY USING THE LEAN THEOREM PROVER \- Zulip, accessed March 12, 2026, [https://leanprover.zulipchat.com/user\_uploads/3121/SlkRnu2Ib2UbZCQfgnekkmmL/Formalizing\_Chemical\_Theory.pdf](https://leanprover.zulipchat.com/user_uploads/3121/SlkRnu2Ib2UbZCQfgnekkmmL/Formalizing_Chemical_Theory.pdf)  
12. Formalizing chemical physics using the Lean theorem prover \- RSC Publishing, accessed March 12, 2026, [https://pubs.rsc.org/en/content/articlelanding/2024/dd/d3dd00077j](https://pubs.rsc.org/en/content/articlelanding/2024/dd/d3dd00077j)  
13. Construction–Verification: A Benchmark for Formalizing Applied Mathematics in Lean 4, accessed March 12, 2026, [https://arxiv.org/html/2602.01291](https://arxiv.org/html/2602.01291)  
14. A Comprehensive Formalization of Propositional Logic in Coq: Deduction Systems, Meta-Theorems, and Automation Tactics \- MDPI, accessed March 12, 2026, [https://www.mdpi.com/2227-7390/11/11/2504](https://www.mdpi.com/2227-7390/11/11/2504)  
15. Formal reasoning about systems biology using theorem proving \- PMC \- NIH, accessed March 12, 2026, [https://pmc.ncbi.nlm.nih.gov/articles/PMC5495343/](https://pmc.ncbi.nlm.nih.gov/articles/PMC5495343/)  
16. Using Axiomatic Type Classes in Isabelle \- ResearchGate, accessed March 12, 2026, [https://www.researchgate.net/publication/2435717\_Using\_Axiomatic\_Type\_Classes\_in\_Isabelle](https://www.researchgate.net/publication/2435717_Using_Axiomatic_Type_Classes_in_Isabelle)  
17. \[2505.23486\] Autoformalization in the Era of Large Language Models: A Survey \- arXiv, accessed March 12, 2026, [https://arxiv.org/abs/2505.23486](https://arxiv.org/abs/2505.23486)  
18. Autoformalization in the Era of Large Language Models: A Survey \- arXiv, accessed March 12, 2026, [https://arxiv.org/html/2505.23486v1](https://arxiv.org/html/2505.23486v1)  
19. Towards a Common Framework for Autoformalization \- arXiv, accessed March 12, 2026, [https://arxiv.org/html/2509.09810v2](https://arxiv.org/html/2509.09810v2)  
20. Controlled Natural Languages for Knowledge Representation. | Request PDF \- ResearchGate, accessed March 12, 2026, [https://www.researchgate.net/publication/221101471\_Controlled\_Natural\_Languages\_for\_Knowledge\_Representation](https://www.researchgate.net/publication/221101471_Controlled_Natural_Languages_for_Knowledge_Representation)  
21. A Survey and Classification of Controlled Natural Languages \- MIT Press, accessed March 12, 2026, [https://direct.mit.edu/coli/article/40/1/121/1455/A-Survey-and-Classification-of-Controlled-Natural](https://direct.mit.edu/coli/article/40/1/121/1455/A-Survey-and-Classification-of-Controlled-Natural)  
22. Controlled natural languages for knowledge representation \- Macquarie University, accessed March 12, 2026, [https://researchers.mq.edu.au/en/publications/controlled-natural-languages-for-knowledge-representation/](https://researchers.mq.edu.au/en/publications/controlled-natural-languages-for-knowledge-representation/)  
23. Controlled Natural Languages for Knowledge Representation \- ACL Anthology, accessed March 12, 2026, [https://aclanthology.org/C10-2128.pdf](https://aclanthology.org/C10-2128.pdf)  
24. Controlled Natural Languages for Knowledge Representation and Reasoning, accessed March 12, 2026, [https://d-nb.info/1365193284/34](https://d-nb.info/1365193284/34)  
25. Trustworthy Formal Natural Language Specifications \- arXiv.org, accessed March 12, 2026, [https://arxiv.org/pdf/2310.03885](https://arxiv.org/pdf/2310.03885)  
26. Towards a Common Framework for Autoformalization \- arXiv, accessed March 12, 2026, [https://arxiv.org/pdf/2509.09810?](https://arxiv.org/pdf/2509.09810)  
27. Towards a Common Framework for Autoformalization \- arXiv, accessed March 12, 2026, [https://arxiv.org/abs/2509.09810](https://arxiv.org/abs/2509.09810)  
28. Into The Limits of Logic: Alignment Methods for Formal Logical Reasoning \- ACL Anthology, accessed March 12, 2026, [https://aclanthology.org/2025.mathnlp-main.8/](https://aclanthology.org/2025.mathnlp-main.8/)  
29. learning to generate formally verifiable step-by-step logic reasoning via structured formal \- OpenReview, accessed March 12, 2026, [https://openreview.net/pdf/b25dbdbfe8392593939d3492a882ae04686512ff.pdf](https://openreview.net/pdf/b25dbdbfe8392593939d3492a882ae04686512ff.pdf)  
30. \[2511.11829\] Towards Autoformalization of LLM-generated Outputs for Requirement Verification \- arXiv.org, accessed March 12, 2026, [https://arxiv.org/abs/2511.11829](https://arxiv.org/abs/2511.11829)  
31. Argument Interchange Format \- Wikipedia, accessed March 12, 2026, [https://en.wikipedia.org/wiki/Argument\_Interchange\_Format](https://en.wikipedia.org/wiki/Argument_Interchange_Format)  
32. Contributing to the Argument Interchange Format \- ARG-tech, accessed March 12, 2026, [https://www.arg.tech/index.php/research/contributing-to-the-argument-interchange-format/](https://www.arg.tech/index.php/research/contributing-to-the-argument-interchange-format/)  
33. The Argument Interchange Format (AIF) Specification \- ARG-tech, accessed March 12, 2026, [http://www.arg-tech.org/wp-content/uploads/2011/09/aif-spec.pdf](http://www.arg-tech.org/wp-content/uploads/2011/09/aif-spec.pdf)  
34. On Logical Specifications of the Argument Interchange Format, accessed March 12, 2026, [https://webspace.science.uu.nl/\~prakk101/pubs/aifsem12.pdf](https://webspace.science.uu.nl/~prakk101/pubs/aifsem12.pdf)  
35. AIF : Dialogue in the Argument Interchange Format \- ARG-tech, accessed March 12, 2026, [https://www.arg-tech.org/people/chris/publications/2008/comma2008-aif+.pdf](https://www.arg-tech.org/people/chris/publications/2008/comma2008-aif+.pdf)  
36. What is Abductive Reasoning? | In-depth Guide & Examples \- ATLAS.ti, accessed March 12, 2026, [https://atlasti.com/research-hub/abductive-reasoning](https://atlasti.com/research-hub/abductive-reasoning)  
37. Abductive Reasoning | Overview & Examples \- Lesson \- Study.com, accessed March 12, 2026, [https://study.com/academy/lesson/abductive-reasoning-definition-examples.html](https://study.com/academy/lesson/abductive-reasoning-definition-examples.html)  
38. Tackling LLM Hallucination with Abductive Reasoning \- Preprints.org, accessed March 12, 2026, [https://www.preprints.org/manuscript/202511.1688](https://www.preprints.org/manuscript/202511.1688)  
39. Tucking RCC in Cyc's Ontological Bed \- IJCAI, accessed March 12, 2026, [https://www.ijcai.org/Proceedings/03/Papers/129.pdf](https://www.ijcai.org/Proceedings/03/Papers/129.pdf)  
40. Cyc \- AAAI Publications, accessed March 12, 2026, [https://ojs.aaai.org/aimagazine/index.php/aimagazine/article/download/842/760](https://ojs.aaai.org/aimagazine/index.php/aimagazine/article/download/842/760)  
41. Domain-Contextualized Concept Graphs: A Computable Framework for Knowledge Representation \- arXiv.org, accessed March 12, 2026, [https://arxiv.org/html/2510.16802v1](https://arxiv.org/html/2510.16802v1)  
42. Bridging Computational Structures with Philosophical Categories in Sophimatics and Data Protection Policy with AI Reasoning \- MDPI, accessed March 12, 2026, [https://www.mdpi.com/2076-3417/15/20/10879](https://www.mdpi.com/2076-3417/15/20/10879)  
43. A Novel Architecture for Understanding, Context Adaptation, Intentionality and Experiential Time in Emerging Post-Generative AI Through Sophimatics \- MDPI, accessed March 12, 2026, [https://www.mdpi.com/2079-9292/14/24/4812](https://www.mdpi.com/2079-9292/14/24/4812)  
44. Co-Creation by Human–AI Sophimatics Framework and Applications \- ResearchGate, accessed March 12, 2026, [https://www.researchgate.net/publication/401273202\_Co-Creation\_by\_Human-AI\_Sophimatics\_Framework\_and\_Applications](https://www.researchgate.net/publication/401273202_Co-Creation_by_Human-AI_Sophimatics_Framework_and_Applications)  
45. (PDF) Super Time-Cognitive Neural Networks (Phase 3 of Sophimatics): Temporal-Philosophical Reasoning for Security-Critical AI Applications \- ResearchGate, accessed March 12, 2026, [https://www.researchgate.net/publication/397400799\_Super\_Time-Cognitive\_Neural\_Networks\_Phase\_3\_of\_Sophimatics\_Temporal-Philosophical\_Reasoning\_for\_Security-Critical\_AI\_Applications](https://www.researchgate.net/publication/397400799_Super_Time-Cognitive_Neural_Networks_Phase_3_of_Sophimatics_Temporal-Philosophical_Reasoning_for_Security-Critical_AI_Applications)  
46. Sophimatics and 2D Complex Time to Mitigate Hallucinations in LLMs for Novel Intelligent Information Systems in Digital Transformation \- MDPI, accessed March 12, 2026, [https://www.mdpi.com/2076-3417/16/1/288](https://www.mdpi.com/2076-3417/16/1/288)  
47. Super Time-Cognitive Neural Networks (Phase 3 of Sophimatics): Temporal-Philosophical Reasoning for Security-Critical AI Applications \- MDPI, accessed March 12, 2026, [https://www.mdpi.com/2076-3417/15/22/11876](https://www.mdpi.com/2076-3417/15/22/11876)  
48. Sophimatics: A Two-Dimensional Temporal Cognitive Architecture for Paradox-Resilient Artificial Intelligence \- MDPI, accessed March 12, 2026, [https://www.mdpi.com/2504-2289/9/12/314](https://www.mdpi.com/2504-2289/9/12/314)  
49. Co-Creation by Human–AI Sophimatics Framework and Applications \- MDPI, accessed March 12, 2026, [https://www.mdpi.com/1999-4893/19/3/175](https://www.mdpi.com/1999-4893/19/3/175)  
50. EQUIVALENCES FOR TRUTH PREDICATES \- Carlo Nicolai, accessed March 12, 2026, [https://carlonicolai.github.io/TESCFIN.pdf](https://carlonicolai.github.io/TESCFIN.pdf)  
51. Truth and Reduction. \- AILA, accessed March 12, 2026, [https://www.ailalogica.it/pdf/tesi/%5Bmarrano%5DtesiM.pdf](https://www.ailalogica.it/pdf/tesi/%5Bmarrano%5DtesiM.pdf)  
52. On Logical and Scientific Strength \- PMC \- NIH, accessed March 12, 2026, [https://pmc.ncbi.nlm.nih.gov/articles/PMC12423185/](https://pmc.ncbi.nlm.nih.gov/articles/PMC12423185/)  
53. Comparing theories of consciousness: why it matters and how to do it \- PMC \- NIH, accessed March 12, 2026, [https://pmc.ncbi.nlm.nih.gov/articles/PMC8372971/](https://pmc.ncbi.nlm.nih.gov/articles/PMC8372971/)  
54. Psychology's Theory Crisis, and why formal modelling cannot solve it, accessed March 12, 2026, [https://open.lnu.se/index.php/metapsychology/article/download/4224/4290](https://open.lnu.se/index.php/metapsychology/article/download/4224/4290)  
55. Narrative Concepts in the Study of Eighteenth-Century Literature \- OAPEN Library, accessed March 12, 2026, [https://library.oapen.org/bitstream/20.500.12657/37501/4/626753.pdf](https://library.oapen.org/bitstream/20.500.12657/37501/4/626753.pdf)  
56. Cybertext Theory: What An English Professor Should Know Before Trying | ebr, accessed March 12, 2026, [https://electronicbookreview.com/publications/cybertext-theory-what-an-english-professor-should-know-before-trying/](https://electronicbookreview.com/publications/cybertext-theory-what-an-english-professor-should-know-before-trying/)  
57. The Pennsylvania State University \- PSU, accessed March 12, 2026, [https://honors.libraries.psu.edu/files/final\_submissions/5285](https://honors.libraries.psu.edu/files/final_submissions/5285)  
58. Believability, adaptivity, and performativity: three lenses for the analysis of interactive storytelling \- SFU Summit, accessed March 12, 2026, [https://summit.sfu.ca/item/8972](https://summit.sfu.ca/item/8972)  
59. The Art of Narration and Artificial Narrative Intelligence: Implications for Interdisciplinary Research \- ResearchGate, accessed March 12, 2026, [https://www.researchgate.net/publication/338675139\_The\_Art\_of\_Narration\_and\_Artificial\_Narrative\_Intelligence\_Implications\_for\_Interdisciplinary\_Research](https://www.researchgate.net/publication/338675139_The_Art_of_Narration_and_Artificial_Narrative_Intelligence_Implications_for_Interdisciplinary_Research)  
60. ALIVE: Awakening LLM Reasoning via Adversarial Learning and Instructive Verbal Evaluation \- arXiv.org, accessed March 12, 2026, [https://arxiv.org/html/2602.05472v1](https://arxiv.org/html/2602.05472v1)  
61. Jackpot\! Alignment as a Maximal Lottery \- arXiv.org, accessed March 12, 2026, [https://arxiv.org/html/2501.19266v1](https://arxiv.org/html/2501.19266v1)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFQAAAAWCAYAAABe+7umAAAB+UlEQVR4Xu2XyysGURjGX6VEkaLYSDYWJDsbWbCxEjZia8HCn2BnaUW2ROxsrGzssVAW5FbSZ0ORW+7J5X07c3zT05nL8c1FffOrp2aed6Z555kzc+YQZWRk/C9K0ShmOlk3aFoyhUaczLAeWN+OXlm34K3+Hp08uod2LFiQaKAa3TjSSMrfwIKLQTQMyGtXhWYAHaxTUtf/gpoNqQW6jaaDV9iaIzQMtLCG0QxAX1Nfv9lVsyHxQOVGpeFeLDDllE6grawtZ7uH1PU/8mUrEg/0kLwDWyNVG8CCizgC/YR9/VAbwA9D4oF6jcBuUv4sFoCoA21i7YLXR6oXmTRtSS3Qe9Yd683Z32fVuI7z4gQNAzaBvrNK0KR8n7VYCGCPteKhZdYSa5G1wJqnAh+A/n6OYsECmYmDkG/iEJoG6lnHaDqMkOpVfulsKCggW2R0mV53G87QMNDG6kfTwBP5r2z0KK3Egg+JBur1/bThEg0DMlN3oQlUs87RBMZI9XuFBR82WdMWmlSn/Q1pLswr60cODQPXaBiQJWYZmgb0IAhzrJDYCJUnIY2NY8ESmUD8bvCCNYEm4P7fDaucnBiC2AOdYz2SmtFl3f5MhS3tNOukbvSAteNsv7Dq3Ad5oJeYtgpD7IEWG1mgEZMFGjFZoBGTBRoxFWhEyQ/SdprDwolB+gAAAABJRU5ErkJggg==>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA0AAAAXCAYAAADQpsWBAAAAoElEQVR4XmNgGFmgHYj/o2FRFBVIIIQBouAhugQQfAbij+iCqQwQDS7oElDAxwCRhwM7qMBkZEEsAEUTzN2EAFzNSiinECGHE8TCGMTaggKorskfiJ2B2B6IHRiQQhak4TWMgwaygbieAWFwOUwCn00wAJK/hSxwDSrIjiyIBHIZIPLh6BIw25jQxOWQ5LCCvQwIBe+gdCNUbg1M0SiAAgBo4zGnS6DHvwAAAABJRU5ErkJggg==>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA0AAAAWCAYAAAAb+hYkAAAAl0lEQVR4XmNgGP5gAhB/BOL/UPwdiN+hia2Cq0YDMAXoQJ4BuzgYgCSOowtCAVZNEQwQCXd0CSDgZMCh6RoDDgkgWM+AQw6XfxwZIOIT0SVAAKbpAxC/B+IfUP5lIBZGUgcHMP8koUvgAzcZsDsNL8DlH7wApOEOuiA+UM0A0ZSOLoENTAbizwyQkAKls69A/A9FxSjADgC5si4y0h+wnAAAAABJRU5ErkJggg==>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAUCAYAAAC9BQwsAAAAl0lEQVR4XmNgGDbgJxBzogsSAlVA/B+In6JLEAIgTTDMhiaHExQAcTMQ1zJANN5DlcYNQIqR2SDMjCSGFSQDcTcSv4MBovEqkhhWgGwbDMBsxQnCgHgquiAQTGaAaDyJLgED+EzFaasHEC9EF0QC8xkgGvegS2A1DQ1g2GoFxGuRBXCAdQwQjXC1MJNIwQxyWASJwUMFAACAHjzA3m4aXwAAAABJRU5ErkJggg==>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAWCAYAAABaDmubAAACGklEQVR4Xu2YvUscURTFL4qKqJWFYMCARLARLGy0UTBVBBWbxFZIJaLYiJVY+R8Igk2IpY1VqvwTIaaIlUEU43e0SPxA7+HNuOtx38x745hd5P3gsDv3vJm9c2ffuzMjEggEAqm8Us2oVlTtRfG+ou8BDz6rblVbqiFVh2pZtafqjbxK4reYnGKdqY5Vl9H2X1X9/egygUSuVA1sKPNi/G9sVABrYnJrZEMKBbcxzgELHzngyrUkJwDgj3GwAkgq3okYr42NiB0OWLAdP5FTMTtWs0FkOngKeRwznmmliItew0bELgcseOfZJWanbTZK4H1wB9AcaznoQYuYvJbYEFNMePjX2tjngAXvc78Rs1MTG/+RXxzwAI0V+ZfqC2hgFxwkDjhgwbuw8VQpJx9Uqxx0JM7/XMzdAAqJbfSMyaJxNspS2BHVoKpfNaB6K+nrcLeqJ4MWxBSmWfxIyt8F3K654P0b2MF21XDFccJx8nOqqgcjHvNONZxB+J1/qjfiTquYvD6x4cGzrbEuVxz+Tw7mSKdqg4MOYPlAbq/Z8GCTAxbQi7z4ISa5OjYipsT479nIEduMScPlT5EGHtdnOUhgCcSM8iZOkKc5bqrzSD6JRSnd0dPAWp9Xbt9VExyMwBMn7vMz81UKiaKJ4BMnDdbjQc9AlsKg8+Nkj1R/xDwc4IXRUxgVk8uh6osU3jVMFw8KBAKBQOBFcgfs0Y5cgUfjsgAAAABJRU5ErkJggg==>

[image6]: <data:image/png;base64,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>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADQAAAAYCAYAAAC1Ft6mAAABu0lEQVR4Xu2WTSsFURjHH+/K+1uSlaJkYaWsLBQ2CllYKWQhWbCREgprLJSUb6CsZCNrC1lQPoGFjbyLUPg/zrn3PvM0d9wzE6v51a955n9Oc8/cOefMEMXExATQDbfhDMwV+YKof9iHXw7+N8/wFm7a81J4RGYsD/bogYMhn0x3bPbJ/pI6eA5LKHUzEh7PGakxVZJ5QpJsMp24s+ZSBxnQAyfgpHXY25yWF3s89aReukjd0AHMkgGZOcqd+lWeD9dVFsQdPIYdsBHWwxoy//hvjMBqW/O0CuJNnkzLEwsPxG9qlcNaHfqQB1916Mi1qDdEHQq/9ePChw5CIH9/XNTO5JC5WNC8DaIALuswBJ/2yMuBp19o5sjcUK9uyJAx2A7bAmxJ9k6PfEJronbmiaJNtyUym0lfgJ3J3unZFfWhqJ2Jun54J+OnHJUKOG/r0OPhbTnK+kkQegCKE1gFZ2GxapNcwUIdMjtkBjOqclf44vc6DMkFnCLzrilSbQNkxtskw0Eyb2R+99xYeR29U7R/mndLvsYebIVlZL5AwtAAHym1HBJuyU7/CX/2LMIVuEpmCsXExMTEOPMNCmJlgU2BYQkAAAAASUVORK5CYII=>

[image8]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADUAAAAYCAYAAABa1LWYAAACZklEQVR4Xu2WO2gVURRFtxGUKCpaaBsVrBQiNhYW/lpLwTIQLGysBFFBEIwIauGnUAtJsLBSQdDGgEVURFAMwU+KoFhYaaL4Q/yezZnBk/3uTWYSk4fwFmzIW/fcz0zm3hmgRYsc8yzLVNZkl4pm80PFFFhlGVSZ46Tlg+V3ka+Wd5bvwXWUxVPgp6VNXDluldwt+pDTlgvh96SUgyj9cL9aGypwyXJD3Br4DWsPbj18jrPBkZeWfeJSa8zC4nsqja3wtqfaUIHUAh5bFoi7Dq/VfXcC/thFLqPiY8hNyEG3a4NxEd7WK34ydiJ9Ub9UIP+UDKgwliBd28Az5AtzExJOwLt5BH7CRV5j/H4oWacCPj73nrJHRQHrF6tUUgvvhJ9ar8QTbvwvllvwi5mLxv78vVtcig3w2lPaMAGsP6BSYRFPvIeWJ5ZvhZsfiwJs0+c6dVHbxKW4Ca/lf70qrO9TGSn3Ew+EyPPCK9yo0fM0G7EcC46wZqW4FKxLzTMRfO08UBkZRnrQ43C/XHy5iDPwR2DzuNa/sKZDZQLW1X05f7Y8UhnJ3alPcD9HPN1HcSlYt0WlsBFex8OmDuxzTWWEBfdVIn+xdEMqjYXym3Xd4pTb8Lo6+4mwz0GVJYfgBTu0AY0XVf69VzzZZBkT98ZyR5yic1SFfZaqPAd/hLgQnnrv0fieWAvvzMVxYy4KbfuLNoZj8KKULqQXzHk496jlLbw/Xw/0R0NdDj4RqXFnjZmY/LzlqsrZhN90V1ROk5m4UbX5l4s4bOlR2Qz4VcI9OV1WWF6obCb8+Kx7bCs8dVv89/wB2gyv4dnq59AAAAAASUVORK5CYII=>

[image9]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADgAAAAYCAYAAACvKj4oAAACaElEQVR4Xu2WS6hNURjH/x5JHslALqVuiZSkxMhIN5JXiBIlUjIzUJIM6MqEJBOGIsYiyWPAWMIEAxMZiLwfkff371uru+7/rHW24+w6J51f/Tvt3/ft7+y771r7bKBHj3aZraJFlqnoJn6r+AfGWN6rLPHA8gX+xTFvh3XUxwvLFHGvMPy7qxJZZ7mbHFeiA+pmq+WlSvh3Lsq4X+J2Wj6KY99UcVlGw5vvaaFGOL9P3BrLHnHz4b0nxI+3nBW3A776KtkLH7pSCzUxHfnVkdsKF+G9k8UPwG+IkpvbwAeUG9dbjiXHvNijlu2J4wo4ZDllGZf4CO/8N5XGLhUob5V5lhEq4b0rVCqloXMthy3H4fVLloOhdhW+PDZabga3HPk5Py3nVRbg+ez/W3jjrqlMifvvjhaMz+HzDLxn6VAJq4PjH5pCtzDjBsXl4MOGvemKqeKx5anKlH3woau0YOwPn6zrEuOy0//WguB0KdGlS7oEbxZ7J2mhCfGcIs32X4T1IxmnT7DbwSt021RmYF/u/GZcQcU5VUOnwesTxNPxwaLusjiS683Bvh8qK3hkeaMyMgo+9L4WEk6j8QbMDG5s4mYENzEcp28Z9OeS4xyL4X2t7D/y1XJdZYQ/phy6WQsJrHNISm7/HUjcDfjNi1xA4wzlIfz8fvFV8Jy1KjmMe4//2teWdygvDQ7YIO4J8k/d7/D+OeL7g1dOwp/U/MHndfB6PsHn6P4ukZvbEXgh+nbSLpssz1V2it2WZyrbhDdN3287CrdBfAi1yxLLLZXdQB17ZiSG3rK6Dr7lzFLZIltU9Pif+AP6J6y9hakQ0wAAAABJRU5ErkJggg==>

[image10]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFwAAAAYCAYAAAB3JpoiAAADRUlEQVR4Xu2YS8gOURjH/y5JLsnCnfrKJYVIrCwkl+QWokS5pMTKQiRJRDYk11gQESsLkeSywIoQSliwkCJyv0Tu5++Z8Z33/555550xfNT86ultfs85Z86ZmXPmzAuUlJT8WfqpyMg4FSXJfFeRg1YuXqv8X7jp4gPsQsTxsqJEcTxx0UncM1SeOy1iprm45h03JX1cXIb175zkEtEBFc1cF09Vws45POC+iVvk4q04lusi7m8zEpXXbYgcB2kJK3RdEwXC9ruKm+JimbjBsLJbxbd1cVDcQtjsLJqBKmrAvi4R98nFJXEVrIBVnKiJguiO8F0PLV3HYGU7ih8Nu0FKqN28zIO1xxtZD51h5fnrcybyibxBcoHpLjZ7x7x4m1ws8BxnyDoXu1208XwMn0zedWWxClg/Qn0Z5KKZSljZCSozshb52lmDcF/3I+x/kTTIAS42uNgCyx+HdY6cgk3nmWh8UYxHuJ2vLg6rTID1Wb5eeCNPq6yTvbBzcd3NQzwblV0I+5/E6/cVTTjeR78HYGXGNqYwOXK88D50wwJuvbgQfHmyrD+j0rjr4oHKFE7CxtZTExm5iPCF3QbzPTRBVsKSkzThWBX9Mq9LApcJPdnQyOnUp/OXoCR481i2gyZqENdJg3266uKxi/aSy8sRhM+9E+b5MFdRa/2OYX5jwOkO4ULkFbr5KgOwXKh+Lfi01lOHg7/v4paLFpLLS9Iavg9h/5O0QXaD5duJp+OLUt0JcSRUNgTLfVGZwh0XL1TWgE86l89HqB5TVkbA+lz3LoV3mokbmvDYg+rKvSPX2nO9IhdPV/8rkP6Qdxwi7nyW9Zt8hA0wD3zpvYPtvPLCPnMn58M2gw8BPy5YYbYmPJjnoHxC6/dqz51F5bTlWqdtKLdh9RvEp8E6U1VmZAdsZnHrmRXukPxZyRlUNQ4Ojms378JzF6+QPJVZeYa4ewjvaj7DyvcX3xB5ZTtst8APIPaD/eHTwXb0/ZBEqN28LIe15+/G6oH/R3EcR2H1x1SmmwZ2RL8ef5dZsF1H0WS94P8kS108VPmb8Cbq/zMlHly2itoDj3JxXmVJNUWsuc3R+BVckgLf4n1VZmSOipKSkqbiB0KQ5rlhAIYhAAAAAElFTkSuQmCC>

[image11]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFwAAAAYCAYAAAB3JpoiAAADZ0lEQVR4Xu2YWahOURTHlzEZQmZStwwpGRIvPMiYTCFKlEiJPChKkkSkRELEi0zhxYOMGRKeDAkvSAp5kHmOzOt/1zn32+f/rfOde93Pvanzq9XX+a29z97nnL332ecTycnJ+bf0ZlFDxrLISec3i7+gqcZ7lv8LdzS+iN2ION4mSpSP5xodyL2SZNtZETNV42ZwXJ/01Lgm1r8LlEuFL6jczNF4wVKszSGO+0VugcZHcijXiVxdM1yS920gHbs0Fit0ixNlBOfvTG6yxjJyA8TKbiXfQuMAuflis7M+QV8XkfumcZVcguViFSdwokx0Ff+pe0vXMbGybcmPEntAjHfeUrTR6M/SoT0Lh45i7eM35FzkU/kg6QWmaWwOjnHzNmnMCxxmyFqNXRrNAx+DkYmnzixkIdYPry/9NBqwFCs7nmUKWJJQ/mX0ezKZTlAqF7Na/L7uFd9XkXaRfTXWa2wRyx/XWBPlzohN5xlSeFGME/88PzUOsUwB9VG+uuBBnmXpcEKK1/slYu3xzDmtMYicRzwbmZ3i+0ri9fsGJ5TP0e8+sTJjCimZFDnc+BC4wY5bR84DL0+UDWdUFvc1nrB0wC4ijUdSGHSII8l0KlfEv7HbxHw3ToAVYsmJnFBWRr/I85KAZYIbw6iA46kPFy5BaeDhoWxrTpQgrpMF98mjGYsMDovf9g4xj8FcRKn1Owb5DY7jHcLlyDNwc1k6oJxXvxSnpPp1hkqhjQcaTZLpBBdZOKSt4XvE95VkXWQXsXxL8nB4UbLDWsl4ZT1Q7gfLDO5pvGHpgPfLdSmMdOzr0d7+qhIF2mksZekwTOwc1d6lNBJL3OZEwG4prtwjcuEU7B65VtFx+BUIfzA49og7X5P1G3wVu8AsvrOI2CjWLtbtkZIxOh1QFju5kE+SMgjwcYEKszgRgDwuKsRbv1cF7rzYw4zBWsfnYO6K1a8gnwXqTGHpsJgFgSXzsdgOoyZghxTOSsygouvAxWHtxlN4rfFO0qcyKk8n91D8XQ1GEcr3IV8ReWa72E4IH0DoB/qD0YHz8PshDe+8dQ3+j8J1HBXrz+hkun5AR/jrsbbM1HjGMsfAR8ZTlrUED5H/n8kJwLIVv1RrywiNSyxziinHmttQCl/BORngLd6LZQ2ZzSInJ6e++AMyoPH/yw8VCgAAAABJRU5ErkJggg==>

[image12]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFwAAAAYCAYAAAB3JpoiAAADSklEQVR4Xu2YS8hNURTHl0fyTAbeqa88UhKJkYHk/QxRokT0hYmBkpBHZEJCxEREmBiIJI8BRiRhgoGJDETej8h7/e86x7fv/+59zzn3Ht+Nzq9Wt/Nfa7/OPnvtva9IQUHB32UICxmZzEJBmF8s1EAHtXcs/ivcV/ss9iJie1MWkR/P1XqS9lLK206ymLlqd5znRjJI7ZZY/66SLwgPKG+WqL1gUazNMR7tJ2nNah9IQ1xv0lqbcVL+3kbSs5f2YkF32ZEjqL8PabPV1pI2Qix2L+ld1I6Ttlxsdaahk9g48wZ9XUXaV7WbpJWxTqzgDHbkRD/xz7ovdZ0Vi+1B+gSxCWJ89YY4rfZWKie+VnqJtY9fl8uRHuS9hAPmqe12nvHydqktczR8OdvUDql1dvQYfJmYdWYlC2L98PVluFobFsVip7OYwAG172LLvx42i7+vR8Wv/yE0yGFqO9T2iPnPqW2NfBfFlvMCadkopoq/nh9qJ1kMgPKITwsm8hKLKdkg1t4sdqQkXo3MQfHrJeL8fZsdyqfo95hYzKQWV6mT0PDiXaCN9mjbSfOBzROx7opK4pHaExYzgtWKdlezI4Eb4n+x+8T0/uwA68WcM9kh9gUA+DklIE1wY6MijZc+NDcFhcDkIbY7O6oQl8mDaWJ1bWRHgFPibxspC7p3k66Wv2Pg3+nR+IRwPdIZaEtZ9IA4X/lqXJDsZULghIR0hr0oDaEcfkT8eomkQfYV83clHRo2StbOkwZ8sT4Qh80sCw/VXrOYkSlibW9hRwJjxcqlPqW0E3PcY4fDYaksPDDSOjragEjrFj27t0DoJ5xnH3Hns+Rv8EVsgLUQ5+4V7MgAyuMk5/JRAh8BLhcosIgdDvBjUC6+/L3J0a6ITWYMch3XwTwQK99EehIoM4fFBJCjUQ6nqnrBCcldldi/KsaBwSF3YxZeiV0GQksZheeT9lj8p5pvYvFDSW+KdGa/2EkIFyD0A/3B14F6eH8I4as3BI63GCfO9HmC/6MwjjNi/ZlY7m4M6AjfHutlodozFgO0lcb/79KqrFF7ymKdYBLzuqb/l2A5x5tqvYxXu8ZiQSVZcm4IpIf4FlyQAHbxwSxmZDELBQUFjeI3Do3mco2PnT8AAAAASUVORK5CYII=>

[image13]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAZCAYAAAAFbs/PAAAAiklEQVR4XmNgGAXDAswG4v9AfABK16HIooFfQHwBTQykyRHK/o0scYMBIokOQGIgg0BgN7rEc2QBKPjHAJEzB+JomKADVNAdJoAEHjFA5FBsX40ugASuMUDkJJEFG6CC2MBFBhxyIEFVNLF7QLwWKgcCfUhyDEJA/JcB4d4ZSHL3oWLxSGKjgLoAACgOJkiAxK1GAAAAAElFTkSuQmCC>

[image14]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAYCAYAAADOMhxqAAAAxElEQVR4XtWQOwoCQRBE21gMDTT2GIIopt5FMDEQBDMxVQ/hKfwlnkED76AY+atiZ4fZ2lmN90FB82a6Z2izUlFDlshID2JskIWrW8gnOMsxRtri2DAR5zmrsKRhppKskapKSxoqKkn61zrScfUzqHPskIYljQwv3zM3AnoWn8TGqUqyV+HYIg+VpGjXb+SmkpxUODhopbKPXFSCoRW8fERelt01F8DLzcB50ilXVzNzfxqhaENR+P+uyl8cVPxjoKJkfAEDOycZaGYRWwAAAABJRU5ErkJggg==>

[image15]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAYCAYAAADKx8xXAAAAmElEQVR4XmNgGDlgMxD/JwHDAYgThiwAFUNRBAQayGJCDBAbkQETA0TBBTRxEHgEY2wFYkYkCRAoYIBo9EcTZwPiPhgnH0kCBt4zYDoTBASAWBxdEBlg8x9BwMwA0XQGXYIQKGeAaPRGlyAEPjOQ4UwQIMt/oOAmy3+zGSAaE9DEsYIgIP7GAIm7t1AM8ucvBjKcPAoGBAAAiastbKanIo0AAAAASUVORK5CYII=>

[image16]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAYCAYAAAD+vg1LAAAAx0lEQVR4XmNgGAX0ApuB+D8JGBncR+OjAJDiMCxi6IZoIIltBOL9QLwJiLWQxOFAiAHiYmTAxABReAFNHAQeIbGZGSDqGpDE4GArEDOiiRUwQDT4o4mzAXEflL0IiG8C8TogdmLA4uJ8dAEgeM+ARSEQCACxOJrYPTQ+XoAtfHEBVnQBXAAWbmfQJSgF5QwQg73RJSgFnxmIDwaSACnhSzQAJSeahO9sBojBCWjiZIEgIP7GAEm7b6EYFM6/GGgQJKNgFNAAAAA0PzdlZkYEqQAAAABJRU5ErkJggg==>

[image17]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAYCAYAAAAYl8YPAAAA1ElEQVR4Xu2TKw4CMRRFL5+gCYYtYFkHggSBZgfgcCRsAIdiGYRN8AtrQPMJISAw8F4eor0pQ6d6TnLN6fSmfTMDFKSylLxzJBN9oB9wvLEVcB4N2MlcyrBNB/LKkYXLSlIiN4KVdcnXJDNyHkMWwhXh69QlTZb/CM0riQqsaMsLKYxhZR1ecGhL1ixD3JF9xYlkjsiymHlNEVGmrz5mXlFlC1jZgDyjZRuWSk/yhH1b5290bi/8vq6W7VimomV7lqloWei/zc1DcpGcJDdJ1V8uyMMHKsk72GpRijAAAAAASUVORK5CYII=>

[image18]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAYCAYAAAAYl8YPAAAA7ElEQVR4XmNgGAXkgs1A/J8EjBeAFIRhEUPXqIFFDAUIMUBchgyYGCCaLqCJg8AjdAFksBWIGdHEChgghvmjibMBcR+aGArIRxcAgvcM2L0jAMTi6IKEALbwIgswM0AMOoMuQQ4oZ4AY5o0uAQXxDBD5b0CsjCaHAT4z4PaiHRDLQNnsDBB1rAhpTIAvvOYxoMqB2D1IfBQAinpSwguk1gddEAZmM0AUJKCJYwOpQPwBXTCIARKYoLT1FopB4faLAbd3eYD4KbogueAcErsMiU0y+MgACYYkIC4FYmsUWRLAJgZEbOOL9VFAJAAA0mNAVkiMrRoAAAAASUVORK5CYII=>

[image19]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAAXCAYAAADduLXGAAAAXUlEQVR4XmNgGAX0BpxA7AzEHkDsBcUgtguyIhDYDcT/8WBXmMJcIF4M4wDBRiCWQOKjAGs0PsgkooADAwmK7wHxAXRBXABkaiy6IDYgxQBRzIwugQuEowuMAlwAAOEOEm1iyv5jAAAAAElFTkSuQmCC>

[image20]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAYCAYAAAAVibZIAAAAzklEQVR4Xu2Uuw4BQRiFf/EGah6GUjSeQ6f2BMSlVGk8iY5CwmMIChQScTsnY2NyyK6Y0fmSr9jz75zNTDZj9ufXjOAe3jx3sOe/9C1JYTRy5grnOgihYa60qoMQVhZ56yT6eRIWTjUMIes8K/Jcg23JXlhb+tb5z5ICbMKZfVCadp4tWJZsYhmleXOFSx2Akr3/WGZp39zCuuTDR76QnLC0oyEZwxO8wKs9j4Dy+QyPsJgs8GBpV8NQWBrlsvFh6UDDEHhFbuEGHmT2JzJ3z1M31wX28VIAAAAASUVORK5CYII=>

[image21]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAYCAYAAAAVibZIAAAA60lEQVR4XmNgGAW0BvOA+BMQ/0fCH4G4D1kRuQBmINUAIwPEwLPoEpSAbAaIoV7oEpSAlwxU9joIUD08QQBk4Al0QUoAofB0QmJ3MEDUvgViPiRxDPCaAb/XQWkWBGqBmAXKVmfArwdveNYAsSOUfQ+I/yDJgfT4IPHhgJkBInkRXQIIZBlwWwYCIDlhdEEQ6GeASAaiic+Ail9AE4eBpUB8Dl1wMRD/AuK/QPyPAREEIAzig7z5HYhlYBqQgA4QH0IXpATwA/FCJL4dEpssACofrgJxAhAnA/EkIGZCVkAOQC8e8UXiKKACAABiGTxmJEORMAAAAABJRU5ErkJggg==>

[image22]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAXCAYAAAA/ZK6/AAAAVUlEQVR4XmNgGB7gP5FYEKYBBmAS6ICRASLujy6BSwMI+AJxD7ogPg0gcApdgJCGWHQBQhowwIjWwIYugQ5+A/ELIH4CxI+B+CkQvwHi2ciKRgEpAAD5NCldtboALAAAAABJRU5ErkJggg==>

[image23]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAXCAYAAAA/ZK6/AAAAv0lEQVR4XmNgGHKAB12AEHiJLkAI/EcXwAcYgXgOuiA+UADEMuiC2AAzEFcB8TcgbgNiTlRpVHACiK8AsRwDxP3sQPwaiNcgKwIBVgaIgiIoH+T+2QhpsJwmEp/hLxC/QuLnALEsEh+k4RyMYwcVQAbY+IkwjjNUABncRmL3MmDKgwVUoWwNII6EstWgchJQPhyAFIEkkoF4JRBbAfEFIP6ArAgbANkC0uiAJo4XILufIFAH4ih0QXxgEbrAEAAALhYipB29itUAAAAASUVORK5CYII=>

[image24]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAD0AAAAYCAYAAABJA/VsAAABuklEQVR4Xu2WO0sDQRSFryBaWwlWgo34FwT9ASIWtopoo/Z2NraChb2lFqIigp2VoIX4KAQLFR+RKCoIFiKI4uPezMxyc5LsjpuYXWE/OGTmzNzNnGR2d4gyMjI8aEEjRbSj8e2pqFAyJ410sYbQdLhwSAMZfwAHgHK1aWANDU2l0EI/aw5NoFJt0oSuKyy0sI8GEFabJBdoaKJCD6MBhNUmQR9rg3XE6oaxgKjQUVRTW0tGWJ+sUdam9aatJ8+nImoRejFCbcHsv+GM9aL6Os8WK6f6BWoR2pdBMvP3WLu2vcPatu35YKY/U1S6hkvVHqPS8bqGflXtDiqubWL1qr4vco1z1e8ks9Ud61RmjfUMPaHaS6xH1ZfFxkG+f0b1l1VbkPET8OoaWiN1k2jGQK6jzxJ6PePQD3ChZXvFoexFPYhbh/SQuZZ7Qp/az1nWu20HfLAeWLesPOuO9cRa0JM8OEDDA9nKGLqRdc26At+HVjK3ivsDn8n8GKlihXWPpiVOaMcqGmki7H6uJjTunlQgpyN5bclB4o31VTxcIIfGL5BDyr/kBg1Pmineez5xjsnsgkMcyMjw5wca/oGq7J2dXgAAAABJRU5ErkJggg==>

[image25]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAE4AAAAYCAYAAABUfcv3AAACEUlEQVR4Xu2YzysFURTHD/m1kLLzI1E2FvgHLLCwkR/Zs1EKJQvZ2liR/MhKWCkpC7JiZWVjLxvZ+FkkEguEc5p7vTNn7ntz3/ToNuZT394933PfdM9p3sy9DyAhISHBR740HKJBGjZ8WapcfwE5MeQLWN7EtjQcgtYv2YdgjU2+GQqdlOSB5/eq+El5pD49yQJXG0d1rAvvAlWixks8YSJd44hu1JzwZkUchquNG0fVSFPRiWqWpiRT44hjEWeaa8LVxj1Ig3ElDRNhjRsQcaa5JlxrXAVqAbw6RkVOY1VjWOM4ragdaYbgSuNKUS+oTVQxagVVD17tXWxeIeqGxWnJpnFRoMZthGjxZ/bv0AZejZUqpudbtRpTQyPV/xeNywZayxnqUI0fUQfg3QVR10nfm2TxHRsTlO8RXiguNa4N/G86Wlcji9/Y2JZ5CNbHY9qg87vRGpcady1iua5srqU5heB1+P5tBoJ5K1xqHGcIcrMu2nfy6wyjqlhMuRYWW6MbVyQTOSJq4+iZtiXNiFB9+gSk35i1ym9XsTXvqFvUJXhHDdr03aNW+aQcMCYNS6goeQg/QtWhPoVvwy6kbhLStD8dH0w/U+1NoSZ4IgvWpBEn6C41NU5zDtH+rhqB1P4tViyjXlHP6vMDNeibAdABFgfwNFidQeMIPdDprEn084Qle9L4L/CHe5nIJSTEkG8mAo/9KYwPJgAAAABJRU5ErkJggg==>