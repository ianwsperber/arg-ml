/**
 * Generic URL ingestion: fetch HTML, run Mozilla Readability via linkedom,
 * convert the extracted article HTML to markdown via Turndown.
 *
 * This is the fallback path for hosts we don't have a structured API for.
 * Quality depends entirely on Readability's heuristics; for known hosts
 * (e.g. LessWrong) prefer a dedicated extractor.
 */

import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import TurndownService from "turndown";
import type { IngestResult } from "./types.js";
import { IngestError } from "./types.js";

export async function ingestReadability(
  url: string,
  fetchImpl: typeof fetch,
): Promise<IngestResult> {
  const u = new URL(url);
  let res: Response;
  try {
    res = await fetchImpl(url, {
      headers: { "user-agent": "argml-ingest/0.1 (+https://github.com/ianwsperber/arg-ml)" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new IngestError(`fetch failed: ${msg}`, "INGEST_FETCH_FAILED");
  }
  if (!res.ok) {
    throw new IngestError(`fetch returned ${res.status}`, "INGEST_FETCH_FAILED");
  }
  const html = await res.text();
  return extractArticle(html, url, u.host);
}

/** Exported for tests that stub a fixture HTML response. */
export function extractArticle(html: string, url: string, host: string): IngestResult {
  // linkedom's parseHTML returns a Window-shaped object compatible with
  // Readability's DOM expectations.
  const dom = parseHTML(html);
  // Readability expects a Document with location-like ancestry; linkedom
  // already provides this.
  const reader = new Readability(dom.document as unknown as Document);
  const article = reader.parse();
  if (!article || !article.content) {
    throw new IngestError(`readability extracted no article from ${url}`, "INGEST_EMPTY_BODY");
  }
  const markdown = htmlToMarkdown(article.content);
  if (markdown.trim().length === 0) {
    throw new IngestError("readability produced empty markdown", "INGEST_EMPTY_BODY");
  }
  return {
    markdown,
    source: { kind: "url", url, host, extractor: "readability" },
    metadata: {
      title: article.title ?? undefined,
      author: article.byline ?? undefined,
      sourceUrl: url,
    },
  };
}

function htmlToMarkdown(html: string): string {
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "_",
  });
  // Strip footnote backlinks ("↑") and similar navigational glyphs.
  td.addRule("drop-footnote-backlinks", {
    filter: (node) => {
      const t = (node.textContent ?? "").trim();
      return t === "↑" || t === "↩" || t === "↩︎";
    },
    replacement: () => "",
  });
  return td.turndown(html);
}
