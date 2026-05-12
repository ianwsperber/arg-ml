import type { SourcePosition } from "./position.js";

export interface NodeBase {
  pos?: SourcePosition | undefined;
}

export type AttackType = "rebut" | "undermine" | "undercut";

export type CredenceBucket =
  | "speculative"
  | "tentative"
  | "considered"
  | "confident"
  | "near-certain";

export type StrengthBucket = "weak" | "moderate" | "strong" | "deductive";

export type BucketOrNumericValue =
  | { kind: "bucket"; value: string }
  | { kind: "numeric"; value: number; raw: string };

export type CredenceValue = BucketOrNumericValue;
export type StrengthValue = BucketOrNumericValue;

/** Recommended `mode` values on `<claim>` (spec §6.7). Open vocabulary at the
 * wire level: parsers accept any string; the validator warns on unknown values. */
export type ClaimMode =
  | "asserted"
  | "supposed"
  | "attributed"
  | "restated"
  | "anticipated-objection"
  | "conceded"
  | "reductio-target";

export const CLAIM_MODES: readonly ClaimMode[] = [
  "asserted",
  "supposed",
  "attributed",
  "restated",
  "anticipated-objection",
  "conceded",
  "reductio-target",
];

/** Recommended `mode` values on `<argument>` (spec §6.8.1). Open vocabulary. */
export type ArgumentMode = "thought-experiment" | "case" | "attributed";

export const ARGUMENT_MODES: readonly ArgumentMode[] = ["thought-experiment", "case", "attributed"];

/** Recommended `pattern` values on `<inference>` (spec §10.2). Open vocabulary. */
export type InferencePattern =
  | "modus-ponens"
  | "modus-tollens"
  | "reductio-ad-absurdum"
  | "argument-by-cases"
  | "disjunctive-syllogism"
  | "hypothetical-syllogism"
  | "conjunction-of-premises"
  | "conditional-proof"
  | "universal-instantiation"
  | "existential-generalization";

export const INFERENCE_PATTERNS: readonly InferencePattern[] = [
  "modus-ponens",
  "modus-tollens",
  "reductio-ad-absurdum",
  "argument-by-cases",
  "disjunctive-syllogism",
  "hypothetical-syllogism",
  "conjunction-of-premises",
  "conditional-proof",
  "universal-instantiation",
  "existential-generalization",
];

/* Head-section nodes */

export interface MetadataNode extends NodeBase {
  kind: "metadata";
  title?: string;
  authors: string[];
  date?: string;
  source?: string;
  epistemicStatus?: string;
}

export interface ImportNode extends NodeBase {
  kind: "import";
  prefix: string;
  doc: string;
}

export interface ImportsNode extends NodeBase {
  kind: "imports";
  imports: ImportNode[];
}

export interface AliasNode extends NodeBase {
  kind: "alias";
  text: string;
}

export interface GlossNode extends NodeBase {
  kind: "gloss";
  text: string;
}

export interface TermDeclaration extends NodeBase {
  kind: "term-decl";
  id: string;
  canonical?: string;
  scope?: "local";
  gloss?: GlossNode;
  aliases: AliasNode[];
  /** Provenance generator ids declared on this term (spec §5.2). Empty when absent. */
  provenance: string[];
}

export interface TermsNode extends NodeBase {
  kind: "terms";
  terms: TermDeclaration[];
}

export interface NoteNode extends NodeBase {
  kind: "note";
  status?: string;
  text: string;
}

export interface AssumptionNode extends NodeBase {
  kind: "assumption";
  id: string;
  restsOn: string[];
  text: string;
  note?: NoteNode;
  /** Provenance generator ids (spec §5.2). Empty when absent. */
  provenance: string[];
}

export interface AssumptionsNode extends NodeBase {
  kind: "assumptions";
  assumptions: AssumptionNode[];
}

/* Provenance and generators (spec §5.2) */

export interface GeneratorNode extends NodeBase {
  kind: "generator";
  id: string;
  /** RECOMMENDED values: "human" | "llm" | "automated". Open vocabulary. */
  generatorType?: string;
  /** Required when generatorType === "human". */
  who?: string;
  /** Required when generatorType === "llm". */
  model?: string;
  /** ISO 8601 date. */
  date?: string;
  /** RECOMMENDED values: "original-author" | "extractor" | "reviewer" | "editor". */
  role?: string;
}

export interface ProvenanceNode extends NodeBase {
  kind: "provenance";
  generators: GeneratorNode[];
}

/* Takeaways (spec §5.6) */

export interface TakeawayNode extends NodeBase {
  kind: "takeaway";
  /** Identifier of the claim this takeaway points at. May be `prefix:id`, but
   * the validator restricts cross-document takeaway refs (see ARGML023). */
  ref: string;
  /** RECOMMENDED values: "primary" | "secondary" | "load-bearing". Open vocabulary. */
  priority?: string;
  /** Provenance generator ids (spec §5.2). Empty when absent. */
  provenance: string[];
}

export interface TakeawaysNode extends NodeBase {
  kind: "takeaways";
  takeaways: TakeawayNode[];
}

/* Body-section inline nodes */

export interface TextNode extends NodeBase {
  kind: "text";
  text: string;
}

export interface TermRefNode extends NodeBase {
  kind: "term-ref";
  ref: string;
  children: InlineNode[];
}

export interface EvidenceNode extends NodeBase {
  kind: "evidence";
  ref: string;
  evidenceType?: string;
  gloss?: GlossNode;
}

export interface ClaimNode extends NodeBase {
  kind: "claim";
  id: string;
  supports: string[];
  attacks: string[];
  attackType?: AttackType;
  restsOn: string[];
  via?: string;
  defeasible?: boolean;
  scheme?: string;
  credence?: CredenceValue;
  /** Speech-act / discourse status (spec §6.7). Absent ⇒ "asserted" (the 0.1
   * default). Open vocabulary at the wire level; validator warns on unknown
   * values outside `CLAIM_MODES`. */
  mode?: string;
  /** Party to whom an `attributed` claim is ascribed (spec §6.9). */
  attributedTo?: string;
  /** Identifier of a claim expressing the same proposition (spec §6.10). May be
   * a local id or a `prefix:id` cross-document reference. */
  sameAs?: string;
  /** External source URL for an `attributed` claim (spec §6.9). */
  source?: string;
  /** Provenance generator ids (spec §5.2). Empty when absent. */
  provenance: string[];
  children: InlineNode[];
}

export interface InferenceNode extends NodeBase {
  kind: "inference";
  id: string;
  from: string[];
  to: string;
  scheme?: string;
  defeasible?: boolean;
  strength?: StrengthValue;
  /** Compositional logical shape (spec §10.2). Open vocabulary at the wire
   * level; validator warns on unknown values outside `INFERENCE_PATTERNS`. */
  pattern?: string;
  /** Provenance generator ids (spec §5.2). Empty when absent. */
  provenance: string[];
  warrant: InlineNode[];
}

export interface AttackerRef extends NodeBase {
  kind: "attacker";
  idref: string;
}

export interface TargetRef extends NodeBase {
  kind: "target";
  idref: string;
}

export interface ResponseNode extends NodeBase {
  kind: "response";
  children: BlockOrInline[];
}

export interface ConflictNode extends NodeBase {
  kind: "conflict";
  id: string;
  attackType?: AttackType;
  attacker: AttackerRef;
  target: TargetRef;
  response?: ResponseNode;
  /** Provenance generator ids (spec §5.2). Empty when absent. */
  provenance: string[];
}

export type InlineNode =
  | TextNode
  | TermRefNode
  | ClaimNode
  | InferenceNode
  | ConflictNode
  | EvidenceNode
  | NoteNode;

/* Body block-level */

export interface ParagraphNode extends NodeBase {
  kind: "p";
  children: InlineNode[];
}

export interface HeadingNode extends NodeBase {
  kind: "heading";
  level: number;
  children: InlineNode[];
}

export interface SectionNode extends NodeBase {
  kind: "section";
  id?: string;
  heading?: HeadingNode;
  children: BlockOrInline[];
}

/* Argument regions (spec §6.8): a first-class graph node, supports-only.
 * Restricted to the `supports` relation; an `<argument>` cannot attack —
 * refutation requires propositional commitment and lives on `<claim>`. */
export interface ArgumentNode extends NodeBase {
  kind: "argument";
  /** Optional; required when the argument participates in the graph. */
  id?: string;
  /** Required by the spec; recommended values in `ARGUMENT_MODES`. */
  mode: string;
  supports: string[];
  restsOn: string[];
  via?: string;
  /** Required when mode === "attributed"; the party to whom the region is ascribed. */
  attributedTo?: string;
  /** Provenance generator ids (spec §5.2). Empty when absent. */
  provenance: string[];
  /** Names of forbidden attack-related attributes encountered on this
   * `<argument>` at parse time (e.g. `attacks`, `attack-type`). Spec §6.8.3
   * disallows these — refutation belongs on `<claim>`. The validator emits
   * `ARGML021` when this list is non-empty. */
  disallowedAttrs: string[];
  children: BlockOrInline[];
}

export type BlockOrInline = SectionNode | ParagraphNode | ArgumentNode | InlineNode;
