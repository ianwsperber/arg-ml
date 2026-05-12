/**
 * Pass 2: Inline annotation. Given the Pass 1 head and the original markdown,
 * produce the <body>. The head is passed verbatim so the LLM uses only
 * declared term ids and a consistent identifier scheme.
 */

export interface Pass2Input {
  markdown: string;
  head: string;
  style: "minimal" | "standard" | "aggressive";
  postId: string;
}

export function buildPass2UserMessage(input: Pass2Input): string {
  return `PASS 2 — inline annotation.

You are completing a partially-converted ArgML document. The <head> block has already been produced (below). Your job is to produce the <body> by walking the markdown source and wrapping spans with <claim>, <inference>, <conflict>, <argument>, and <term> elements.

CRITICAL CONSTRAINTS:
  - VERBATIM. The prose inside <body>, with all ArgML tags stripped, MUST equal the markdown source's readable text. Do not edit, paraphrase, summarize, or insert prose.
  - IDS. Use ONLY the term ids declared in the head. Do not invent new terms in the body. If the source mentions a term that isn't in the head, leave it unmarked.
  - CLAIM IDS. Use the convention "C<section>.<n>" (e.g. C1.1, C3.4, C7.2). Number sequentially within sections.
  - SUPPORTS / ATTACKS. Set these attributes when the inferential structure is explicit in the prose; do not invent.
  - MODES. Set mode="supposed" for hypothetical premises, mode="attributed" for ascribed claims (with attributedTo=), mode="anticipated-objection" for objections about to be refuted, mode="conceded" for granted points, mode="reductio-target" for absurd consequences.
  - ARGUMENT BLOCKS. Wrap a multi-paragraph rhetorical unit (a thought experiment, a case study, a quoted argument) in <argument mode="..."> when it functions as one unit supporting a claim.
  - HEADINGS. Translate "# Title" to <heading level="1">Title</heading>, "## Sub" to <heading level="2">Sub</heading>, etc. Wrap a section's contents in <section> when the post has clear section structure.

Return ONLY the <body> element — NO <?xml?>, NO <post>, NO <head>. Just from opening <body> through closing </body>.

POST ID: ${input.postId}

HEAD (use these term ids):
---HEAD---
${input.head}
---END HEAD---

SOURCE MARKDOWN (preserve prose verbatim):
---SOURCE---
${input.markdown}
---END SOURCE---`;
}
