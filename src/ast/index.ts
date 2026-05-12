export type { SourcePosition } from "./position.js";
export {
  ARGUMENT_MODES,
  CLAIM_MODES,
  INFERENCE_PATTERNS,
} from "./nodes.js";
export type {
  AliasNode,
  ArgumentMode,
  ArgumentNode,
  AssumptionNode,
  AssumptionsNode,
  AttackerRef,
  AttackType,
  BlockOrInline,
  BucketOrNumericValue,
  ClaimMode,
  ClaimNode,
  ConflictNode,
  CredenceBucket,
  CredenceValue,
  EvidenceNode,
  GeneratorNode,
  GlossNode,
  HeadingNode,
  ImportNode,
  ImportsNode,
  InferenceNode,
  InferencePattern,
  InlineNode,
  MetadataNode,
  NodeBase,
  NoteNode,
  ParagraphNode,
  ProvenanceNode,
  ResponseNode,
  SectionNode,
  StrengthBucket,
  StrengthValue,
  TakeawayNode,
  TakeawaysNode,
  TargetRef,
  TermDeclaration,
  TermRefNode,
  TermsNode,
  TextNode,
} from "./nodes.js";
export type { ArgMLDocument, BodyNode, HeadNode } from "./document.js";
export { ATTITUDE_KINDS } from "./overlay.js";
export type {
  AttitudeKind,
  AttitudeNode,
  ReaderOverlayDocument,
  SubstitutionNode,
} from "./overlay.js";

import type { ArgMLDocument } from "./document.js";
import type { ReaderOverlayDocument } from "./overlay.js";

/** Discriminated union of the two top-level document types (spec §4, §13). */
export type ParsedDocument = ArgMLDocument | ReaderOverlayDocument;
