/**
 * Span-level F1 over the body. Each tagged span becomes a label
 * (element-kind, normalized-text-key). Precision = |actual ∩ gold| / |actual|;
 * recall = |actual ∩ gold| / |gold|; F1 = harmonic mean.
 *
 * The text key is the trimmed/normalized inner-text of the span. We do not
 * compare attributes here (a separate metric handles those). This metric
 * answers: "did the LLM identify the right things to mark?"
 */

import type {
  ArgMLDocument,
  BlockOrInline,
  ClaimNode,
  InferenceNode,
  InlineNode,
  TermRefNode,
} from "../../ast/index.js";
import { normalizeProse } from "../../verbatim/normalize.js";

export interface F1Result {
  precision: number;
  recall: number;
  f1: number;
  matched: number;
  predicted: number;
  expected: number;
}

type SpanKind = "claim" | "term-ref" | "inference" | "conflict" | "argument";

interface Span {
  kind: SpanKind;
  textKey: string;
}

export function bodySpanF1(actual: ArgMLDocument, gold: ArgMLDocument): F1Result {
  const a = collect(actual);
  const g = collect(gold);
  const aSet = bag(a);
  const gSet = bag(g);
  let matched = 0;
  for (const [key, count] of aSet) {
    const gCount = gSet.get(key) ?? 0;
    matched += Math.min(count, gCount);
  }
  const predicted = a.length;
  const expected = g.length;
  const precision = predicted === 0 ? 0 : matched / predicted;
  const recall = expected === 0 ? 0 : matched / expected;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { precision, recall, f1, matched, predicted, expected };
}

function collect(doc: ArgMLDocument): Span[] {
  const out: Span[] = [];
  walkBlocks(doc.body.children, out);
  return out;
}

function walkBlocks(children: BlockOrInline[], out: Span[]): void {
  for (const child of children) {
    switch (child.kind) {
      case "section":
        if (child.heading) walkInlines(child.heading.children, out);
        walkBlocks(child.children, out);
        break;
      case "argument":
        out.push({ kind: "argument", textKey: textKeyOfBlocks(child.children) });
        walkBlocks(child.children, out);
        break;
      case "p":
        walkInlines(child.children, out);
        break;
      default:
        walkInline(child as InlineNode, out);
    }
  }
}

function walkInlines(children: InlineNode[], out: Span[]): void {
  for (const c of children) walkInline(c, out);
}

function walkInline(node: InlineNode, out: Span[]): void {
  switch (node.kind) {
    case "claim":
      out.push({ kind: "claim", textKey: textKeyOfInlines((node as ClaimNode).children) });
      walkInlines((node as ClaimNode).children, out);
      return;
    case "term-ref":
      out.push({ kind: "term-ref", textKey: textKeyOfInlines((node as TermRefNode).children) });
      walkInlines((node as TermRefNode).children, out);
      return;
    case "inference":
      out.push({
        kind: "inference",
        textKey: textKeyOfInlines((node as InferenceNode).warrant),
      });
      walkInlines((node as InferenceNode).warrant, out);
      return;
    case "conflict":
      out.push({ kind: "conflict", textKey: "" });
      return;
    case "evidence":
    case "note":
    case "text":
      return;
  }
}

function textKeyOfInlines(children: InlineNode[]): string {
  const buf: string[] = [];
  for (const c of children) emitText(c, buf);
  return normalizeProse(buf.join(""), { collapseAll: true });
}

function textKeyOfBlocks(children: BlockOrInline[]): string {
  const buf: string[] = [];
  for (const c of children) emitTextBlock(c, buf);
  return normalizeProse(buf.join(""), { collapseAll: true });
}

function emitText(node: InlineNode, buf: string[]): void {
  switch (node.kind) {
    case "text":
      buf.push(node.text);
      return;
    case "term-ref":
      for (const c of (node as TermRefNode).children) emitText(c, buf);
      return;
    case "claim":
      for (const c of (node as ClaimNode).children) emitText(c, buf);
      return;
    case "inference":
      for (const c of (node as InferenceNode).warrant) emitText(c, buf);
      return;
    case "note":
      buf.push(node.text);
      return;
    case "conflict":
    case "evidence":
      return;
  }
}

function emitTextBlock(node: BlockOrInline, buf: string[]): void {
  switch (node.kind) {
    case "section":
      if (node.heading) for (const c of node.heading.children) emitText(c, buf);
      for (const c of node.children) emitTextBlock(c, buf);
      return;
    case "argument":
      for (const c of node.children) emitTextBlock(c, buf);
      return;
    case "p":
      for (const c of node.children) emitText(c, buf);
      return;
    default:
      emitText(node as InlineNode, buf);
  }
}

function bag(spans: Span[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of spans) {
    const k = `${s.kind}\0${s.textKey}`;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}
