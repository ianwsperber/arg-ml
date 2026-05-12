import type { ArgMLDocument } from "../ast/index.js";
import { ARG_RENDER_CSS, ARG_RENDER_JS } from "./assets.generated.js";
import { escapeAttr, escapeText } from "./escape.js";

export interface RenderOptions {
  /** The raw ArgML XML source. Required: the design renderer parses it client-side. */
  readonly source: string;
  /** Extra CSS appended after the bundled stylesheet (escape-hatch for examples). */
  readonly extraCss?: string;
}

export function renderHTML(doc: ArgMLDocument, options: RenderOptions): string {
  const title = doc.head.metadata.title ?? doc.id;
  const docLang = "en";

  const safeXml = options.source.replace(/<\/script/gi, "<\\/script");
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
    `<script id="argml-source" type="application/xml">\n${safeXml}\n</script>`,
    `<div id="root"></div>`,
    `<script>\n${ARG_RENDER_JS}\n</script>`,
    "</body>",
    "</html>",
    "",
  ].join("\n");
}
