/**
 * Walk an ArgML `<body>` and emit the readable text content — the bytes a
 * reader would see with all ArgML structural elements removed. The output is
 * the right-hand side of the verbatim comparison.
 *
 * Block elements (`<p>`, `<heading>`, `<section>`, `<argument>`) produce a
 * blank line between their text. Inline elements (`<claim>`, `<term>`,
 * `<inference>`, `<evidence>`, `<note>`, `<conflict>`) contribute their inner
 * text inline.
 *
 * Inference warrants (the prose inside `<inference>`) appear inline — they are
 * authored prose, not metadata.
 *
 * `<conflict>` carries a `<response>` child but no direct prose. Its response
 * children flow inline.
 */

import type {
  ArgMLDocument,
  BlockOrInline,
  BodyNode,
  ClaimNode,
  ConflictNode,
  EvidenceNode,
  InferenceNode,
  InlineNode,
  NoteNode,
  ParagraphNode,
  TermRefNode,
} from "../ast/index.js";

export function stripArgMLBody(doc: ArgMLDocument): string {
  const out: string[] = [];
  emitBlocks(doc.body.children, out);
  return out.join("");
}

/** Exported for tests on synthesized bodies. */
export function stripBody(body: BodyNode): string {
  const out: string[] = [];
  emitBlocks(body.children, out);
  return out.join("");
}

function emitBlocks(children: BlockOrInline[], out: string[]): void {
  for (const child of children) {
    emitBlock(child, out);
  }
}

function emitBlock(node: BlockOrInline, out: string[]): void {
  switch (node.kind) {
    case "section":
      if (node.heading) {
        emitInlines(node.heading.children, out);
        out.push("\n\n");
      }
      emitBlocks(node.children, out);
      return;
    case "argument":
      emitBlocks(node.children, out);
      return;
    case "p":
      emitParagraph(node, out);
      return;
    // Inline elements appearing at block level (rare but possible): flow inline.
    case "text":
    case "term-ref":
    case "claim":
    case "inference":
    case "conflict":
    case "evidence":
    case "note":
      emitInline(node, out);
      return;
  }
}

function emitParagraph(p: ParagraphNode, out: string[]): void {
  emitInlines(p.children, out);
  out.push("\n\n");
}

function emitInlines(children: InlineNode[], out: string[]): void {
  for (const child of children) {
    emitInline(child, out);
  }
}

function emitInline(node: InlineNode, out: string[]): void {
  switch (node.kind) {
    case "text":
      out.push(node.text);
      return;
    case "term-ref":
      emitInlines((node as TermRefNode).children, out);
      return;
    case "claim":
      emitInlines((node as ClaimNode).children, out);
      return;
    case "inference":
      emitInlines((node as InferenceNode).warrant, out);
      return;
    case "conflict": {
      const conflict = node as ConflictNode;
      if (conflict.response) {
        emitBlocks(conflict.response.children, out);
      }
      return;
    }
    case "evidence": {
      const ev = node as EvidenceNode;
      if (ev.gloss) out.push(ev.gloss.text);
      return;
    }
    case "note":
      out.push((node as NoteNode).text);
      return;
  }
}
