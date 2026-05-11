import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseArgML } from "../index.js";

const here = dirname(fileURLToPath(import.meta.url));
const examplePath = resolve(here, "../../examples/morality-without-consciousness.argml.xml");

function loadExample(): string {
  return readFileSync(examplePath, "utf-8");
}

function assertDefined<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error("expected defined value");
  }
  return value;
}

describe("parseArgML", () => {
  it("parses the worked example without errors", () => {
    const result = parseArgML(loadExample());
    expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    const doc = assertDefined(result.document);
    expect(doc.id).toBe("morality-without-consciousness");
    expect(doc.head.metadata.title).toBe("Morality without Consciousness");
    expect(doc.head.metadata.authors).toEqual(["IanWS"]);
    expect(doc.head.imports?.imports.map((i) => i.prefix)).toEqual(["linch", "seq", "sep"]);
    expect(doc.head.terms?.terms.map((t) => t.id)).toEqual([
      "consciousness",
      "physicalism",
      "dualism",
      "illusionism",
      "epiphenomenalism",
      "neurophysiology",
      "cognition",
      "intrinsic-view",
      "extrinsic-view",
      "c-particle",
      "preference",
      "monads",
    ]);
    expect(doc.head.assumptions?.assumptions.map((a) => a.id)).toEqual(["A1"]);
  });

  it("distinguishes declaration-form term from reference-form term", () => {
    const result = parseArgML(loadExample());
    const doc = assertDefined(result.document);
    const decls = assertDefined(doc.head.terms).terms;
    expect(decls.every((t) => t.kind === "term-decl")).toBe(true);
    let foundRef = false;
    const walk = (n: { kind: string; children?: unknown[] }): void => {
      if (n.kind === "term-ref") foundRef = true;
      const kids = Array.isArray(n.children) ? (n.children as { kind: string }[]) : [];
      for (const k of kids) walk(k as never);
    };
    for (const child of doc.body.children) walk(child as never);
    expect(foundRef).toBe(true);
  });

  it("splits space-separated id-list attributes", () => {
    const result = parseArgML(loadExample());
    const doc = assertDefined(result.document);
    const findInference = (
      nodes: ReadonlyArray<{ kind: string; id?: string; children?: unknown[] }>,
    ): { id: string; from: string[]; to: string } | undefined => {
      for (const n of nodes) {
        if (n.kind === "inference" && n.id === "I-3.1") {
          return n as never;
        }
        const kids = Array.isArray(n.children) ? (n.children as never[]) : [];
        const got = findInference(kids);
        if (got) return got;
      }
      return undefined;
    };
    const inf = assertDefined(findInference(doc.body.children as never[]));
    expect(inf.from).toEqual(["C3.5", "C3.7", "C3.8"]);
    expect(inf.to).toBe("C3.6");
  });

  it("parses credence buckets and numeric strengths correctly", () => {
    const xml = `<?xml version="1.0"?>
<post xmlns="urn:argml:v1" id="t">
  <head><metadata><title>t</title><author>a</author></metadata></head>
  <body>
    <p><claim id="C1" credence="0.7">x</claim></p>
    <p><claim id="C2" credence="confident">y</claim></p>
    <inference id="I1" from="C1" to="C2" strength="0.85"/>
    <inference id="I2" from="C1" to="C2" strength="moderate"/>
  </body>
</post>`;
    const result = parseArgML(xml);
    expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    const doc = assertDefined(result.document);
    const body = doc.body.children as Array<{
      kind: string;
      id?: string;
      credence?: { kind: string; value: unknown };
      strength?: { kind: string; value: unknown };
      children?: Array<{
        kind: string;
        id?: string;
        credence?: { kind: string; value: unknown };
      }>;
    }>;
    const p1 = assertDefined(body[0]);
    const c1 = assertDefined(p1.children?.[0]);
    expect(c1.credence).toEqual({ kind: "numeric", value: 0.7 });
    const p2 = assertDefined(body[1]);
    const c2 = assertDefined(p2.children?.[0]);
    expect(c2.credence).toEqual({ kind: "bucket", value: "confident" });
    const i1 = assertDefined(body[2]);
    expect(i1.strength).toEqual({ kind: "numeric", value: 0.85 });
    const i2 = assertDefined(body[3]);
    expect(i2.strength).toEqual({ kind: "bucket", value: "moderate" });
  });

  it("preserves whitespace inside prose-bearing elements", () => {
    const xml = `<?xml version="1.0"?>
<post xmlns="urn:argml:v1" id="t">
  <head><metadata><title>t</title><author>a</author></metadata></head>
  <body><p><claim id="C1">foo  bar</claim></p></body>
</post>`;
    const result = parseArgML(xml);
    const doc = assertDefined(result.document);
    const body = doc.body.children as Array<{
      children: { children: { text: string }[] }[];
    }>;
    const p = assertDefined(body[0]);
    const claim = assertDefined(p.children[0]);
    const text = assertDefined(claim.children[0]);
    expect(text.text).toBe("foo  bar");
  });

  it("emits PARSE001 on malformed XML and returns null document", () => {
    const result = parseArgML("<post xmlns='urn:argml:v1'><head>");
    expect(result.document).toBeNull();
    expect(result.diagnostics[0]?.code).toBe("PARSE001");
  });

  it("emits PARSE006 when <head> is missing <metadata>", () => {
    const xml = `<?xml version="1.0"?>
<post xmlns="urn:argml:v1" id="t"><head/><body/></post>`;
    const result = parseArgML(xml);
    expect(result.diagnostics.some((d) => d.code === "PARSE006")).toBe(true);
  });

  it("emits PARSE007 on malformed enum attribute values", () => {
    const xml = `<?xml version="1.0"?>
<post xmlns="urn:argml:v1" id="t">
  <head><metadata><title>t</title><author>a</author></metadata></head>
  <body>
    <p><claim id="C1" attack-type="rebutt" defeasible="yes">x</claim></p>
  </body>
</post>`;
    const result = parseArgML(xml);
    const codes = result.diagnostics.filter((d) => d.code === "PARSE007").map((d) => d.message);
    expect(codes.length).toBe(2);
    expect(codes.some((m) => m.includes("attack-type"))).toBe(true);
    expect(codes.some((m) => m.includes("defeasible"))).toBe(true);
    const doc = assertDefined(result.document);
    const body = doc.body.children as Array<{
      children: Array<{ attackType?: string; defeasible?: boolean }>;
    }>;
    const claim = assertDefined(body[0]?.children[0]);
    expect(claim.attackType).toBeUndefined();
    expect(claim.defeasible).toBeUndefined();
  });

  it("emits PARSE008 on non-integer heading level", () => {
    const xml = `<?xml version="1.0"?>
<post xmlns="urn:argml:v1" id="t">
  <head><metadata><title>t</title><author>a</author></metadata></head>
  <body><section><heading level="abc">H</heading></section></body>
</post>`;
    const result = parseArgML(xml);
    expect(result.diagnostics.some((d) => d.code === "PARSE008")).toBe(true);
  });

  it("emits PARSE009 when <conflict> is missing <attacker> or <target>", () => {
    const xml = `<?xml version="1.0"?>
<post xmlns="urn:argml:v1" id="t">
  <head><metadata><title>t</title><author>a</author></metadata></head>
  <body><conflict id="CF1"><target idref="C1"/></conflict></body>
</post>`;
    const result = parseArgML(xml);
    const msgs = result.diagnostics.filter((d) => d.code === "PARSE009").map((d) => d.message);
    expect(msgs.some((m) => m.includes("<attacker>"))).toBe(true);
  });

  it("emits PARSE002 on wrong namespace", () => {
    const xml = `<?xml version="1.0"?>
<post xmlns="urn:other" id="t"><head><metadata><title>t</title><author>a</author></metadata></head><body/></post>`;
    const result = parseArgML(xml);
    expect(result.document).toBeNull();
    expect(result.diagnostics[0]?.code).toBe("PARSE002");
  });
});
