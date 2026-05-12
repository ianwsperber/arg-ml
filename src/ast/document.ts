import type {
  AssumptionsNode,
  BlockOrInline,
  ImportsNode,
  MetadataNode,
  NodeBase,
  ProvenanceNode,
  TakeawaysNode,
  TermsNode,
} from "./nodes.js";

export interface HeadNode extends NodeBase {
  kind: "head";
  metadata: MetadataNode;
  /** Spec §5.2 — declared between `<metadata>` and `<imports>`. */
  provenance?: ProvenanceNode;
  imports?: ImportsNode;
  terms?: TermsNode;
  assumptions?: AssumptionsNode;
  /** Spec §5.6 — declared after `<assumptions>`. */
  takeaways?: TakeawaysNode;
}

export interface BodyNode extends NodeBase {
  kind: "body";
  children: BlockOrInline[];
}

export interface ArgMLDocument extends NodeBase {
  kind: "post";
  id: string;
  head: HeadNode;
  body: BodyNode;
}
