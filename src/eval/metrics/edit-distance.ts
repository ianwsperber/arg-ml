/**
 * Normalized token-level Levenshtein on the <head> AST. Captures how close
 * the LLM-produced head is to the gold head: term ids, aliases, assumption
 * ids, imports, takeaway refs.
 *
 * The score is in [0, 1] where 0 = identical and 1 = entirely different.
 */

import type { ArgMLDocument, HeadNode } from "../../ast/index.js";

export function headEditDistance(actual: ArgMLDocument, gold: ArgMLDocument): number {
  const a = serializeHead(actual.head);
  const g = serializeHead(gold.head);
  if (a.length === 0 && g.length === 0) return 0;
  const d = levenshtein(a, g);
  return d / Math.max(a.length, g.length);
}

function serializeHead(h: HeadNode): string[] {
  const tokens: string[] = [];
  if (h.metadata.title) tokens.push(`title:${h.metadata.title}`);
  for (const a of h.metadata.authors) tokens.push(`author:${a}`);
  if (h.imports) {
    for (const imp of h.imports.imports) tokens.push(`import:${imp.prefix}=${imp.doc}`);
  }
  if (h.terms) {
    for (const t of h.terms.terms) {
      tokens.push(`term:${t.id}`);
      if (t.canonical) tokens.push(`term-canon:${t.id}:${t.canonical}`);
      for (const al of t.aliases) tokens.push(`alias:${t.id}:${al.text}`);
    }
  }
  if (h.assumptions) {
    for (const a of h.assumptions.assumptions) tokens.push(`assumption:${a.id}`);
  }
  if (h.takeaways) {
    for (const tk of h.takeaways.takeaways) tokens.push(`takeaway:${tk.ref}`);
  }
  return tokens;
}

function levenshtein(a: readonly string[], b: readonly string[]): number {
  const n = a.length;
  const m = b.length;
  if (n === 0) return m;
  if (m === 0) return n;
  let prev = new Array<number>(m + 1);
  let curr = new Array<number>(m + 1);
  for (let j = 0; j <= m; j++) prev[j] = j;
  for (let i = 1; i <= n; i++) {
    curr[0] = i;
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min((prev[j] ?? 0) + 1, (curr[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[m] ?? 0;
}
