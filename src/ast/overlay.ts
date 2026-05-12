import type {
  AttackType,
  BucketOrNumericValue,
  ImportsNode,
  InlineNode,
  NodeBase,
} from "./nodes.js";

/** Reader's stance toward a target element (spec §13.3). */
export type AttitudeKind = "accept" | "reject" | "open";

export const ATTITUDE_KINDS: readonly AttitudeKind[] = ["accept", "reject", "open"];

export interface AttitudeNode extends NodeBase {
  kind: "attitude";
  /** `prefix:id` cross-document reference to a claim, assumption, inference,
   * or argument in an imported post. */
  target: string;
  attitudeKind: AttitudeKind;
  /** Required when `attitudeKind === "reject"`. Mirrors `<conflict attack-type>`. */
  rejectionType?: AttackType;
  /** Reader's credence on the target (spec §12.2 vocabulary). */
  credence?: BucketOrNumericValue;
  /** Reader's note. Spec §13.3: text content is not parsed for graph structure
   * but is preserved as inline children for round-trip fidelity. */
  note: InlineNode[];
}

export interface SubstitutionNode extends NodeBase {
  kind: "substitution";
  /** `prefix:id` reference to the element being replaced. */
  target: string;
  /** `prefix:id` reference to the replacement. */
  use: string;
  /** Reader's note explaining the substitution. */
  note: InlineNode[];
}

export interface ReaderOverlayDocument extends NodeBase {
  kind: "reader-overlay";
  reader: string;
  /** ISO 8601 date. */
  updated?: string;
  imports: ImportsNode;
  attitudes: AttitudeNode[];
  substitutions: SubstitutionNode[];
}
