/**
 * Reduce a Markdown source to its readable text content — the bytes a sighted
 * reader would see, with formatting marks and structural noise removed.
 *
 * This is a *lossy* projection used only for verbatim comparison. It is NOT a
 * Markdown renderer. The shape is intentionally narrow: it must produce the
 * same plain-text stream that the ArgML tag-stripper produces from a faithful
 * conversion of the same source, so the comparator can detect prose edits.
 *
 * Rules:
 *   - Fenced code blocks (``` … ```) are preserved verbatim (text content).
 *   - ATX headings: `# Heading` → `Heading`.
 *   - Setext headings: text line is kept; the `===`/`---` underline is dropped.
 *   - List bullets and ordered-list numbers are dropped; item text is kept.
 *   - Blockquote `>` markers are dropped; nested text is kept.
 *   - Horizontal rules are dropped.
 *   - Inline emphasis (`**`, `*`, `_`, `__`, `~~`) marks are dropped; text is kept.
 *   - Inline code (`` `code` ``) keeps the inner text only.
 *   - Links `[text](url)` → `text`; reference-style links unwrap to `text` and
 *     drop reference definitions entirely.
 *   - Images `![alt](url)` → `alt`.
 *   - HTML comments (`<!-- … -->`) are dropped.
 *   - Raw HTML tags are stripped down to their text content (best effort).
 *   - Footnote markers `[^1]` are dropped; footnote bodies are kept inline at
 *     the point of definition.
 */

export function markdownToText(md: string): string {
  let s = md.replace(/\r\n?/g, "\n");

  // 1. Strip HTML comments (across lines).
  s = s.replace(/<!--[\s\S]*?-->/g, "");

  // 2. Preserve fenced code block content; drop the fences.
  s = s.replace(
    /^([ \t]*)(```+|~~~+)([^\n]*)\n([\s\S]*?)\n\1\2[ \t]*$/gm,
    (_m, _i, _f, _info, code) => code,
  );

  // 3. Reference link definitions: `[id]: url "title"` — drop entirely.
  s = s.replace(/^[ \t]*\[[^\]]+\]:[ \t]+\S+(?:[ \t]+["'(].*?["')])?[ \t]*$/gm, "");

  // 4. Setext heading underlines (==== or ---- on a line by themselves following a text line).
  s = s.replace(/^([^\n]+)\n(=+|-+)[ \t]*$/gm, "$1");

  // 5. Horizontal rules.
  s = s.replace(/^[ \t]*(?:[-*_][ \t]*){3,}[ \t]*$/gm, "");

  // Line-by-line: strip ATX heading hashes, blockquote markers, list bullets.
  s = s
    .split("\n")
    .map((line) => {
      // ATX heading: `## Foo` → `Foo`
      const atx = /^[ \t]{0,3}(#{1,6})[ \t]+(.*?)[ \t]*#*[ \t]*$/.exec(line);
      if (atx) return atx[2] ?? "";
      // Blockquote: `> foo` (possibly nested `> > foo`)
      const bq = /^[ \t]*(?:>[ \t]?)+(.*)$/.exec(line);
      if (bq) return bq[1] ?? "";
      // Unordered list item: `- foo`, `* foo`, `+ foo`
      const ul = /^[ \t]*[-*+][ \t]+(.*)$/.exec(line);
      if (ul) return ul[1] ?? "";
      // Ordered list item: `1. foo`
      const ol = /^[ \t]*\d+[.)][ \t]+(.*)$/.exec(line);
      if (ol) return ol[1] ?? "";
      return line;
    })
    .join("\n");

  // Inline transformations.
  // Footnote references: `[^id]` — drop.
  s = s.replace(/\[\^[^\]]+\]/g, "");
  // Images: `![alt](url)` → `alt`.
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  // Links inline: `[text](url)` → `text`.
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  // Links reference-style: `[text][id]` → `text`.
  s = s.replace(/\[([^\]]+)\]\[[^\]]*\]/g, "$1");
  // Bare autolinks: `<https://example.com>` → `https://example.com`.
  s = s.replace(/<((?:https?|mailto):[^>]+)>/g, "$1");
  // Inline code: `` `code` `` → `code` (and handle ``code with `backtick` inside``).
  s = s.replace(/(`+)([\s\S]*?)\1/g, "$2");
  // Emphasis/strong/strikethrough — drop the marks.
  // Order matters: longer markers first.
  s = s.replace(/\*\*\*([\s\S]+?)\*\*\*/g, "$1");
  s = s.replace(/___([\s\S]+?)___/g, "$1");
  s = s.replace(/\*\*([\s\S]+?)\*\*/g, "$1");
  s = s.replace(/__([\s\S]+?)__/g, "$1");
  s = s.replace(/(?<!\w)\*([^*\n]+?)\*(?!\w)/g, "$1");
  s = s.replace(/(?<!\w)_([^_\n]+?)_(?!\w)/g, "$1");
  s = s.replace(/~~([\s\S]+?)~~/g, "$1");

  // Strip raw HTML tags (keep their text content). Done last so links inside
  // tags are already processed.
  s = s.replace(/<\/?[A-Za-z][^<>]*>/g, "");

  return s;
}
