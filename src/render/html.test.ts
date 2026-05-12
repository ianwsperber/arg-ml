import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseArgML } from "../parser/parse.js";
import { renderHTML } from "./html.js";

const here = fileURLToPath(new URL(".", import.meta.url));
const examplePath = resolve(here, "../../examples/morality-without-consciousness.argml.xml");

function renderXml(xml: string): string {
  const r = parseArgML(xml);
  if (!r.document) throw new Error(`parse failed: ${JSON.stringify(r.diagnostics)}`);
  return renderHTML(r.document, { source: xml });
}

function renderExample(): string {
  const source = readFileSync(examplePath, "utf8");
  const r = parseArgML(source);
  if (!r.document) throw new Error(`parse failed: ${JSON.stringify(r.diagnostics)}`);
  return renderHTML(r.document, { source });
}

const MINIMAL_DOC = `<?xml version="1.0"?>
<post xmlns="urn:argml:v1" id="d">
  <head>
    <metadata>
      <title>Test Doc</title>
      <author>Tester</author>
    </metadata>
  </head>
  <body><p>Hello.</p></body>
</post>`;

describe("renderHTML — shell", () => {
  it("returns a complete HTML5 document for the worked example", () => {
    const html = renderExample();
    expect(html.startsWith("<!doctype html>\n")).toBe(true);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain("</html>");
    expect(html).toContain("<head>");
    expect(html).toContain("<body>");
    expect(html).toContain("<title>Morality without Consciousness</title>");
  });

  it("is idempotent — rendering twice yields identical output", () => {
    const source = readFileSync(examplePath, "utf8");
    const doc = parseArgML(source).document;
    if (!doc) throw new Error("parse failed");
    expect(renderHTML(doc, { source })).toBe(renderHTML(doc, { source }));
  });

  it("uses the document id as title when metadata title is absent", () => {
    const xml = `<?xml version="1.0"?>
<post xmlns="urn:argml:v1" id="fallback-id">
  <head><metadata><author>X</author></metadata></head>
  <body><p>x</p></body>
</post>`;
    const html = renderXml(xml);
    expect(html).toContain("<title>fallback-id</title>");
  });
});

describe("renderHTML — embedded XML payload", () => {
  it("embeds the source XML in a script tag with the design id and type", () => {
    const html = renderXml(MINIMAL_DOC);
    expect(html).toContain('<script id="argml-source" type="application/xml">');
    expect(html).toContain("<title>Test Doc</title>");
    // The raw XML body should appear unescaped inside the script tag.
    expect(html).toContain("<p>Hello.</p>");
  });

  it("neutralizes </script> sequences inside the embedded XML", () => {
    const xml = `<?xml version="1.0"?>
<post xmlns="urn:argml:v1" id="d">
  <head><metadata><title>T</title><author>X</author></metadata></head>
  <body><p>before&lt;/script&gt;after</p></body>
</post>`;
    const html = renderXml(xml);
    // The literal closing tag for #argml-source must remain a single occurrence.
    const closes = html.match(/<\/script/gi) ?? [];
    // Exactly two: the close of #argml-source and the close of the renderer script.
    expect(closes.length).toBe(2);
  });
});

describe("renderHTML — design assets", () => {
  it("inlines the design stylesheet exactly once", () => {
    const html = renderExample();
    const opens = html.match(/<style>/g) ?? [];
    const closes = html.match(/<\/style>/g) ?? [];
    expect(opens.length).toBe(1);
    expect(closes.length).toBe(1);
    // A marker from arg-render.css.
    expect(html).toContain("--accent: #7a4a1f");
  });

  it("inlines the design renderer script and provides the root container", () => {
    const html = renderExample();
    expect(html).toContain('<div id="root"></div>');
    // A marker from arg-render.js.
    expect(html).toContain('const NS = "urn:argml:v1"');
  });

  it("appends extraCss after the bundled stylesheet", () => {
    const source = MINIMAL_DOC;
    const doc = parseArgML(source).document;
    if (!doc) throw new Error("parse failed");
    const html = renderHTML(doc, { source, extraCss: "/* MARKER-EXTRA-CSS */" });
    const css = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
    expect(css).toContain("--accent: #7a4a1f");
    expect(css.indexOf("--accent: #7a4a1f")).toBeLessThan(css.indexOf("/* MARKER-EXTRA-CSS */"));
  });
});

describe("renderHTML — escaping", () => {
  it("escapes the title attribute in the head", () => {
    const xml = `<?xml version="1.0"?>
<post xmlns="urn:argml:v1" id="d">
  <head><metadata><title>A &amp; B</title><author>X</author></metadata></head>
  <body><p>x</p></body>
</post>`;
    const html = renderXml(xml);
    expect(html).toContain("<title>A &amp; B</title>");
  });
});
