/**
 * Whitespace and punctuation normalization shared by the markdown-to-text
 * extractor and the ArgML tag-stripper. Both produce a sequence of plain text
 * tokens; the verbatim check compares them at the token level so that
 * differences in `<p>` wrapping, indentation, or curly-vs-straight quotes do
 * not register as prose divergence.
 */

const QUOTE_TABLE: Record<string, string> = {
  "‘": "'",
  "’": "'",
  "‚": "'",
  "‛": "'",
  "“": '"',
  "”": '"',
  "„": '"',
  "«": '"',
  "»": '"',
};

const DASH_TABLE: Record<string, string> = {
  "–": "-",
  "—": "-",
  "−": "-",
};

const ELLIPSIS = /…/g;
const NBSP = / /g;
const ZERO_WIDTH = /​|‌|‍|﻿/g;

export interface NormalizeOptions {
  /** When true, collapse all runs of whitespace (including newlines) to a
   * single space. Used for token-level comparison. */
  collapseAll?: boolean;
}

/** Canonicalize a string so two prose forms can be compared for equivalence. */
export function normalizeProse(input: string, opts: NormalizeOptions = {}): string {
  let out = input.replace(/\r\n?/g, "\n").replace(NBSP, " ").replace(ZERO_WIDTH, "");

  out = out.replace(/[‘’‚‛“”„«»]/g, (c) => (QUOTE_TABLE[c] !== undefined ? QUOTE_TABLE[c] : c));
  out = out.replace(/[–—−]/g, (c) => (DASH_TABLE[c] !== undefined ? DASH_TABLE[c] : c));
  out = out.replace(ELLIPSIS, "...");

  if (opts.collapseAll) {
    out = out.replace(/\s+/g, " ").trim();
  } else {
    out = out
      .split(/\n{2,}/)
      .map((para) =>
        para
          .replace(/[ \t]+/g, " ")
          .replace(/[ \t]*\n[ \t]*/g, " ")
          .trim(),
      )
      .filter((p) => p.length > 0)
      .join("\n\n");
  }
  return out;
}

/** Tokenize a normalized string into a flat array of "words" for diff. */
export function tokenize(input: string): string[] {
  const collapsed = normalizeProse(input, { collapseAll: true });
  if (collapsed.length === 0) return [];
  return collapsed.split(" ");
}
