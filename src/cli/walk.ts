import type {
  ArgMLDocument,
  AssumptionNode,
  BlockOrInline,
  ClaimNode,
  ConflictNode,
  EvidenceNode,
  InferenceNode,
  InlineNode,
  TermDeclaration,
  TermRefNode,
} from "../index.js";

export interface WalkedNodes {
  terms: TermDeclaration[];
  assumptions: AssumptionNode[];
  claims: ClaimNode[];
  inferences: InferenceNode[];
  conflicts: ConflictNode[];
  termRefs: TermRefNode[];
  evidences: EvidenceNode[];
  sections: number;
  paragraphs: number;
}

export function walkDocument(doc: ArgMLDocument): WalkedNodes {
  const out: WalkedNodes = {
    terms: doc.head.terms?.terms ?? [],
    assumptions: doc.head.assumptions?.assumptions ?? [],
    claims: [],
    inferences: [],
    conflicts: [],
    termRefs: [],
    evidences: [],
    sections: 0,
    paragraphs: 0,
  };
  for (const child of doc.body.children) {
    walkBlockOrInline(child, out);
  }
  return out;
}

function walkBlockOrInline(node: BlockOrInline, out: WalkedNodes): void {
  switch (node.kind) {
    case "section":
      out.sections += 1;
      for (const child of node.children) walkBlockOrInline(child, out);
      return;
    case "p":
      out.paragraphs += 1;
      for (const child of node.children) walkInline(child, out);
      return;
    default:
      walkInline(node, out);
  }
}

function walkInline(node: InlineNode, out: WalkedNodes): void {
  switch (node.kind) {
    case "claim":
      out.claims.push(node);
      for (const child of node.children) walkInline(child, out);
      return;
    case "inference":
      out.inferences.push(node);
      for (const child of node.warrant) walkInline(child, out);
      return;
    case "conflict":
      out.conflicts.push(node);
      if (node.response) {
        for (const child of node.response.children) walkBlockOrInline(child, out);
      }
      return;
    case "term-ref":
      out.termRefs.push(node);
      for (const child of node.children) walkInline(child, out);
      return;
    case "evidence":
      out.evidences.push(node);
      return;
    case "text":
    case "note":
      return;
  }
}
