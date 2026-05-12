import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  parse,
  parseArgML,
  parseReaderOverlay,
  serializeReaderOverlay,
  validateAny,
  validateOverlay,
} from "../index.js";

function assertDefined<T>(v: T | null | undefined): T {
  if (v === null || v === undefined) throw new Error("expected defined value");
  return v;
}

const EXAMPLE_PATH = fileURLToPath(
  new URL("../../examples/morality-without-consciousness.overlay.xml", import.meta.url),
);

const MINIMAL = `<reader-overlay xmlns="urn:argml:v1" reader="r1" updated="2026-05-12">
  <imports>
    <import prefix="p" doc="https://example.org/p"/>
  </imports>
  <attitudes>
    <attitude target="p:C1" kind="accept"/>
    <attitude target="p:C2" kind="reject" rejection-type="undermine" credence="0.2">
      A note.
    </attitude>
    <attitude target="p:C3" kind="open"/>
  </attitudes>
  <substitutions>
    <substitution target="p:t1" use="p:t2">use t2 instead</substitution>
  </substitutions>
</reader-overlay>`;

describe("parseReaderOverlay", () => {
  it("parses a minimal overlay", () => {
    const result = parseReaderOverlay(MINIMAL);
    const doc = assertDefined(result.document);
    expect(doc.kind).toBe("reader-overlay");
    expect(doc.reader).toBe("r1");
    expect(doc.updated).toBe("2026-05-12");
    expect(doc.imports.imports).toHaveLength(1);
    expect(doc.attitudes).toHaveLength(3);
    expect(doc.substitutions).toHaveLength(1);

    const reject = doc.attitudes[1];
    expect(reject?.attitudeKind).toBe("reject");
    expect(reject?.rejectionType).toBe("undermine");
    expect(reject?.credence).toMatchObject({ kind: "numeric", value: 0.2 });
  });

  it("parses the spec Appendix B.2 example clean", () => {
    const xml = readFileSync(EXAMPLE_PATH, "utf8");
    const result = parseReaderOverlay(xml);
    const doc = assertDefined(result.document);
    expect(result.diagnostics).toEqual([]);
    expect(doc.reader).toBe("reader-example");
    expect(doc.attitudes).toHaveLength(6);
    expect(doc.substitutions).toHaveLength(1);
  });

  it("PARSE014: missing `reader` attribute", () => {
    const xml = `<reader-overlay xmlns="urn:argml:v1"><imports/><attitudes/><substitutions/></reader-overlay>`;
    const result = parseReaderOverlay(xml);
    expect(result.diagnostics.map((d) => d.code)).toContain("PARSE014");
  });

  it("PARSE015: missing `target` or `kind` on <attitude>", () => {
    const xml = `<reader-overlay xmlns="urn:argml:v1" reader="r"><imports/>
      <attitudes><attitude target="p:x"/></attitudes></reader-overlay>`;
    const result = parseReaderOverlay(xml);
    expect(result.diagnostics.map((d) => d.code)).toContain("PARSE015");
  });

  it("PARSE015: unknown `kind` value on <attitude>", () => {
    const xml = `<reader-overlay xmlns="urn:argml:v1" reader="r"><imports/>
      <attitudes><attitude target="p:x" kind="ambivalent"/></attitudes></reader-overlay>`;
    const result = parseReaderOverlay(xml);
    expect(result.diagnostics.map((d) => d.code)).toContain("PARSE015");
  });

  it("PARSE016: missing `target` or `use` on <substitution>", () => {
    const xml = `<reader-overlay xmlns="urn:argml:v1" reader="r"><imports/>
      <attitudes/><substitutions><substitution target="p:x"/></substitutions></reader-overlay>`;
    const result = parseReaderOverlay(xml);
    expect(result.diagnostics.map((d) => d.code)).toContain("PARSE016");
  });

  it("rejects a <post> root", () => {
    const xml = `<post xmlns="urn:argml:v1" id="p"><head><metadata/></head><body/></post>`;
    const result = parseReaderOverlay(xml);
    expect(result.document).toBeNull();
    expect(result.diagnostics.map((d) => d.code)).toContain("PARSE003");
  });
});

describe("parseArgML", () => {
  it("rejects a <reader-overlay> root", () => {
    const result = parseArgML(MINIMAL);
    expect(result.document).toBeNull();
    expect(result.diagnostics.map((d) => d.code)).toContain("PARSE003");
  });
});

describe("parse (dispatching)", () => {
  it("returns an overlay when the root is <reader-overlay>", () => {
    const result = parse(MINIMAL);
    const doc = assertDefined(result.document);
    expect(doc.kind).toBe("reader-overlay");
  });

  it("returns a post when the root is <post>", () => {
    const xml = `<post xmlns="urn:argml:v1" id="p"><head><metadata><title>t</title><author>a</author></metadata></head><body/></post>`;
    const result = parse(xml);
    const doc = assertDefined(result.document);
    expect(doc.kind).toBe("post");
  });
});

describe("serializeReaderOverlay (round-trip)", () => {
  it("re-parses to a structurally equivalent overlay", () => {
    const first = assertDefined(parseReaderOverlay(MINIMAL).document);
    const xml = serializeReaderOverlay(first);
    const second = assertDefined(parseReaderOverlay(xml).document);
    expect(second.reader).toBe(first.reader);
    expect(second.updated).toBe(first.updated);
    expect(second.imports.imports.map((i) => [i.prefix, i.doc])).toEqual(
      first.imports.imports.map((i) => [i.prefix, i.doc]),
    );
    expect(second.attitudes.map((a) => [a.target, a.attitudeKind, a.rejectionType])).toEqual(
      first.attitudes.map((a) => [a.target, a.attitudeKind, a.rejectionType]),
    );
    expect(second.substitutions.map((s) => [s.target, s.use])).toEqual(
      first.substitutions.map((s) => [s.target, s.use]),
    );
  });

  it("round-trips the spec Appendix B.2 example", () => {
    const xml = readFileSync(EXAMPLE_PATH, "utf8");
    const first = assertDefined(parseReaderOverlay(xml).document);
    const serialized = serializeReaderOverlay(first);
    const second = assertDefined(parseReaderOverlay(serialized).document);
    expect(second.attitudes).toHaveLength(first.attitudes.length);
    expect(second.substitutions).toHaveLength(first.substitutions.length);
  });
});

describe("validateOverlay / validateAny", () => {
  it("validates the Appendix B.2 example clean", () => {
    const xml = readFileSync(EXAMPLE_PATH, "utf8");
    const doc = assertDefined(parseReaderOverlay(xml).document);
    const diags = validateOverlay(doc);
    expect(diags.filter((d) => d.severity === "error")).toEqual([]);
  });

  it("validateAny dispatches on document kind", () => {
    const doc = assertDefined(parse(MINIMAL).document);
    const diags = validateAny(doc);
    expect(diags.filter((d) => d.severity === "error")).toEqual([]);
  });
});
