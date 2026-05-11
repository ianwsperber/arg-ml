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
  | { kind: "numeric"; value: number };

export type CredenceValue = BucketOrNumericValue;
export type StrengthValue = BucketOrNumericValue;

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
}

export interface AssumptionsNode extends NodeBase {
  kind: "assumptions";
  assumptions: AssumptionNode[];
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

export type BlockOrInline = SectionNode | ParagraphNode | InlineNode;
