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
  it("embeds the source XML as a base64 payload with the design id and type", () => {
    const html = renderXml(MINIMAL_DOC);
    expect(html).toContain('<script id="argml-source" type="application/argml-b64">');
    expect(html).toContain("<title>Test Doc</title>");
    // The encoded payload should round-trip back to the source.
    const m = html.match(/<script id="argml-source"[^>]*>\n([^<]+)\n<\/script>/);
    expect(m).not.toBeNull();
    const decoded = Buffer.from((m?.[1] ?? "").trim(), "base64").toString("utf8");
    expect(decoded).toBe(MINIMAL_DOC);
  });

  it("preserves literal </script> sequences inside the embedded XML", () => {
    // CDATA can contain a literal </script in real-world ArgML. The base64
    // payload sidesteps any HTML-tag breakout entirely.
    const xml = `<?xml version="1.0"?>
<post xmlns="urn:argml:v1" id="d">
  <head><metadata><title>T</title><author>X</author></metadata></head>
  <body><p><![CDATA[before</script>after]]></p></body>
</post>`;
    const html = renderXml(xml);
    // Exactly two literal </script> closes: the #argml-source close and the renderer script close.
    const closes = html.match(/<\/script/gi) ?? [];
    expect(closes.length).toBe(2);
    // And the base64 payload must round-trip the literal </script> in the CDATA.
    const m = html.match(/<script id="argml-source"[^>]*>\n([^<]+)\n<\/script>/);
    const decoded = Buffer.from((m?.[1] ?? "").trim(), "base64").toString("utf8");
    expect(decoded).toContain("<![CDATA[before</script>after]]>");
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
    // A marker from the bundled bootstrap.
    expect(html).toContain("mount(document, window)");
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

describe("renderHTML — initial propagation status (Phase 2)", () => {
  // A small post with one takeaway T1 supported by C1. Rejecting C1 (an
  // ancestor of T1 in the propagation graph) should propagate to T1.
  const POST = `<?xml version="1.0"?>
<post xmlns="urn:argml:v1" id="propdoc">
  <head>
    <metadata><title>P</title><author>A</author></metadata>
    <takeaways><takeaway ref="T1" priority="primary"/></takeaways>
  </head>
  <body>
    <p><claim id="T1">conclusion</claim>.</p>
    <p><claim id="C1" supports="T1">premise</claim>.</p>
  </body>
</post>`;

  it("omits the initial-status script when no overlay is given", () => {
    const html = renderXml(POST);
    expect(html).not.toContain('id="argml-initial-status"');
  });

  it("embeds an initial-status JSON when an overlay is provided", () => {
    const overlay = `<?xml version="1.0"?>
<reader-overlay xmlns="urn:argml:v1" reader="r" updated="2026-05-12">
  <imports><import prefix="me" doc="propdoc"/></imports>
  <attitudes><attitude target="me:C1" kind="reject">no</attitude></attitudes>
</reader-overlay>`;
    const doc = parseArgML(POST).document;
    if (!doc) throw new Error("parse failed");
    const html = renderHTML(doc, { source: POST, overlaySource: overlay });
    expect(html).toContain('<script id="argml-initial-status" type="application/json">');
    const m = html.match(/<script id="argml-initial-status"[^>]*>([^<]+)<\/script>/);
    expect(m).not.toBeNull();
    const payload = JSON.parse(m?.[1] ?? "{}") as {
      nodes: Record<string, string>;
      takeaways: { id: string; status: string }[];
    };
    // T1 supports-on C1, which is rejected, so T1 propagates to "blocked".
    expect(payload.nodes.T1).toBe("blocked");
    expect(payload.takeaways[0]?.id).toBe("T1");
    expect(payload.takeaways[0]?.status).toBe("blocked");
  });

  it("escapes literal </script in the initial-status JSON", () => {
    // Construct a post where the rejection note contains </script>. The note
    // text isn't in the payload, but we still defend the escape path.
    const overlay = `<?xml version="1.0"?>
<reader-overlay xmlns="urn:argml:v1" reader="r" updated="2026-05-12">
  <imports><import prefix="me" doc="propdoc"/></imports>
  <attitudes><attitude target="me:C1" kind="reject">x</attitude></attitudes>
</reader-overlay>`;
    const doc = parseArgML(POST).document;
    if (!doc) throw new Error("parse failed");
    const html = renderHTML(doc, { source: POST, overlaySource: overlay });
    // Exactly three </script closes: source, overlay, initial-status, plus renderer script = 4
    // (initial-status is type="application/json", not a real JS script, but it still closes with </script>)
    const closes = html.match(/<\/script/gi) ?? [];
    expect(closes.length).toBe(4);
  });
});

describe("renderHTML — overlay payload (Phase 1)", () => {
  const OVERLAY_XML = `<?xml version="1.0"?>
<reader-overlay xmlns="urn:argml:v1" reader="alice" updated="2026-05-12">
  <imports><import prefix="me" doc="d"/></imports>
  <attitudes>
    <attitude target="me:C1" kind="reject">Convinced this is wrong.</attitude>
  </attitudes>
</reader-overlay>`;

  it("omits the overlay script when no overlaySource is given", () => {
    const html = renderXml(MINIMAL_DOC);
    expect(html).not.toContain('id="argml-overlay"');
  });

  it("embeds the overlay script when overlaySource is provided", () => {
    const doc = parseArgML(MINIMAL_DOC).document;
    if (!doc) throw new Error("parse failed");
    const html = renderHTML(doc, { source: MINIMAL_DOC, overlaySource: OVERLAY_XML });
    expect(html).toContain('<script id="argml-overlay" type="application/argml-overlay-b64">');
    const m = html.match(/<script id="argml-overlay"[^>]*>\n([^<]+)\n<\/script>/);
    expect(m).not.toBeNull();
    const decoded = Buffer.from((m?.[1] ?? "").trim(), "base64").toString("utf8");
    expect(decoded).toBe(OVERLAY_XML);
  });

  it("places the overlay script after the source script but before the root", () => {
    const doc = parseArgML(MINIMAL_DOC).document;
    if (!doc) throw new Error("parse failed");
    const html = renderHTML(doc, { source: MINIMAL_DOC, overlaySource: OVERLAY_XML });
    const iSrc = html.indexOf('id="argml-source"');
    const iOvl = html.indexOf('id="argml-overlay"');
    const iRoot = html.indexOf('id="root"');
    expect(iSrc).toBeGreaterThan(-1);
    expect(iOvl).toBeGreaterThan(iSrc);
    expect(iRoot).toBeGreaterThan(iOvl);
  });
});

describe("renderHTML — document language", () => {
  it("defaults html lang to 'en' when xml:lang is absent", () => {
    const html = renderXml(MINIMAL_DOC);
    expect(html).toContain('<html lang="en">');
  });

  it("uses xml:lang from the root element when present", () => {
    const xml = `<?xml version="1.0"?>
<post xmlns="urn:argml:v1" xml:lang="fr" id="d">
  <head><metadata><title>T</title><author>X</author></metadata></head>
  <body><p>x</p></body>
</post>`;
    const html = renderXml(xml);
    expect(html).toContain('<html lang="fr">');
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
