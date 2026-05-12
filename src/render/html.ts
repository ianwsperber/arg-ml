import type { ArgMLDocument } from "../ast/index.js";
import { ARG_RENDER_CSS, ARG_RENDER_JS } from "./assets.generated.js";
import { escapeAttr, escapeText } from "./escape.js";

export interface RenderOptions {
  /** The raw ArgML XML source. Required: the design renderer parses it client-side. */
  readonly source: string;
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
    `<div id="root"></div>`,
    `<script>\n${ARG_RENDER_JS}\n</script>`,
    "</body>",
    "</html>",
    "",
  ].join("\n");
}
