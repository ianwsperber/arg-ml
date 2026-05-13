// @vitest-environment happy-dom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { parseReaderOverlay } from "../../parser/parse.js";
import {
  applyAttitudeToDom,
  applyInitialStatuses,
  applyTakeawayStatuses,
  buildAttitudeButtons,
  buildAttitudeCard,
  buildClaimGloss,
  buildEvidenceGloss,
  buildImplicationItem,
  buildInferenceGloss,
  buildTermGloss,
  collectAssumptions,
  collectImports,
  collectMetadata,
  collectOverlayAttitudes,
  collectTerms,
  createState,
  diffStatuses,
  escapeAttr,
  escapeHtml,
  formatDate,
  mdLinks,
  mount,
  parseList,
  readInitialStatus,
  rebuildReaderDrawer,
  refLabel,
  renderFrontmatter,
  renderNode,
  renderProse,
  renderReaderDrawer,
  renderTakeawaysStrip,
  safeHref,
  serializeAttitudesAsOverlay,
  synthesizeOverlay,
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

  it("emits inferences as paragraph blocks and records state.inferences", () => {
    const doc = parseXml(MINIMAL);
    const state = createState(doc);
    const body = doc.querySelector("body");
    if (!body) throw new Error("body missing");
    const html = renderProse(body, state);
    expect(html).toContain('class="inference-block"');
    expect(html).toContain('id="inf-i1"');
    expect(html).toContain("Because of reasons.");
    // Phase 5b: no inline label; metadata surfaces in the programmatic
    // hover tooltip + gloss row, not a `title` attribute.
    expect(html).toMatch(/<p[^>]*class="inference-block"[^>]*data-id="i1"/);
    expect(html).not.toMatch(/<p[^>]*class="inference-block"[^>]*title=/);
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

  // ---- Phase 1: v0.2 data-attribute schema ----

  it('emits data-kind="claim" on every claim span', () => {
    const doc = parseXml(MINIMAL);
    const state = createState(doc);
    const body = doc.querySelector("body");
    if (!body) throw new Error("body missing");
    const html = renderProse(body, state);
    expect(html).toMatch(/<span class="ann ann-claim"[^>]+data-kind="claim"/);
  });

  it('emits data-kind="argument" on argument-block asides', () => {
    const xml = `<?xml version="1.0"?>
<post xmlns="urn:argml:v1" id="d">
  <head><metadata><title>T</title><author>X</author></metadata></head>
  <body><argument id="a1" mode="thought-experiment"><p>Imagine X.</p></argument></body>
</post>`;
    const doc = parseXml(xml);
    const state = createState(doc);
    const body = doc.querySelector("body");
    if (!body) throw new Error("body missing");
    const html = renderProse(body, state);
    expect(html).toContain('data-kind="argument"');
    expect(html).toContain('data-mode="thought-experiment"');
  });

  it("emits data-kind/from/to on inference asides", () => {
    const doc = parseXml(MINIMAL);
    const state = createState(doc);
    const body = doc.querySelector("body");
    if (!body) throw new Error("body missing");
    const html = renderProse(body, state);
    expect(html).toContain('data-kind="inference"');
    expect(html).toContain('data-from="c1"');
    expect(html).toContain('data-to="c2"');
  });

  it('emits data-takeaway="<priority>" on claims listed in <takeaways>', () => {
    const xml = `<?xml version="1.0"?>
<post xmlns="urn:argml:v1" id="d">
  <head>
    <metadata><title>T</title><author>X</author></metadata>
    <takeaways>
      <takeaway ref="c1" priority="primary"/>
      <takeaway ref="c2" priority="secondary"/>
    </takeaways>
  </head>
  <body>
    <p>Hi <claim id="c1">first</claim> and <claim id="c2">second</claim> and <claim id="c3">third</claim>.</p>
  </body>
</post>`;
    const doc = parseXml(xml);
    const state = createState(doc);
    const body = doc.querySelector("body");
    if (!body) throw new Error("body missing");
    const html = renderProse(body, state);
    expect(html).toMatch(/data-id="c1"[^>]*data-takeaway="primary"/);
    expect(html).toMatch(/data-id="c2"[^>]*data-takeaway="secondary"/);
    // c3 is not a takeaway: no data-takeaway attribute.
    expect(html).not.toMatch(/data-id="c3"[^>]*data-takeaway=/);
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

describe("renderTakeawaysStrip / applyTakeawayStatuses (Phase 3)", () => {
  const POST = `<?xml version="1.0"?>
<post xmlns="urn:argml:v1" id="d">
  <head>
    <metadata><title>T</title><author>A</author></metadata>
    <takeaways>
      <takeaway ref="C1" priority="primary"/>
      <takeaway ref="C2" priority="secondary"/>
    </takeaways>
  </head>
  <body>
    <p><claim id="C1">A very long claim that contains enough words and sentences to exceed the truncation budget so we can verify that the strip ellipsizes it on a word boundary. Truly there is no reason for it to be this long aside from forcing the truncation path to fire in the rendering. We need at least two hundred and twenty characters to trigger the cutoff.</claim></p>
    <p><claim id="C2">Short.</claim></p>
  </body>
</post>`;

  it("renders one row per takeaway with summary, priority, ref, status", () => {
    const doc = parseXml(POST);
    const state = createState(doc);
    const body = doc.querySelector("body");
    if (!body) throw new Error("body missing");
    renderProse(body, state); // populate state.claims
    const html = renderTakeawaysStrip(state);
    expect(html).toContain('class="takeaways-strip"');
    expect(html).toContain('data-ref="C1"');
    expect(html).toContain('data-priority="primary"');
    expect(html).toContain('data-status="supported"');
    expect(html).toContain('href="#claim-C1"');
    expect(html).toContain("primary");
    expect(html).toContain("secondary");
    expect(html).toContain("Short.");
  });

  it("returns an empty string when no takeaways are declared", () => {
    const empty = parseXml(MINIMAL);
    const state = createState(empty);
    expect(renderTakeawaysStrip(state)).toBe("");
  });

  it("truncates long claim summaries with an ellipsis", () => {
    const doc = parseXml(POST);
    const state = createState(doc);
    const body = doc.querySelector("body");
    if (!body) throw new Error("body missing");
    renderProse(body, state);
    const html = renderTakeawaysStrip(state);
    expect(html).toContain("…");
  });

  it("hydrates rows with statuses + a why-line for non-supported states", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <ol class="takeaways-list">
        <li class="takeaway-row" data-ref="C1" data-priority="primary" data-status="supported">
          <span class="status">supported</span>
        </li>
        <li class="takeaway-row" data-ref="C2" data-priority="secondary" data-status="supported">
          <span class="status">supported</span>
        </li>
      </ol>
    `;
    document.body.appendChild(root);
    applyTakeawayStatuses(root, {
      postPrefix: "me",
      nodes: { C1: "blocked", C2: "supported" },
      takeaways: [
        {
          id: "C1",
          status: "blocked",
          priority: "primary",
          rejectedAncestors: ["A1", "A2"],
          openAncestors: [],
          accepted: false,
        },
        {
          id: "C2",
          status: "supported",
          priority: "secondary",
          rejectedAncestors: [],
          openAncestors: [],
          accepted: false,
        },
      ],
    });
    const c1 = root.querySelector('.takeaway-row[data-ref="C1"]');
    const c2 = root.querySelector('.takeaway-row[data-ref="C2"]');
    expect(c1?.getAttribute("data-status")).toBe("blocked");
    expect(c1?.querySelector(".status")?.textContent).toBe("blocked");
    const why = c1?.querySelector(".why");
    expect(why?.textContent).toContain("blocked by");
    expect(why?.querySelectorAll("a").length).toBe(2);
    // C2 stays supported; no why-line.
    expect(c2?.getAttribute("data-status")).toBe("supported");
    expect(c2?.querySelector(".why")).toBeNull();
  });

  it("renders the strip below the frontmatter inside the page via mount()", () => {
    const encode = (s: string): string => Buffer.from(s, "utf8").toString("base64");
    document.body.innerHTML = `<script id="argml-source" type="application/argml-b64">${encode(POST)}</script><div id="root"></div>`;
    mount(document, window);
    const strip = document.querySelector(".takeaways-strip");
    expect(strip).not.toBeNull();
    expect(strip?.querySelectorAll(".takeaway-row").length).toBe(2);
  });
});

describe("Phase 4: attitude buttons + live propagation helpers", () => {
  describe("buildAttitudeButtons", () => {
    it("emits three buttons with the correct ARIA state", () => {
      const html = buildAttitudeButtons("C1", null);
      expect(html).toContain('data-att-target="C1"');
      expect(html).toContain('data-att-action="accept"');
      expect(html).toContain('data-att-action="reject"');
      expect(html).toContain('data-att-action="open"');
      // All three start unpressed.
      expect(html.match(/aria-pressed="true"/g) ?? []).toHaveLength(0);
      expect(html.match(/aria-pressed="false"/g) ?? []).toHaveLength(3);
    });

    it("marks the active kind as aria-pressed=true", () => {
      const html = buildAttitudeButtons("C1", "reject");
      expect(html).toMatch(/data-att-action="reject"[^>]*aria-pressed="true"/);
      expect(html).toMatch(/data-att-action="accept"[^>]*aria-pressed="false"/);
    });

    it("escapes the id in data attributes", () => {
      const html = buildAttitudeButtons('C"1', null);
      expect(html).toContain('data-att-target="C&quot;1"');
    });
  });

  describe("synthesizeOverlay", () => {
    it("wraps a Map into a ReaderOverlayDocument with the post prefix", () => {
      const overlay = synthesizeOverlay(
        "alice",
        "mydoc",
        new Map([
          ["C1", "reject"],
          ["C2", "accept"],
        ]),
      );
      expect(overlay.reader).toBe("alice");
      expect(overlay.imports.imports[0]).toMatchObject({ prefix: "me", doc: "mydoc" });
      expect(overlay.attitudes).toHaveLength(2);
      const targets = overlay.attitudes.map((a) => a.target).sort();
      expect(targets).toEqual(["me:C1", "me:C2"]);
    });

    it("honours an explicit prefix", () => {
      const overlay = synthesizeOverlay("a", "d", new Map([["X", "accept"]]), "myprefix");
      expect(overlay.attitudes[0]?.target).toBe("myprefix:X");
      expect(overlay.imports.imports[0]?.prefix).toBe("myprefix");
    });
  });

  describe("collectOverlayAttitudes", () => {
    it("returns the local-id → kind map for the matching prefix", () => {
      const overlayXml = `<?xml version="1.0"?>
<reader-overlay xmlns="urn:argml:v1" reader="r" updated="2026-05-12">
  <imports><import prefix="me" doc="d"/></imports>
  <attitudes>
    <attitude target="me:c1" kind="reject"/>
    <attitude target="me:c2" kind="open"/>
    <attitude target="other:c3" kind="accept"/>
  </attitudes>
</reader-overlay>`;
      const doc = parseReaderOverlay(overlayXml).document;
      if (!doc) throw new Error("overlay parse failed");
      const map = collectOverlayAttitudes(doc, "me");
      expect(map.size).toBe(2);
      expect(map.get("c1")).toBe("reject");
      expect(map.get("c2")).toBe("open");
      expect(map.has("c3")).toBe(false);
    });
  });

  describe("applyAttitudeToDom", () => {
    it("stamps data-attitude on atoms and aria-pressed on the matching button", () => {
      const root = document.createElement("div");
      root.innerHTML = `
        <span class="ann ann-claim" data-id="c1"></span>
        <div class="gloss-actions" data-att-target="c1">
          <button class="att-btn att-btn-accept" data-att-action="accept" aria-pressed="false"></button>
          <button class="att-btn att-btn-reject" data-att-action="reject" aria-pressed="false"></button>
          <button class="att-btn att-btn-open" data-att-action="open" aria-pressed="false"></button>
        </div>
      `;
      document.body.appendChild(root);
      applyAttitudeToDom(root, "c1", "reject");
      expect(root.querySelector('[data-id="c1"]')?.getAttribute("data-attitude")).toBe("reject");
      expect(
        root.querySelector('button[data-att-action="reject"]')?.getAttribute("aria-pressed"),
      ).toBe("true");
      expect(
        root.querySelector('button[data-att-action="accept"]')?.getAttribute("aria-pressed"),
      ).toBe("false");
    });

    it("clears data-attitude and all aria-pressed when kind is null", () => {
      const root = document.createElement("div");
      root.innerHTML = `
        <span class="ann ann-claim" data-id="c1" data-attitude="reject"></span>
        <div class="gloss-actions" data-att-target="c1">
          <button class="att-btn att-btn-reject" data-att-action="reject" aria-pressed="true"></button>
        </div>
      `;
      document.body.appendChild(root);
      applyAttitudeToDom(root, "c1", null);
      expect(root.querySelector('[data-id="c1"]')?.getAttribute("data-attitude")).toBeNull();
      expect(
        root.querySelector('button[data-att-action="reject"]')?.getAttribute("aria-pressed"),
      ).toBe("false");
    });
  });

  describe("diffStatuses", () => {
    it("reports added, removed, and changed ids", () => {
      const prev = new Map([
        ["a", "supported"],
        ["b", "blocked"],
      ]);
      const next = new Map([
        ["a", "supported"], // unchanged
        ["b", "supported"], // changed
        ["c", "endorsed"], // added
      ]);
      const changed = diffStatuses(prev, next);
      expect([...changed].sort()).toEqual(["b", "c"]);
    });

    it("reports removed-only ids when next omits them", () => {
      const prev = new Map([["a", "blocked"]]);
      const next = new Map();
      const changed = diffStatuses(prev, next);
      expect([...changed]).toEqual(["a"]);
    });
  });

  describe("graph edges (Phase 5)", () => {
    const encode = (s: string): string => Buffer.from(s, "utf8").toString("base64");
    const POST_WITH_RELS = `<?xml version="1.0"?>
<post xmlns="urn:argml:v1" id="d">
  <head><metadata><title>T</title><author>A</author></metadata></head>
  <body>
    <p><claim id="C1">x</claim></p>
    <p><claim id="C2" supports="C1">y</claim></p>
    <p><claim id="C3" attacks="C1">z</claim></p>
    <p><claim id="R1" mode="restated" same-as="C1">restated x</claim></p>
    <p><claim id="C4" via="i1">w</claim></p>
    <inference id="i1" from="C2" to="C1">w</inference>
  </body>
</post>`;

    it("renders bezier edges into the graph-svg even with Graph mode off", () => {
      document.body.innerHTML = `<script id="argml-source" type="application/argml-b64">${encode(POST_WITH_RELS)}</script><div id="root"></div>`;
      mount(document, window);
      // Default mode: graph pill is off.
      expect(document.getElementById("root")?.dataset.modeGraph).toBe("off");
      const svg = document.querySelector(".graph-svg");
      expect(svg).not.toBeNull();
      // supports / attacks / via / same-as edges all present.
      expect(svg?.querySelectorAll("path.edge.supports").length).toBeGreaterThan(0);
      expect(svg?.querySelectorAll("path.edge.attacks").length).toBeGreaterThan(0);
      expect(svg?.querySelectorAll("path.edge.via").length).toBeGreaterThan(0);
      expect(svg?.querySelectorAll("path.edge.same-as").length).toBe(1);
    });

    it("does not stamp marker-end on edges (pale default would clash with typed arrowheads)", () => {
      document.body.innerHTML = `<script id="argml-source" type="application/argml-b64">${encode(POST_WITH_RELS)}</script><div id="root"></div>`;
      mount(document, window);
      const edges = document.querySelectorAll(".graph-svg path.edge");
      for (const e of Array.from(edges)) {
        expect(e.getAttribute("marker-end")).toBeNull();
      }
    });
  });

  describe("click integration via mount()", () => {
    const encode = (s: string): string => Buffer.from(s, "utf8").toString("base64");
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

    it("clicking reject on an ancestor blocks the takeaway", () => {
      document.body.innerHTML = `<script id="argml-source" type="application/argml-b64">${encode(POST)}</script><div id="root"></div>`;
      mount(document, window);
      // Initially supported (no overlay).
      const takeaway = document.querySelector('.takeaway-row[data-ref="T1"]');
      expect(takeaway?.getAttribute("data-status")).toBe("supported");
      // Find the reject button for C1 inside its gloss row.
      const rejectBtn = document.querySelector<HTMLButtonElement>(
        '.gloss-actions[data-att-target="C1"] button[data-att-action="reject"]',
      );
      expect(rejectBtn).not.toBeNull();
      rejectBtn?.click();
      expect(takeaway?.getAttribute("data-status")).toBe("blocked");
      // The clicked claim picks up data-attitude.
      const c1 = document.querySelector('.ann-claim[data-id="C1"]');
      expect(c1?.getAttribute("data-attitude")).toBe("reject");
      // Clicking the same button again clears the attitude.
      rejectBtn?.click();
      expect(takeaway?.getAttribute("data-status")).toBe("supported");
      expect(c1?.getAttribute("data-attitude")).toBeNull();
    });
  });
});

describe("readInitialStatus / applyInitialStatuses (Phase 2)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    document.documentElement.removeAttribute("data-has-overlay");
  });

  it("returns null when no #argml-initial-status element exists", () => {
    expect(readInitialStatus(document)).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    document.body.innerHTML = `<script id="argml-initial-status" type="application/json">{not json}</script>`;
    expect(readInitialStatus(document)).toBeNull();
  });

  it("decodes a well-formed payload", () => {
    const payload = { postPrefix: "me", takeaways: [], nodes: { c1: "blocked" } };
    document.body.innerHTML = `<script id="argml-initial-status" type="application/json">${JSON.stringify(payload)}</script>`;
    expect(readInitialStatus(document)).toEqual(payload);
  });

  it("stamps data-status on matching atoms and returns the touched ids", () => {
    const root = document.createElement("div");
    root.innerHTML = `<span data-id="c1"></span><span data-id="c2"></span><span data-id="c3"></span>`;
    document.body.appendChild(root);
    const touched = applyInitialStatuses(root, {
      postPrefix: null,
      takeaways: [],
      nodes: { c1: "blocked", c2: "endorsed" },
    });
    expect(root.querySelector('[data-id="c1"]')?.getAttribute("data-status")).toBe("blocked");
    expect(root.querySelector('[data-id="c2"]')?.getAttribute("data-status")).toBe("endorsed");
    expect(root.querySelector('[data-id="c3"]')?.getAttribute("data-status")).toBeNull();
    expect([...touched].sort()).toEqual(["c1", "c2"]);
  });

  it("returns an empty set when given a null payload", () => {
    const root = document.createElement("div");
    root.innerHTML = `<span data-id="c1"></span>`;
    expect(applyInitialStatuses(root, null).size).toBe(0);
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

  it("applies data-status to atoms from #argml-initial-status payload", () => {
    const payload = JSON.stringify({
      postPrefix: "me",
      takeaways: [],
      nodes: { c1: "blocked", c2: "endorsed" },
    });
    document.body.innerHTML = `<script id="argml-source" type="application/argml-b64">${encode(MINIMAL)}</script><script id="argml-initial-status" type="application/json">${payload}</script><div id="root"></div>`;
    mount(document, window);
    const c1 = document.querySelector('[data-id="c1"]');
    const c2 = document.querySelector('[data-id="c2"]');
    expect(c1?.getAttribute("data-status")).toBe("blocked");
    expect(c2?.getAttribute("data-status")).toBe("endorsed");
  });

  it("tolerates malformed initial-status JSON", () => {
    document.body.innerHTML = `<script id="argml-source" type="application/argml-b64">${encode(MINIMAL)}</script><script id="argml-initial-status" type="application/json">not valid json</script><div id="root"></div>`;
    expect(() => mount(document, window)).not.toThrow();
    // Atoms should not have data-status.
    const c1 = document.querySelector('[data-id="c1"]');
    expect(c1?.getAttribute("data-status")).toBeNull();
  });

  it('sets data-has-overlay="false" on <html> when no #argml-overlay is present', () => {
    setupDoc(MINIMAL);
    mount(document, window);
    expect(document.documentElement.getAttribute("data-has-overlay")).toBe("false");
  });

  it('sets data-has-overlay="true" on <html> when #argml-overlay is present', () => {
    const overlay = `<?xml version="1.0"?>
<reader-overlay xmlns="urn:argml:v1" reader="alice" updated="2026-05-12">
  <imports><import prefix="me" doc="d"/></imports>
  <attitudes><attitude target="me:c1" kind="reject">no</attitude></attitudes>
</reader-overlay>`;
    document.body.innerHTML = `<script id="argml-source" type="application/argml-b64">${encode(MINIMAL)}</script><script id="argml-overlay" type="application/argml-overlay-b64">${encode(overlay)}</script><div id="root"></div>`;
    mount(document, window);
    expect(document.documentElement.getAttribute("data-has-overlay")).toBe("true");
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

describe("Phase 6: reader drawer", () => {
  const encode = (s: string): string => Buffer.from(s, "utf8").toString("base64");

  describe("renderReaderDrawer", () => {
    it("emits the drawer scaffold with marks + implications + export", () => {
      const html = renderReaderDrawer();
      expect(html).toContain('class="reader-drawer"');
      expect(html).toContain('data-action="export-overlay"');
      expect(html).toContain('class="drawer-marks-list"');
      expect(html).toContain('class="drawer-implications-list"');
      expect(html).toContain("data-empty-text=");
    });
  });

  describe("buildAttitudeCard", () => {
    it("renders id, kind label, summary, and a clear button", () => {
      const html = buildAttitudeCard("C1", "reject", "A controversial claim.");
      expect(html).toContain('data-target="C1"');
      expect(html).toContain('data-kind="reject"');
      expect(html).toContain("Reject");
      expect(html).toContain("A controversial claim.");
      expect(html).toContain('data-action="clear-attitude"');
      expect(html).toContain('href="#claim-C1"');
    });
    it("omits summary block when text is null", () => {
      const html = buildAttitudeCard("X", "accept", null);
      expect(html).not.toContain('class="mark-summary"');
    });
    it("escapes the id in attributes and href", () => {
      const html = buildAttitudeCard('C"1', "open", null);
      expect(html).toContain('data-target="C&quot;1"');
      expect(html).toContain('href="#claim-C&quot;1"');
    });
  });

  describe("buildImplicationItem", () => {
    it("renders a why-line with rejected ancestors for blocked takeaways", () => {
      const html = buildImplicationItem(
        {
          id: "T1",
          status: "blocked",
          priority: "primary",
          rejectedAncestors: ["A1", "A2"],
          openAncestors: [],
          accepted: false,
        },
        "conclusion",
      );
      expect(html).toContain('data-ref="T1"');
      expect(html).toContain('data-status="blocked"');
      expect(html).toContain("blocked by");
      expect(html).toContain('href="#claim-A1"');
      expect(html).toContain('href="#claim-A2"');
      expect(html).toContain("conclusion");
    });
    it("renders openAncestors for provisional takeaways", () => {
      const html = buildImplicationItem(
        {
          id: "T2",
          status: "provisional",
          priority: null,
          rejectedAncestors: [],
          openAncestors: ["O1"],
          accepted: false,
        },
        null,
      );
      expect(html).toContain("open via");
      expect(html).toContain('href="#claim-O1"');
    });
    it("collapses ancestor list with a +N suffix when over three", () => {
      const html = buildImplicationItem(
        {
          id: "T3",
          status: "blocked",
          priority: null,
          rejectedAncestors: ["A1", "A2", "A3", "A4", "A5"],
          openAncestors: [],
          accepted: false,
        },
        null,
      );
      expect(html).toContain("+2");
    });
  });

  describe("rebuildReaderDrawer", () => {
    it("populates the marks list from the attitudes Map", () => {
      const root = document.createElement("div");
      root.innerHTML = renderReaderDrawer();
      const claims = {
        C1: {
          id: "C1",
          text: "A claim.",
          supports: [],
          attacks: [],
          restsOn: [],
          via: null,
          credence: null,
          attackType: "rebut",
          defeasible: "",
          scheme: null,
          mode: null,
          attributedTo: null,
          sameAs: null,
          via_argument: null,
        },
      } as never;
      rebuildReaderDrawer(root, new Map([["C1", "reject"]]), null, claims);
      const items = root.querySelectorAll(".drawer-mark");
      expect(items.length).toBe(1);
      expect(items[0]?.getAttribute("data-target")).toBe("C1");
      expect(items[0]?.getAttribute("data-kind")).toBe("reject");
    });

    it("marks the marks list empty when no attitudes are set", () => {
      const root = document.createElement("div");
      root.innerHTML = renderReaderDrawer();
      rebuildReaderDrawer(root, new Map(), null, {});
      const list = root.querySelector(".drawer-marks-list");
      expect(list?.getAttribute("data-empty")).toBe("true");
    });
  });

  describe("serializeAttitudesAsOverlay", () => {
    it("produces an overlay XML that re-parses cleanly", () => {
      const xml = serializeAttitudesAsOverlay(
        new Map([
          ["C1", "reject"],
          ["C2", "accept"],
        ]),
        "post-1",
        "me",
        "alice",
      );
      expect(xml).toContain("<reader-overlay");
      expect(xml).toContain('reader="alice"');
      expect(xml).toContain('target="me:C1"');
      expect(xml).toContain('kind="reject"');
      const parsed = parseReaderOverlay(xml).document;
      expect(parsed).not.toBeNull();
      expect(parsed?.attitudes).toHaveLength(2);
    });
  });

  describe("Reader toolbar pill via mount()", () => {
    const MINIMAL_POST = `<?xml version="1.0"?>
<post xmlns="urn:argml:v1" id="d">
  <head><metadata><title>T</title><author>A</author></metadata></head>
  <body><p><claim id="C1">x</claim></p></body>
</post>`;

    it("renders a Reader pill and starts with data-mode-reader='off'", () => {
      document.body.innerHTML = `<script id="argml-source" type="application/argml-b64">${encode(MINIMAL_POST)}</script><div id="root"></div>`;
      mount(document, window);
      const root = document.getElementById("root");
      const btn = root?.querySelector('.toolbar [data-toggle="reader"]');
      expect(btn).not.toBeNull();
      expect(root?.dataset.modeReader).toBe("off");
      // Drawer scaffold is present even when closed.
      expect(root?.querySelector(".reader-drawer")).not.toBeNull();
    });

    it("clicking the Reader pill flips data-mode-reader and aria-pressed", () => {
      document.body.innerHTML = `<script id="argml-source" type="application/argml-b64">${encode(MINIMAL_POST)}</script><div id="root"></div>`;
      mount(document, window);
      const root = document.getElementById("root");
      const btn = root?.querySelector<HTMLButtonElement>('.toolbar [data-toggle="reader"]');
      btn?.click();
      expect(root?.dataset.modeReader).toBe("on");
      expect(btn?.getAttribute("aria-pressed")).toBe("true");
    });

    it("clicking reject populates the drawer with a mark and an implication", () => {
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
      document.body.innerHTML = `<script id="argml-source" type="application/argml-b64">${encode(POST)}</script><div id="root"></div>`;
      mount(document, window);
      const rejectBtn = document.querySelector<HTMLButtonElement>(
        '.gloss-actions[data-att-target="C1"] button[data-att-action="reject"]',
      );
      rejectBtn?.click();
      const marks = document.querySelectorAll(".drawer-mark");
      expect(marks.length).toBe(1);
      expect(marks[0]?.getAttribute("data-target")).toBe("C1");
      expect(marks[0]?.getAttribute("data-kind")).toBe("reject");
      const impls = document.querySelectorAll(".drawer-impl");
      expect(impls.length).toBe(1);
      expect(impls[0]?.getAttribute("data-ref")).toBe("T1");
      expect(impls[0]?.getAttribute("data-status")).toBe("blocked");
    });

    it("clicking the drawer's mark-clear button removes the attitude", () => {
      const POST = `<?xml version="1.0"?>
<post xmlns="urn:argml:v1" id="d">
  <head><metadata><title>T</title><author>A</author></metadata></head>
  <body><p><claim id="C1">x</claim></p></body>
</post>`;
      document.body.innerHTML = `<script id="argml-source" type="application/argml-b64">${encode(POST)}</script><div id="root"></div>`;
      mount(document, window);
      const rejectBtn = document.querySelector<HTMLButtonElement>(
        '.gloss-actions[data-att-target="C1"] button[data-att-action="reject"]',
      );
      rejectBtn?.click();
      expect(document.querySelectorAll(".drawer-mark").length).toBe(1);
      const clearBtn = document.querySelector<HTMLButtonElement>(
        '.drawer-mark[data-target="C1"] .mark-clear',
      );
      clearBtn?.click();
      expect(document.querySelectorAll(".drawer-mark").length).toBe(0);
      expect(
        document.querySelector('.ann-claim[data-id="C1"]')?.getAttribute("data-attitude"),
      ).toBeNull();
    });

    it("export-overlay button triggers a download with a valid overlay XML", async () => {
      const POST = `<?xml version="1.0"?>
<post xmlns="urn:argml:v1" id="exportdoc">
  <head><metadata><title>T</title><author>A</author></metadata></head>
  <body><p><claim id="C1">x</claim></p></body>
</post>`;
      document.body.innerHTML = `<script id="argml-source" type="application/argml-b64">${encode(POST)}</script><div id="root"></div>`;
      mount(document, window);
      // Mark C1 as rejected.
      const rejectBtn = document.querySelector<HTMLButtonElement>(
        '.gloss-actions[data-att-target="C1"] button[data-att-action="reject"]',
      );
      rejectBtn?.click();
      // Stub URL.createObjectURL so we can capture the Blob payload directly
      // (happy-dom's blob: URLs aren't fetchable via Blob.text() round-trips).
      const captured: { blob: Blob | null; download: string | null } = {
        blob: null,
        download: null,
      };
      const originalCreateObjectURL = URL.createObjectURL;
      URL.createObjectURL = (b: Blob): string => {
        captured.blob = b;
        return "blob:stub";
      };
      const originalCreate = document.createElement.bind(document);
      const createSpy = (tag: string): HTMLElement => {
        const el = originalCreate(tag);
        if (tag === "a") {
          const a = el as HTMLAnchorElement;
          a.click = () => {
            captured.download = a.getAttribute("download");
          };
        }
        return el;
      };
      (document as unknown as { createElement: typeof createSpy }).createElement = createSpy;
      try {
        const exportBtn = document.querySelector<HTMLButtonElement>(
          '[data-action="export-overlay"]',
        );
        exportBtn?.click();
      } finally {
        (document as unknown as { createElement: typeof originalCreate }).createElement =
          originalCreate;
        URL.createObjectURL = originalCreateObjectURL;
      }
      expect(captured.download).toBe("exportdoc.overlay.xml");
      expect(captured.blob).not.toBeNull();
      const text = await captured.blob?.text();
      expect(text).toContain("<reader-overlay");
      expect(text).toContain('target="me:C1"');
      expect(text).toContain('kind="reject"');
    });
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
