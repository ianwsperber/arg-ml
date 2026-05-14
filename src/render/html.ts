import type { ArgMLDocument } from "../ast/index.js";
import { parseReaderOverlay } from "../parser/parse.js";
import { type PropagationResult, propagate } from "../propagation/index.js";
import { ARG_RENDER_CSS, ARG_RENDER_JS } from "./assets.generated.js";
import { escapeAttr, escapeText } from "./escape.js";

/** Serializable shape of a propagation result. Maps cleanly to JSON; the
 *  client decodes it from `#argml-initial-status` to seed correct first-paint. */
export interface InitialStatusPayload {
  postPrefix: string | null;
  /** Per-takeaway: id, priority, status, and contributing ancestors. */
  takeaways: ReadonlyArray<{
    id: string;
    status: string;
    priority: string | null;
    rejectedAncestors: readonly string[];
    openAncestors: readonly string[];
    accepted: boolean;
  }>;
  /** id → status, restricted to the node ids the engine reported. */
  nodes: Readonly<Record<string, string>>;
}

function toPayload(r: PropagationResult): InitialStatusPayload {
  const nodes: Record<string, string> = {};
  for (const [id, ns] of r.nodes) nodes[id] = ns.status;
  return {
    postPrefix: r.postPrefix ?? null,
    takeaways: r.takeaways.map((t) => ({
      id: t.id,
      status: t.status,
      priority: t.priority ?? null,
      rejectedAncestors: t.rejectedAncestors,
      openAncestors: t.openAncestors,
      accepted: t.accepted,
    })),
    nodes,
  };
}

export interface RenderOptions {
  /** The raw ArgML XML source. Required: the design renderer parses it client-side. */
  readonly source: string;
  /** Optional `<reader-overlay>` XML to ship alongside the post. The client decodes
   *  it to seed reader attitudes (spec §13.3). */
  readonly overlaySource?: string;
  /** Extra CSS appended after the bundled stylesheet (escape-hatch for examples). */
  readonly extraCss?: string;
}

// UTF-8 → base64. Works in Node and in the browser; runtimes without either
// fall back through a manual encoder.
function encodeArgmlPayload(xml: string): string {
  const buf = (
    globalThis as { Buffer?: { from(s: string, enc: string): { toString(enc: string): string } } }
  ).Buffer;
  if (buf) return buf.from(xml, "utf8").toString("base64");
  if (typeof btoa === "function") return btoa(unescape(encodeURIComponent(xml)));
  throw new Error("renderHTML: no base64 encoder available in this runtime");
}

// Pull xml:lang off the root element of the source XML. Reading from source
// (rather than the AST) avoids a parser/AST change for a presentational
// concern.
const ROOT_LANG = /<post\b[^>]*\bxml:lang\s*=\s*"([^"]+)"/;
function detectLang(source: string): string {
  const m = source.match(ROOT_LANG);
  return m?.[1] ?? "en";
}

export function renderHTML(doc: ArgMLDocument, options: RenderOptions): string {
  const title = doc.head.metadata.title ?? doc.id;
  const docLang = detectLang(options.source);

  const encodedXml = encodeArgmlPayload(options.source);
  const overlayScript = options.overlaySource
    ? `<script id="argml-overlay" type="application/argml-overlay-b64">\n${encodeArgmlPayload(
        options.overlaySource,
      )}\n</script>`
    : null;

  // When an overlay is shipped, precompute propagation server-side so the
  // first paint shows correct statuses before JS rehydrates.
  let initialStatusScript: string | null = null;
  if (options.overlaySource) {
    const overlayParse = parseReaderOverlay(options.overlaySource);
    if (overlayParse.document) {
      const result = propagate(doc, overlayParse.document);
      const payload = toPayload(result);
      // JSON is safe inside a <script type="application/json"> block as long
      // as a literal `</script` is escaped. `JSON.stringify` doesn't escape it,
      // so handle here. We don't need to escape `<!--`/`-->` because HTML5
      // parses <script> contents as "script data" — only `</script` ends it.
      const json = JSON.stringify(payload).replace(/<\/script/gi, "<\\/script");
      initialStatusScript = `<script id="argml-initial-status" type="application/json">${json}</script>`;
    }
  }

  const extra = options.extraCss ? `\n${options.extraCss}` : "";

  return [
    "<!doctype html>",
    `<html lang="${escapeAttr(docLang)}">`,
    "<head>",
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<title>${escapeText(title)}</title>`,
    `<style>\n${ARG_RENDER_CSS}${extra}\n</style>`,
    "</head>",
    "<body>",
    `<script id="argml-source" type="application/argml-b64">\n${encodedXml}\n</script>`,
    ...(overlayScript ? [overlayScript] : []),
    ...(initialStatusScript ? [initialStatusScript] : []),
    `<div id="root"></div>`,
    `<script>\n${ARG_RENDER_JS}\n</script>`,
    "</body>",
    "</html>",
    "",
  ].join("\n");
}
