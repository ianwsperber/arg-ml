import { describe, expect, it } from "vitest";
import { parseArgML, serializeArgML } from "../index.js";

function assertDefined<T>(v: T | null | undefined): T {
  if (v === null || v === undefined) throw new Error("expected defined value");
  return v;
}

const HEAD = "<head><metadata><title>t</title><author>a</author></metadata>";

describe("parseArgML — 0.2 head additions", () => {
  it("parses <provenance> and <generator>", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t"><head>
      <metadata><title>t</title><author>a</author></metadata>
      <provenance>
        <generator id="g1" type="human" who="alice" date="2026-05-12" role="reviewer"/>
        <generator id="g2" type="llm" model="claude-opus-4.7"/>
      </provenance>
    </head><body/></post>`;
    const doc = assertDefined(parseArgML(xml).document);
    const gens = assertDefined(doc.head.provenance).generators;
    expect(gens).toHaveLength(2);
    expect(gens[0]?.id).toBe("g1");
    expect(gens[0]?.who).toBe("alice");
    expect(gens[0]?.role).toBe("reviewer");
    expect(gens[1]?.model).toBe("claude-opus-4.7");
  });

  it("parses <takeaways> with priorities and provenance", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t"><head>
      <metadata><title>t</title><author>a</author></metadata>
      <takeaways>
        <takeaway ref="C1" priority="primary" provenance="g1"/>
        <takeaway ref="C2"/>
      </takeaways>
    </head><body/></post>`;
    const doc = assertDefined(parseArgML(xml).document);
    const takeaways = assertDefined(doc.head.takeaways).takeaways;
    expect(takeaways.map((t) => t.ref)).toEqual(["C1", "C2"]);
    expect(takeaways[0]?.priority).toBe("primary");
    expect(takeaways[0]?.provenance).toEqual(["g1"]);
    expect(takeaways[1]?.priority).toBeUndefined();
  });

  it("PARSE010: warns when head children appear out of spec order", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t"><head>
      <metadata><title>t</title><author>a</author></metadata>
      <takeaways/>
      <imports><import prefix="x" doc="https://x"/></imports>
    </head><body/></post>`;
    const result = parseArgML(xml);
    expect(result.diagnostics.some((d) => d.code === "PARSE010")).toBe(true);
  });

  it("PARSE010: a single misplaced child does not cascade onto correctly-ordered siblings", () => {
    // metadata(0) → takeaways(5) → imports(2) → terms(3) → assumptions(4):
    // takeaways is the misplaced one; imports/terms/assumptions are in order
    // relative to each other and should NOT each generate a PARSE010.
    // (Before the fix, lastOrder stayed at 5 after `takeaways` and every
    // subsequent child produced a false-alarm warning.)
    const xml = `<post xmlns="urn:argml:v1" id="t"><head>
      <metadata><title>t</title><author>a</author></metadata>
      <takeaways/>
      <imports><import prefix="x" doc="https://x"/></imports>
      <terms/>
      <assumptions/>
    </head><body/></post>`;
    const result = parseArgML(xml);
    const warnings = result.diagnostics.filter((d) => d.code === "PARSE010");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.message).toContain("<imports>");
  });

  it("PARSE011: warns when <argument> is missing required mode", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t">${HEAD}</head><body>
      <argument id="A1"><p>x</p></argument>
    </body></post>`;
    const result = parseArgML(xml);
    expect(result.diagnostics.some((d) => d.code === "PARSE011")).toBe(true);
  });

  it("PARSE012: warns when <takeaway> is missing required ref", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t"><head>
      <metadata><title>t</title><author>a</author></metadata>
      <takeaways><takeaway/></takeaways>
    </head><body/></post>`;
    const result = parseArgML(xml);
    expect(result.diagnostics.some((d) => d.code === "PARSE012")).toBe(true);
  });

  it("PARSE013: warns when <generator> is missing required id", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t"><head>
      <metadata><title>t</title><author>a</author></metadata>
      <provenance><generator type="human" who="x"/></provenance>
    </head><body/></post>`;
    const result = parseArgML(xml);
    expect(result.diagnostics.some((d) => d.code === "PARSE013")).toBe(true);
  });
});

describe("parseArgML — 0.2 body additions", () => {
  it("parses <argument> with mode + supports + nested prose", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t">${HEAD}</head><body>
      <argument mode="thought-experiment" id="A1" supports="C1" provenance="g1">
        <p>imagine that</p>
      </argument>
      <claim id="C1">y</claim>
    </body></post>`;
    const doc = assertDefined(parseArgML(xml).document);
    const block = doc.body.children[0] as { kind: string; mode?: string; supports?: string[] };
    expect(block.kind).toBe("argument");
    expect(block.mode).toBe("thought-experiment");
    expect(block.supports).toEqual(["C1"]);
  });

  it("parses claim mode/attributed-to/same-as/source/provenance", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t">${HEAD}</head><body>
      <p><claim id="C1" mode="attributed" attributed-to="Linch"
                same-as="other:thesis" source="https://example.org"
                provenance="g1 g2">x</claim></p>
    </body></post>`;
    const doc = assertDefined(parseArgML(xml).document);
    const p = doc.body.children[0] as { children?: Array<{ kind: string }> };
    const claim = assertDefined(p.children?.[0]) as unknown as {
      mode?: string;
      attributedTo?: string;
      sameAs?: string;
      source?: string;
      provenance: string[];
    };
    expect(claim.mode).toBe("attributed");
    expect(claim.attributedTo).toBe("Linch");
    expect(claim.sameAs).toBe("other:thesis");
    expect(claim.source).toBe("https://example.org");
    expect(claim.provenance).toEqual(["g1", "g2"]);
  });

  it("parses inference pattern + provenance", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t">${HEAD}</head><body>
      <p><claim id="C1">a</claim><claim id="C2">b</claim>
         <inference id="I1" from="C1" to="C2" pattern="modus-ponens" provenance="g1"/>
      </p>
    </body></post>`;
    const doc = assertDefined(parseArgML(xml).document);
    const p = doc.body.children[0] as { children?: Array<{ kind: string }> };
    const inf = p.children?.find((n) => n.kind === "inference") as unknown as {
      pattern?: string;
      provenance: string[];
    };
    expect(inf.pattern).toBe("modus-ponens");
    expect(inf.provenance).toEqual(["g1"]);
  });

  it("0.2 round-trip preserves all new attributes", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t"><head>
      <metadata><title>t</title><author>a</author></metadata>
      <provenance><generator id="g1" type="human" who="alice"/></provenance>
      <takeaways><takeaway ref="C1" priority="primary"/></takeaways>
    </head><body>
      <argument mode="case" id="A1" supports="C1"><p>x</p></argument>
      <p><claim id="C1" mode="restated" same-as="C2" provenance="g1">y</claim>
         <claim id="C2">z</claim>
         <inference id="I1" from="C2" to="C1" pattern="modus-ponens"/></p>
    </body></post>`;
    const doc1 = assertDefined(parseArgML(xml).document);
    const ser = serializeArgML(doc1);
    const doc2 = assertDefined(parseArgML(ser).document);
    expect(doc2.head.provenance?.generators[0]?.id).toBe("g1");
    expect(doc2.head.takeaways?.takeaways[0]?.priority).toBe("primary");
    const arg = doc2.body.children[0] as { kind: string; mode?: string };
    expect(arg.kind).toBe("argument");
    expect(arg.mode).toBe("case");
    const p = doc2.body.children[1] as { children?: Array<{ kind: string }> };
    const claim = assertDefined(p.children?.[0]) as { mode?: string; sameAs?: string };
    expect(claim.mode).toBe("restated");
    expect(claim.sameAs).toBe("C2");
  });
});
