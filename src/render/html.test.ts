import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ArgMLDocument } from "../ast/index.js";
import { parseArgML } from "../parser/parse.js";
import { renderHTML } from "./html.js";

const here = fileURLToPath(new URL(".", import.meta.url));
const examplePath = resolve(here, "../../examples/morality-without-consciousness.argml.xml");

function loadExample(): ArgMLDocument {
  const source = readFileSync(examplePath, "utf8");
  const result = parseArgML(source);
  if (!result.document) {
    throw new Error(`parse failed: ${JSON.stringify(result.diagnostics)}`);
  }
  return result.document;
}

function renderXml(xml: string): string {
  const r = parseArgML(xml);
  if (!r.document) throw new Error(`parse failed: ${JSON.stringify(r.diagnostics)}`);
  return renderHTML(r.document);
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

describe("renderHTML — smoke", () => {
  it("returns a non-empty HTML5 document for the worked example", () => {
    const html = renderHTML(loadExample());
    expect(html.length).toBeGreaterThan(1000);
    expect(html.startsWith("<!doctype html>\n")).toBe(true);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain("</html>");
    expect(html).toContain("<head>");
    expect(html).toContain("<body>");
    expect(html).toContain("<title>Morality without Consciousness</title>");
  });

  it("is idempotent — rendering twice yields identical output", () => {
    const doc = loadExample();
    expect(renderHTML(doc)).toBe(renderHTML(doc));
  });

  it("renders a minimal document with no head extras", () => {
    const html = renderXml(MINIMAL_DOC);
    expect(html).toContain("<title>Test Doc</title>");
    expect(html).toContain("<p>Hello.</p>");
    expect(html).not.toContain('<aside class="argml-epistemic-status"');
    expect(html).not.toContain('<section class="argml-assumptions"');
  });
});

describe("renderHTML — head section", () => {
  it("renders the epistemic-status banner when present", () => {
    const html = renderHTML(loadExample());
    expect(html).toContain('class="argml-epistemic-status"');
    expect(html).toContain("Considered but speculative");
  });

  it("renders the title, author, date, and source byline", () => {
    const html = renderHTML(loadExample());
    expect(html).toContain('<h1 class="argml-title">Morality without Consciousness</h1>');
    expect(html).toMatch(/argml-byline">IanWS /);
    expect(html).toContain('datetime="2026-04-17"');
    expect(html).toMatch(
      /<a href="https:\/\/www\.lesswrong\.com[^"]+" rel="noopener noreferrer">source<\/a>/,
    );
  });

  it("renders an assumptions panel listing declared assumptions", () => {
    const html = renderHTML(loadExample());
    expect(html).toContain('class="argml-assumptions"');
    // The worked example declares A1.
    expect(html).toContain('id="A1"');
  });
});

describe("renderHTML — term references", () => {
  const TERM_DOC = `<?xml version="1.0"?>
<post xmlns="urn:argml:v1" id="d">
  <head>
    <metadata><title>T</title><author>X</author></metadata>
    <terms>
      <term id="consciousness" canonical="sep:consciousness">
        <gloss>Phenomenal consciousness.</gloss>
        <alias>qualia</alias>
      </term>
    </terms>
  </head>
  <body><p>Discussion of <term ref="consciousness">consciousness</term>.</p></body>
</post>`;

  it("wraps the surface form in a span.argml-term and preserves the text", () => {
    const html = renderXml(TERM_DOC);
    expect(html).toMatch(/<span class="argml-term"[^>]*>consciousness<\/span>/);
  });

  it("includes gloss, canonical, and aliases in the tooltip summary", () => {
    const html = renderXml(TERM_DOC);
    expect(html).toContain("Phenomenal consciousness.");
    expect(html).toContain("canonical: sep:consciousness");
    expect(html).toContain("aliases: qualia");
  });

  it("marks unresolved cross-document references as external", () => {
    const xml = `<?xml version="1.0"?>
<post xmlns="urn:argml:v1" id="d">
  <head>
    <metadata><title>T</title><author>X</author></metadata>
    <imports><import prefix="ext" doc="https://example.com/x"/></imports>
  </head>
  <body><p>See <term ref="ext:foo">foo</term>.</p></body>
</post>`;
    const html = renderXml(xml);
    expect(html).toContain("argml-external");
    expect(html).toContain("external term: ext:foo");
  });
});

describe("renderHTML — claims", () => {
  const CLAIM_DOC = `<?xml version="1.0"?>
<post xmlns="urn:argml:v1" id="d">
  <head>
    <metadata><title>T</title><author>X</author></metadata>
    <assumptions><assumption id="A1">Foundational.</assumption></assumptions>
  </head>
  <body>
    <p><claim id="C1" credence="confident">Big claim.</claim></p>
    <p><claim id="C2" supports="C1" rests-on="A1" attacks="C0" attack-type="undercut" credence="0.85" defeasible="false">Supporting strict claim.</claim></p>
  </body>
</post>`;

  it("renders the claim with an id, marker, and credence badge", () => {
    const html = renderXml(CLAIM_DOC);
    expect(html).toContain('<span class="argml-claim argml-defeasible-true" id="C1"');
    expect(html).toContain('class="argml-claim-marker"');
    expect(html).toContain('href="#C1"');
    expect(html).toContain("argml-credence-confident");
    expect(html).toContain(">confident<");
  });

  it("includes supports, attacks (with attack-type), rests-on, and credence in the tooltip", () => {
    const html = renderXml(CLAIM_DOC);
    expect(html).toContain("supports: C1");
    expect(html).toContain("attacks (undercut): C0");
    expect(html).toContain("rests on: A1");
    expect(html).toContain("credence: 0.85");
  });

  it("marks strict claims with argml-defeasible-false and renders numeric credence verbatim", () => {
    const html = renderXml(CLAIM_DOC);
    expect(html).toContain("argml-defeasible-false");
    expect(html).toMatch(/<span class="argml-credence">0\.85<\/span>/);
  });

  it("renders rests-on badges with anchor links to the assumption", () => {
    const html = renderXml(CLAIM_DOC);
    expect(html).toMatch(/<span class="argml-rests-on">\[rests on <a href="#A1">A1<\/a>\]<\/span>/);
  });
});

describe("renderHTML — inferences", () => {
  const INF_DOC = `<?xml version="1.0"?>
<post xmlns="urn:argml:v1" id="d">
  <head><metadata><title>T</title><author>X</author></metadata></head>
  <body>
    <p><claim id="C1">Premise one.</claim></p>
    <p><claim id="C2">Premise two.</claim></p>
    <p><claim id="C3">Conclusion.</claim></p>
    <inference id="I1" from="C1 C2" to="C3" scheme="inference-to-best-explanation" strength="moderate">
      Warrant text here.
    </inference>
    <inference id="I2" from="C1" to="C3" defeasible="false" strength="deductive">Strict warrant.</inference>
  </body>
</post>`;

  it("renders inference as a block aside with id and strength badge", () => {
    const html = renderXml(INF_DOC);
    expect(html).toMatch(/<aside class="argml-inference argml-defeasible-true" id="I1"/);
    expect(html).toContain("argml-strength-moderate");
    expect(html).toContain(">moderate<");
    expect(html).toContain("Warrant text here.");
  });

  it("renders strict (defeasible=false) inferences with the strict class", () => {
    const html = renderXml(INF_DOC);
    expect(html).toContain('id="I2"');
    expect(html).toMatch(/<aside class="argml-inference argml-defeasible-false"/);
  });

  it("includes from, to, scheme, defeasibility, and strength in the tooltip", () => {
    const html = renderXml(INF_DOC);
    expect(html).toContain("inference: I1");
    expect(html).toContain("from: C1, C2");
    expect(html).toContain("to: C3");
    expect(html).toContain("scheme: inference-to-best-explanation");
    expect(html).toContain("strength: moderate");
    expect(html).toContain("defeasible: false (strict)");
  });
});

describe("renderHTML — conflicts", () => {
  it("renders conflict with attacker → target anchor links and a response block", () => {
    const xml = `<?xml version="1.0"?>
<post xmlns="urn:argml:v1" id="d">
  <head><metadata><title>T</title><author>X</author></metadata></head>
  <body>
    <p><claim id="C1">A.</claim></p>
    <p><claim id="C2">B.</claim></p>
    <conflict id="CF1" attack-type="undercut">
      <attacker idref="C1"/>
      <target idref="C2"/>
      <response><p>My reply.</p></response>
    </conflict>
  </body>
</post>`;
    const html = renderXml(xml);
    expect(html).toContain('class="argml-conflict" id="CF1"');
    expect(html).toContain("conflict CF1 · undercut");
    expect(html).toMatch(/<a href="#C1">C1<\/a> → <a href="#C2">C2<\/a>/);
    expect(html).toContain("My reply.");
  });
});

describe("renderHTML — evidence", () => {
  it("renders evidence as a sup with anchor and tooltip including type and ref", () => {
    const xml = `<?xml version="1.0"?>
<post xmlns="urn:argml:v1" id="d">
  <head><metadata><title>T</title><author>X</author></metadata></head>
  <body>
    <p><claim id="C1">Survey-backed<evidence type="survey" ref="https://example.com/s"/>.</claim></p>
  </body>
</post>`;
    const html = renderXml(xml);
    expect(html).toContain('<sup class="argml-evidence"');
    expect(html).toContain('<a href="https://example.com/s"');
    expect(html).toContain("type: survey");
    expect(html).toContain("ref: https://example.com/s");
  });
});

describe("renderHTML — escaping", () => {
  it("escapes script tags and ampersands inside text content", () => {
    const xml = `<?xml version="1.0"?>
<post xmlns="urn:argml:v1" id="d">
  <head><metadata><title>A &amp; B</title><author>X</author></metadata></head>
  <body><p>&lt;script&gt;alert(1)&lt;/script&gt; &amp; co</p></body>
</post>`;
    const html = renderXml(xml);
    expect(html).toContain("<title>A &amp; B</title>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt; &amp; co");
    // No raw injection
    expect(html).not.toMatch(/<script>alert\(1\)<\/script>/);
  });

  it("escapes quotes inside attribute values", () => {
    const xml = `<?xml version="1.0"?>
<post xmlns="urn:argml:v1" id="d">
  <head>
    <metadata><title>T</title><author>X</author></metadata>
    <terms><term id="t1"><gloss>quotes "inside" the gloss</gloss></term></terms>
  </head>
  <body><p><term ref="t1">x</term></p></body>
</post>`;
    const html = renderXml(xml);
    // The tooltip data attribute carries the gloss; quotes must be encoded.
    expect(html).toContain("&quot;inside&quot;");
  });
});

describe("renderHTML — readability without CSS", () => {
  it("preserves the prose substring after stripping styles and classes", () => {
    const html = renderHTML(loadExample());
    const stripped = html
      .replace(/<style[\s\S]*?<\/style>/g, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ");
    // Pick a stable substring from the example body.
    expect(stripped).toContain("Linch");
    expect(stripped).toContain("Fourth World");
    expect(stripped).toContain("consciousness");
  });
});

describe("renderHTML — output structure", () => {
  it("includes the stylesheet exactly once", () => {
    const html = renderHTML(loadExample());
    const opens = html.match(/<style>/g) ?? [];
    const closes = html.match(/<\/style>/g) ?? [];
    expect(opens.length).toBe(1);
    expect(closes.length).toBe(1);
  });

  it("emits no <script> tags (CSS-only renderer)", () => {
    const html = renderHTML(loadExample());
    expect(html).not.toContain("<script");
  });
});
