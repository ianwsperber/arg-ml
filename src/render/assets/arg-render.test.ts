// @vitest-environment happy-dom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  buildClaimGloss,
  buildEvidenceGloss,
  buildInferenceGloss,
  buildTermGloss,
  collectAssumptions,
  collectImports,
  collectMetadata,
  collectTerms,
  createState,
  escapeAttr,
  escapeHtml,
  formatDate,
  mdLinks,
  mount,
  parseList,
  refLabel,
  renderFrontmatter,
  renderNode,
  renderProse,
  safeHref,
} from "./arg-render.js";

const examplePath = resolve(process.cwd(), "examples/morality-without-consciousness.argml.xml");

function parseXml(xml: string): Document {
  return new DOMParser().parseFromString(xml, "application/xml");
}

const MINIMAL = `<?xml version="1.0"?>
<post xmlns="urn:argml:v1" id="d">
  <head>
    <metadata>
      <title>Test Doc</title>
      <author>A</author>
      <date>2025-01-15</date>
    </metadata>
    <terms>
      <term id="x" canonical="https://example.com/x"><gloss>An x.</gloss><alias>ex</alias></term>
      <term id="y" scope="local"><gloss>Local y.</gloss></term>
    </terms>
    <assumptions>
      <assumption id="a1">Some assumption.</assumption>
    </assumptions>
    <imports>
      <import prefix="ext" doc="https://example.com/other"/>
    </imports>
  </head>
  <body>
    <p>Plain prose with a <term ref="x">term</term> and an <term ref="ext:foo">external term</term>.</p>
    <claim id="c1" supports="c2" credence="confident" defeasible="true">A claim.</claim>
    <claim id="c2" attacks="c1" attack-type="rebut">Another claim.</claim>
    <inference id="i1" from="c1" to="c2" defeasible="false" strength="deductive">Because of reasons.</inference>
    <conflict id="conf1" attack-type="rebut">
      <attacker idref="c2"/>
      <target idref="c1"/>
      <response>A rebuttal.</response>
    </conflict>
    <note status="editorial">Editorial note.</note>
    <p>Has <evidence ref="https://example.com/src" type="src"><gloss>The source.</gloss></evidence> here.</p>
  </body>
</post>`;

// ============================================================================
// Pure helpers
// ============================================================================

describe("escapeHtml", () => {
  it("passes through plain text", () => {
    expect(escapeHtml("hello")).toBe("hello");
  });
  it("escapes &, <, >", () => {
    expect(escapeHtml("a & <b> c")).toBe("a &amp; &lt;b&gt; c");
  });
  it("does not escape quotes", () => {
    expect(escapeHtml("\"single\" 'double'")).toBe("\"single\" 'double'");
  });
});

describe("escapeAttr", () => {
  it("escapes & and double quote", () => {
    expect(escapeAttr('a & "b"')).toBe("a &amp; &quot;b&quot;");
  });
  it("does not escape < and > (attribute values tolerate them)", () => {
    expect(escapeAttr("a<b>c")).toBe("a<b>c");
  });
});

describe("parseList", () => {
  it("returns empty array for null/empty", () => {
    expect(parseList(null)).toEqual([]);
    expect(parseList("")).toEqual([]);
    expect(parseList("   ")).toEqual([]);
  });
  it("splits on whitespace and drops empties", () => {
    expect(parseList("a b  c\nd")).toEqual(["a", "b", "c", "d"]);
  });
});

describe("mdLinks", () => {
  it("passes through plain text", () => {
    expect(mdLinks("hello")).toBe("hello");
  });
  it("converts markdown links to anchor tags with rel=noopener", () => {
    expect(mdLinks("see [docs](https://x.io)")).toBe(
      'see <a href="https://x.io" target="_blank" rel="noopener">docs</a>',
    );
  });
  it("escapes link text and url", () => {
    expect(mdLinks("[a&b](u?q=1&z=2)")).toContain('href="u?q=1&amp;z=2"');
    expect(mdLinks("[a&b](u)")).toContain(">a&amp;b<");
  });
});

describe("formatDate", () => {
  it("returns empty for empty input", () => {
    expect(formatDate("")).toBe("");
  });
  it("formats a valid ISO date in en-US locale", () => {
    const out = formatDate("2025-01-15");
    expect(out).toMatch(/January/);
    expect(out).toMatch(/2025/);
  });
  it("returns the input verbatim on parse failure", () => {
    expect(formatDate("not a date")).toBe("not a date");
  });
});

describe("refLabel", () => {
  it("returns escaped text for local refs", () => {
    expect(refLabel("c1")).toBe("c1");
  });
  it("splits and wraps prefix:rest", () => {
    expect(refLabel("ext:foo")).toBe('<span class="pref">ext</span>:foo');
  });
  it("escapes both halves", () => {
    expect(refLabel("a&b:c<d")).toBe('<span class="pref">a&amp;b</span>:c&lt;d');
  });
  it("returns empty for empty input", () => {
    expect(refLabel("")).toBe("");
  });
});

// ============================================================================
// Collectors
// ============================================================================

describe("collectMetadata", () => {
  it("pulls title/author/date/source/epistemicStatus", () => {
    const doc = parseXml(MINIMAL);
    const meta = collectMetadata(doc);
    expect(meta.title).toBe("Test Doc");
    expect(meta.author).toBe("A");
    expect(meta.date).toBe("2025-01-15");
    expect(meta.epistemicStatus).toBeNull();
  });
  it("returns blank metadata when missing", () => {
    const doc = parseXml('<post xmlns="urn:argml:v1" id="d"><body/></post>');
    expect(collectMetadata(doc).title).toBe("");
  });
});

describe("collectImports / collectTerms / collectAssumptions", () => {
  const doc = parseXml(MINIMAL);
  it("imports map prefix → doc url", () => {
    expect(collectImports(doc)).toEqual({ ext: "https://example.com/other" });
  });
  it("terms collect gloss, canonical, aliases, scope", () => {
    const terms = collectTerms(doc);
    expect(terms.x).toMatchObject({
      id: "x",
      canonical: "https://example.com/x",
      gloss: "An x.",
      aliases: ["ex"],
    });
    expect(terms.y).toMatchObject({ scope: "local", gloss: "Local y.", aliases: [] });
  });
  it("assumptions collect text and rests-on", () => {
    expect(collectAssumptions(doc).a1).toMatchObject({ id: "a1", text: "Some assumption." });
  });
});

// ============================================================================
// renderNode
// ============================================================================

describe("renderNode", () => {
  it("renders prose preserving text and links", () => {
    const doc = parseXml(MINIMAL);
    const state = createState(doc);
    const body = doc.querySelector("body");
    if (!body) throw new Error("body missing");
    const html = renderProse(body, state);
    expect(html).toContain("Plain prose with a");
    expect(html).toContain('class="ann ann-term"');
    expect(html).toContain('data-external="true"'); // ext:foo
    expect(html).toContain('data-external="false"'); // local term
  });

  it("emits claims with id anchor and side-effects state.claims", () => {
    const doc = parseXml(MINIMAL);
    const state = createState(doc);
    const body = doc.querySelector("body");
    if (!body) throw new Error("body missing");
    const html = renderProse(body, state);
    expect(html).toContain('id="claim-c1"');
    expect(html).toContain('id="claim-c2"');
    expect(state.claims.c1).toMatchObject({
      id: "c1",
      supports: ["c2"],
      credence: "confident",
      defeasible: "true",
    });
    expect(state.claims.c2).toMatchObject({ attacks: ["c1"], attackType: "rebut" });
  });

  it("emits inferences as aside blocks and records state.inferences", () => {
    const doc = parseXml(MINIMAL);
    const state = createState(doc);
    const body = doc.querySelector("body");
    if (!body) throw new Error("body missing");
    const html = renderProse(body, state);
    expect(html).toContain('class="inference-block"');
    expect(html).toContain('id="inf-i1"');
    expect(html).toContain("Because of reasons.");
    expect(html).toContain("strict"); // defeasible=false marker
    expect(state.inferences.i1).toMatchObject({
      from: ["c1"],
      to: "c2",
      strength: "deductive",
      defeasible: "false",
    });
  });

  it("renders conflicts with attacker → target metadata", () => {
    const doc = parseXml(MINIMAL);
    const state = createState(doc);
    const body = doc.querySelector("body");
    if (!body) throw new Error("body missing");
    const html = renderProse(body, state);
    expect(html).toContain('id="conf-conf1"');
    expect(html).toContain("c2");
    expect(html).toContain("c1");
    expect(html).toContain("A rebuttal.");
  });

  it("collects notes with monotonically-increasing indices", () => {
    const doc = parseXml(MINIMAL);
    const state = createState(doc);
    const body = doc.querySelector("body");
    if (!body) throw new Error("body missing");
    renderProse(body, state);
    expect(state.notes).toHaveLength(1);
    expect(state.notes[0]?.editorial).toBe(true);
    expect(state.noteCounter).toBe(2);
  });

  it("renders evidence with type and gloss as data attributes", () => {
    const doc = parseXml(MINIMAL);
    const state = createState(doc);
    const body = doc.querySelector("body");
    if (!body) throw new Error("body missing");
    const html = renderProse(body, state);
    expect(html).toContain('class="ann ann-evidence"');
    expect(html).toContain('data-type="src"');
    expect(html).toContain('data-gloss="The source."');
  });

  it("maps heading level=N to <hN> and clamps to 1..6", () => {
    const cases: [number, string][] = [
      [1, "<h1>"],
      [2, "<h2>"],
      [5, "<h5>"],
      [6, "<h6>"],
      [7, "<h6>"], // clamp upper bound
      [0, "<h1>"], // clamp lower bound
    ];
    for (const [level, tag] of cases) {
      const xml = `<post xmlns="urn:argml:v1" id="d"><body><heading level="${level}">x</heading></body></post>`;
      const doc = parseXml(xml);
      const state = createState(doc);
      const body = doc.querySelector("body");
      if (!body) throw new Error("body missing");
      expect(renderProse(body, state)).toContain(tag);
    }
  });

  it("renders unknown elements by inlining their children", () => {
    const xml = '<post xmlns="urn:argml:v1" id="d"><body><weird>kept</weird></body></post>';
    const doc = parseXml(xml);
    const state = createState(doc);
    const body = doc.querySelector("body");
    if (!body) throw new Error("body missing");
    expect(renderProse(body, state)).toBe("kept");
  });
});

// ============================================================================
// Frontmatter & gloss builders
// ============================================================================

describe("renderFrontmatter", () => {
  it("emits Imports, Terms, Assumptions blocks when present", () => {
    const doc = parseXml(MINIMAL);
    const state = createState(doc);
    const html = renderFrontmatter(state);
    expect(html).toContain("Imports");
    expect(html).toContain("Terms");
    expect(html).toContain("Assumptions");
    expect(html).toContain("https://example.com/other");
  });
  it("omits blocks that are empty", () => {
    const doc = parseXml('<post xmlns="urn:argml:v1" id="d"><body/></post>');
    const state = createState(doc);
    expect(renderFrontmatter(state)).toBe("");
  });
});

describe("buildClaimGloss", () => {
  let state: ReturnType<typeof createState>;
  beforeEach(() => {
    const doc = parseXml(MINIMAL);
    state = createState(doc);
    const body = doc.querySelector("body");
    if (!body) throw new Error("body missing");
    renderProse(body, state);
  });

  it("emits supports / attacks / credence", () => {
    const html = buildClaimGloss("c1", state);
    expect(html).toContain('class="gloss-head"');
    expect(html).toContain('class="rel supports"');
    expect(html).toContain('data-target="c2"');
    expect(html).toContain("confident");
  });
  it("uses the attackType to label the attacks row", () => {
    const html = buildClaimGloss("c2", state);
    expect(html).toContain("rebuts"); // attackType = rebut → "rebuts"
  });
  it("returns empty string for unknown id", () => {
    expect(buildClaimGloss("nope", state)).toBe("");
  });
});

describe("buildTermGloss", () => {
  const doc = parseXml(MINIMAL);
  const state = createState(doc);
  it("emits canonical + aliases for local term", () => {
    const html = buildTermGloss("x", state);
    expect(html).toContain("canonical");
    expect(html).toContain("aka");
    expect(html).toContain("ex");
  });
  it("marks local-scoped terms", () => {
    const html = buildTermGloss("y", state);
    expect(html).toContain('class="cred">local');
  });
  it("renders cross-document ref with imported badge and resolved prefix url", () => {
    const html = buildTermGloss("ext:foo", state);
    expect(html).toContain("imported");
    expect(html).toContain("https://example.com/other");
  });
  it("renders undefined badge for missing local term", () => {
    expect(buildTermGloss("ghost", state)).toContain("undefined");
  });
});

describe("buildInferenceGloss", () => {
  it("emits from/to/strength", () => {
    const doc = parseXml(MINIMAL);
    const state = createState(doc);
    const body = doc.querySelector("body");
    if (!body) throw new Error("body missing");
    renderProse(body, state);
    const html = buildInferenceGloss("i1", state);
    expect(html).toContain('data-target="c1"');
    expect(html).toContain('data-target="c2"');
    expect(html).toContain("deductive");
  });
});

describe("buildEvidenceGloss", () => {
  it("emits type, gloss, href from data-* attributes", () => {
    const a = document.createElement("a");
    a.setAttribute("data-type", "src");
    a.setAttribute("data-gloss", "the gloss");
    a.setAttribute("href", "https://example.com");
    const html = buildEvidenceGloss(a);
    expect(html).toContain("src");
    expect(html).toContain("the gloss");
    expect(html).toContain("https://example.com");
  });
});

// ============================================================================
// mount() — full integration
// ============================================================================

describe("mount() — happy-dom integration", () => {
  const encode = (s: string): string => Buffer.from(s, "utf8").toString("base64");
  const setupDoc = (xml: string): void => {
    document.body.innerHTML = `<script id="argml-source" type="application/argml-b64">${encode(xml)}</script><div id="root"></div>`;
  };

  it("renders the minimal document end-to-end", () => {
    setupDoc(MINIMAL);
    mount(document, window);
    expect(document.title).toBe("Test Doc");
    const root = document.getElementById("root");
    expect(root).not.toBeNull();
    expect(root?.querySelector(".doc-title")?.textContent).toBe("Test Doc");
    expect(root?.querySelectorAll(".ann-claim").length).toBe(2);
    expect(root?.querySelector(".inference-block")).not.toBeNull();
    expect(root?.querySelector('.toolbar [data-toggle="annotations"]')).not.toBeNull();
  });

  it("renders the worked example without throwing", () => {
    const source = readFileSync(examplePath, "utf8");
    setupDoc(source);
    expect(() => mount(document, window)).not.toThrow();
    const root = document.getElementById("root");
    expect(root?.querySelectorAll(".ann-claim").length).toBeGreaterThan(0);
  });

  it("shows a <pre> with the parser error when XML is malformed", () => {
    setupDoc("<not valid xml");
    mount(document, window);
    expect(document.body.querySelector("pre")).not.toBeNull();
  });

  it("safeHref blocks dangerous schemes; rendered DOM has no javascript: hrefs", () => {
    const xml = `<?xml version="1.0"?>
<post xmlns="urn:argml:v1" id="d">
  <head><metadata><title>T</title><author>A</author><source>javascript:alert(1)</source></metadata>
    <imports><import prefix="bad" doc="javascript:alert(2)"/></imports>
  </head>
  <body>
    <p><a href="javascript:alert(3)">link</a></p>
    <p>See <evidence ref="javascript:alert(4)" type="src"><gloss>g</gloss></evidence>.</p>
  </body>
</post>`;
    setupDoc(xml);
    mount(document, window);
    const allHrefs = Array.from(document.querySelectorAll<HTMLAnchorElement>("[href]")).map(
      (a) => a.getAttribute("href") ?? "",
    );
    for (const h of allHrefs) {
      expect(h.toLowerCase()).not.toMatch(/^\s*javascript:/);
      expect(h.toLowerCase()).not.toMatch(/^\s*data:/);
    }
  });

  it("builds a gloss row per unique claim in the right gutter", () => {
    setupDoc(MINIMAL);
    mount(document, window);
    const rightGutter = document.querySelector(".right-gutter");
    expect(rightGutter?.querySelectorAll('.gloss-row[data-kind="claim"]').length).toBe(2);
  });

  it("dedupes term gloss rows when the same term ref appears twice", () => {
    const xml = `<?xml version="1.0"?>
<post xmlns="urn:argml:v1" id="d">
  <head><metadata><title>T</title><author>A</author></metadata>
    <terms><term id="x"><gloss>An x.</gloss></term></terms>
  </head>
  <body><p>One <term ref="x">x</term> and another <term ref="x">x</term>.</p></body>
</post>`;
    setupDoc(xml);
    mount(document, window);
    const rightGutter = document.querySelector(".right-gutter");
    expect(rightGutter?.querySelectorAll('.gloss-row[data-kind="term"]').length).toBe(1);
  });

  it("renders no toolbar / gutter when #root is missing", () => {
    document.body.innerHTML = `<script id="argml-source" type="application/argml-b64">${encode(MINIMAL)}</script>`;
    expect(() => mount(document, window)).not.toThrow();
  });

  it("returns silently when #argml-source is empty", () => {
    document.body.innerHTML = `<script id="argml-source" type="application/argml-b64"></script><div id="root"></div>`;
    mount(document, window);
    expect(document.getElementById("root")?.innerHTML).toBe("");
  });

  it("preserves the source XML verbatim in the embedded payload", () => {
    setupDoc(MINIMAL);
    mount(document, window);
    const src = document.getElementById("argml-source");
    const decoded = Buffer.from((src?.textContent ?? "").trim(), "base64").toString("utf8");
    expect(decoded).toContain("<title>Test Doc</title>");
  });
});

describe("safeHref", () => {
  it("allows http/https/mailto", () => {
    expect(safeHref("https://example.com")).toBe("https://example.com");
    expect(safeHref("http://example.com/x?q=1")).toBe("http://example.com/x?q=1");
    expect(safeHref("mailto:a@b.com")).toBe("mailto:a@b.com");
  });
  it("allows fragments and relative paths", () => {
    expect(safeHref("#foo")).toBe("#foo");
    expect(safeHref("/abs")).toBe("/abs");
    expect(safeHref("./rel")).toBe("./rel");
    expect(safeHref("../up")).toBe("../up");
    expect(safeHref("plain-relative")).toBe("plain-relative");
  });
  it("rejects javascript:, data:, vbscript:, file:", () => {
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("JAVASCRIPT:alert(1)")).toBeNull();
    expect(safeHref("  javascript:alert(1)  ")).toBeNull();
    expect(safeHref("data:text/html,<script>x</script>")).toBeNull();
    expect(safeHref("vbscript:msgbox(1)")).toBeNull();
    expect(safeHref("file:///etc/passwd")).toBeNull();
  });
  it("rejects null/undefined/empty", () => {
    expect(safeHref(null)).toBeNull();
    expect(safeHref(undefined)).toBeNull();
    expect(safeHref("")).toBeNull();
    expect(safeHref("   ")).toBeNull();
  });
});
