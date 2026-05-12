/**
 * Pass 1: Concept extraction. Reads the full Markdown source and proposes the
 * <head> block: terms, aliases, assumptions, imports, takeaways, epistemic
 * status. Pass 2 then receives this head verbatim and produces the body.
 *
 * Returns the user-message content (Anthropic Messages API). The system
 * prompt is constant and lives in system.ts.
 */

export interface Pass1Input {
  markdown: string;
  style: "minimal" | "standard" | "aggressive";
  /** Title from ingest metadata, when known. */
  title?: string | undefined;
  /** Author from ingest metadata, when known. */
  author?: string | undefined;
  /** Source URL from ingest, when known. */
  sourceUrl?: string | undefined;
}

export function buildPass1UserMessage(input: Pass1Input): string {
  const styleGuidance =
    input.style === "minimal"
      ? "Mark sparingly. Only declare terms that recur 3+ times or carry obvious technical weight."
      : input.style === "aggressive"
        ? "Mark generously. Declare all plausibly-technical terms and any phrase the author hedges on."
        : "Mark moderately. Declare terms that recur or carry technical weight; declare assumptions only when the author explicitly signals them.";

  const meta: string[] = [];
  if (input.title) meta.push(`Title: ${input.title}`);
  if (input.author) meta.push(`Author: ${input.author}`);
  if (input.sourceUrl) meta.push(`Source URL: ${input.sourceUrl}`);

  return `PASS 1 — concept extraction.

${meta.length > 0 ? `Post metadata:\n${meta.map((m) => `  ${m}`).join("\n")}\n\n` : ""}Style: ${input.style}. ${styleGuidance}

Read the entire post. Identify:
  1. Recurring or technical terms. For each, propose an id (kebab-case), list aliases as they appear in the post, propose a canonical URL ONLY if you're confident (SEP for philosophy terms), otherwise set scope="local" with a <gloss>.
  2. Assumptions the author treats as foundational (signalled by "suppose", "assume", "let us grant", "I take for granted").
  3. Cross-references to other posts. If the post is responding to or building on another post, declare an <import prefix="..."> with the URL. Use a meaningful prefix.
  4. The document's overall epistemic-status if signalled.
  5. Provenance: declare a single <generator id="llm1" type="llm" model="${"$"}{MODEL}" date="${"$"}{DATE}" role="extractor"/>.

Return ONLY the <head> block — NO <?xml?>, NO <post>, NO <body>. Just the opening <head> through the closing </head>.

Source markdown follows. Read it carefully.

---SOURCE---
${input.markdown}
---END SOURCE---`;
}
