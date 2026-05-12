/**
 * Verbatim check: assert that an ArgML document's body, with all tags
 * stripped, is token-equivalent to the original markdown source's readable
 * text.
 *
 * The user's hard requirement: conversion is *annotation, not translation* —
 * the LLM may not edit, paraphrase, summarize, omit, or insert prose. This
 * check is the enforcement mechanism. Any divergence is a hard failure.
 *
 * Equivalence allows:
 *   - Whitespace differences (collapsed by `normalizeProse`).
 *   - Smart-vs-straight quotes, en/em dashes, ellipses (normalized).
 *   - Markdown structural marks (heading hashes, list bullets, fences,
 *     emphasis chars, link syntax) stripped on the source side.
 *   - Paragraph boundaries inserted or removed by the LLM (we compare on a
 *     flat token stream).
 *
 * Equivalence does NOT allow:
 *   - Inserting, removing, or reordering words.
 *   - Substituting synonyms.
 *   - Rewriting sentences.
 */

import type { ArgMLDocument } from "../ast/index.js";
import { markdownToText } from "./markdown-to-text.js";
import { normalizeProse, tokenize } from "./normalize.js";
import { stripArgMLBody } from "./strip.js";

export interface VerbatimDiagnostic {
  code: "VERBATIM001";
  severity: "error";
  message: string;
  /** Index of the first token that diverged, in the source token stream. */
  sourceTokenIndex: number;
  /** Index of the first token that diverged, in the stripped-output stream. */
  outputTokenIndex: number;
  /** 8 tokens preceding the divergence in the source. */
  sourceContext: string;
  /** 8 tokens at/after the divergence in the source. */
  sourceWindow: string;
  /** 8 tokens at/after the divergence in the stripped output. */
  outputWindow: string;
}

export interface VerbatimResult {
  ok: boolean;
  diagnostics: VerbatimDiagnostic[];
  /** Useful for tests: the normalized strings that were compared. */
  sourceText: string;
  outputText: string;
}

const CONTEXT_TOKENS = 8;

export function verbatimCheck(source: string, doc: ArgMLDocument): VerbatimResult {
  const sourceText = normalizeProse(markdownToText(source), { collapseAll: true });
  const outputText = normalizeProse(stripArgMLBody(doc), { collapseAll: true });

  const srcTokens = tokenize(sourceText);
  const outTokens = tokenize(outputText);

  const divergence = firstDivergence(srcTokens, outTokens);
  if (!divergence) {
    return { ok: true, diagnostics: [], sourceText, outputText };
  }

  const { sourceIdx, outputIdx } = divergence;
  const diagnostic: VerbatimDiagnostic = {
    code: "VERBATIM001",
    severity: "error",
    message: buildMessage(srcTokens, outTokens, sourceIdx, outputIdx),
    sourceTokenIndex: sourceIdx,
    outputTokenIndex: outputIdx,
    sourceContext: srcTokens.slice(Math.max(0, sourceIdx - CONTEXT_TOKENS), sourceIdx).join(" "),
    sourceWindow: srcTokens.slice(sourceIdx, sourceIdx + CONTEXT_TOKENS).join(" "),
    outputWindow: outTokens.slice(outputIdx, outputIdx + CONTEXT_TOKENS).join(" "),
  };
  return { ok: false, diagnostics: [diagnostic], sourceText, outputText };
}

function firstDivergence(
  a: string[],
  b: string[],
): { sourceIdx: number; outputIdx: number } | null {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) return { sourceIdx: i, outputIdx: i };
  }
  if (a.length !== b.length) {
    const idx = n;
    return { sourceIdx: idx, outputIdx: idx };
  }
  return null;
}

function buildMessage(src: string[], out: string[], srcIdx: number, outIdx: number): string {
  if (srcIdx >= src.length) {
    return `verbatim check failed: output has extra prose starting at token ${outIdx}: "${out
      .slice(outIdx, outIdx + CONTEXT_TOKENS)
      .join(" ")}"`;
  }
  if (outIdx >= out.length) {
    return `verbatim check failed: output is missing prose starting at source token ${srcIdx}: "${src
      .slice(srcIdx, srcIdx + CONTEXT_TOKENS)
      .join(" ")}"`;
  }
  return `verbatim check failed at token ${srcIdx}: source has "${src[srcIdx]}" but output has "${out[outIdx]}"`;
}
