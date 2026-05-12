/**
 * Single-pass prompt. Used with --single-pass for fast iteration during
 * prompt development. Lower quality than the two-pass strategy on real posts.
 */

export interface SinglePassInput {
  markdown: string;
  style: "minimal" | "standard" | "aggressive";
  postId: string;
  title?: string | undefined;
  author?: string | undefined;
  sourceUrl?: string | undefined;
}

export function buildSinglePassUserMessage(input: SinglePassInput): string {
  const meta: string[] = [];
  if (input.title) meta.push(`Title: ${input.title}`);
  if (input.author) meta.push(`Author: ${input.author}`);
  if (input.sourceUrl) meta.push(`Source URL: ${input.sourceUrl}`);
  return `SINGLE-PASS conversion.

${meta.length > 0 ? `Post metadata:\n${meta.map((m) => `  ${m}`).join("\n")}\n\n` : ""}Produce a complete ArgML document (one shot — head + body) from the markdown below.

Style: ${input.style}. Mark conservatively. Prose must be verbatim. Use post id="${input.postId}".

Return ONE complete XML document: <?xml?> through </post>.

---SOURCE---
${input.markdown}
---END SOURCE---`;
}
