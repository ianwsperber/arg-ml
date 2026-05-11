import type {
  AssumptionsNode,
  BlockOrInline,
  ImportsNode,
  MetadataNode,
  NodeBase,
  TermsNode,
} from "./nodes.js";

export interface HeadNode extends NodeBase {
  kind: "head";
  metadata: MetadataNode;
  imports?: ImportsNode;
  terms?: TermsNode;
  assumptions?: AssumptionsNode;
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
