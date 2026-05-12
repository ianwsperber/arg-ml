/**
 * Unsupervised quality metrics — computable without a gold standard.
 * Captures conservatism, coverage of hedge-language signals, validator pass,
 * verbatim pass. Used to compare prompt iterations even before gold corpus
 * has grown.
 */

import type {
  ArgMLDocument,
  BlockOrInline,
  ClaimNode,
  InferenceNode,
  InlineNode,
  TermRefNode,
} from "../../ast/index.js";

export interface StructuralCounts {
  terms: number;
  claims: number;
  inferences: number;
  conflicts: number;
  assumptions: number;
  arguments: number;
  takeaways: number;
}

export interface ConservatismMetrics {
  termsPer1kWords: number;
  claimsPer1kWords: number;
  inferencesPer1kWords: number;
}

export interface CoverageMetrics {
  /** Fraction of claims that have a `credence` attribute. */
  claimsWithCredence: number;
  /** Fraction of inferences that have a `strength` attribute. */
  inferencesWithStrength: number;
  /** Fraction of hedge-language matches that landed on a tagged claim. */
  credenceSignalCoverage: number;
}

const HEDGES = [
  /\bI suspect\b/i,
  /\bperhaps\b/i,
  /\bI think\b/i,
  /\bI believe\b/i,
  /\bI hold that\b/i,
  /\bI will defend\b/i,
  /\bI am confident\b/i,
  /\bclearly,?\b/i,
  /\bobviously\b/i,
];

export function structuralCounts(doc: ArgMLDocument): StructuralCounts {
  const c: StructuralCounts = {
    terms: doc.head.terms?.terms.length ?? 0,
    claims: 0,
    inferences: 0,
    conflicts: 0,
    assumptions: doc.head.assumptions?.assumptions.length ?? 0,
    arguments: 0,
    takeaways: doc.head.takeaways?.takeaways.length ?? 0,
  };
  walkBlocks(doc.body.children, c);
  return c;
}

export function conservatism(doc: ArgMLDocument, source: string): ConservatismMetrics {
  const words = countWords(source);
  const counts = structuralCounts(doc);
  const per1k = (n: number): number => (words === 0 ? 0 : (n / words) * 1000);
  return {
    termsPer1kWords: per1k(counts.terms),
    claimsPer1kWords: per1k(counts.claims),
    inferencesPer1kWords: per1k(counts.inferences),
  };
}

export function coverage(doc: ArgMLDocument, source: string): CoverageMetrics {
  const claims = collectClaims(doc);
  const infs = collectInferences(doc);
  const claimsWithCredence =
    claims.length === 0 ? 0 : claims.filter((c) => c.credence !== undefined).length / claims.length;
  const inferencesWithStrength =
    infs.length === 0 ? 0 : infs.filter((i) => i.strength !== undefined).length / infs.length;

  const hedgeMatches = countHedgeMatches(source);
  const credencedClaims = claims.filter((c) => c.credence !== undefined).length;
  const credenceSignalCoverage =
    hedgeMatches === 0 ? 0 : Math.min(1, credencedClaims / hedgeMatches);

  return { claimsWithCredence, inferencesWithStrength, credenceSignalCoverage };
}

function countWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function countHedgeMatches(s: string): number {
  let n = 0;
  for (const re of HEDGES) {
    const m = s.match(new RegExp(re.source, "gi"));
    if (m) n += m.length;
  }
  return n;
}

function walkBlocks(children: BlockOrInline[], c: StructuralCounts): void {
  for (const child of children) {
    if (child.kind === "section") {
      if (child.heading) walkInlines(child.heading.children, c);
      walkBlocks(child.children, c);
    } else if (child.kind === "argument") {
      c.arguments++;
      walkBlocks(child.children, c);
    } else if (child.kind === "p") {
      walkInlines(child.children, c);
    } else walkInline(child as InlineNode, c);
  }
}

function walkInlines(children: InlineNode[], c: StructuralCounts): void {
  for (const x of children) walkInline(x, c);
}

function walkInline(node: InlineNode, c: StructuralCounts): void {
  switch (node.kind) {
    case "claim":
      c.claims++;
      walkInlines((node as ClaimNode).children, c);
      return;
    case "inference":
      c.inferences++;
      walkInlines((node as InferenceNode).warrant, c);
      return;
    case "conflict":
      c.conflicts++;
      return;
    case "term-ref":
      walkInlines((node as TermRefNode).children, c);
      return;
    case "text":
    case "evidence":
    case "note":
      return;
  }
}

function collectClaims(doc: ArgMLDocument): ClaimNode[] {
  const out: ClaimNode[] = [];
  const visitInline = (children: InlineNode[]): void => {
    for (const i of children) {
      if (i.kind === "claim") {
        out.push(i);
        visitInline(i.children);
      } else if (i.kind === "term-ref") visitInline(i.children);
    }
  };
  const visit = (children: BlockOrInline[]): void => {
    for (const c of children) {
      if (c.kind === "section") {
        if (c.heading) visitInline(c.heading.children);
        visit(c.children);
      } else if (c.kind === "argument") visit(c.children);
      else if (c.kind === "p") visitInline(c.children);
    }
  };
  visit(doc.body.children);
  return out;
}

function collectInferences(doc: ArgMLDocument): InferenceNode[] {
  const out: InferenceNode[] = [];
  const visit = (children: BlockOrInline[]): void => {
    for (const c of children) {
      if (c.kind === "section") {
        visit(c.children);
      } else if (c.kind === "argument") visit(c.children);
      else if (c.kind === "p") {
        for (const i of c.children) if (i.kind === "inference") out.push(i);
      }
    }
  };
  visit(doc.body.children);
  return out;
}
