import { describe, expect, it } from "vitest";
import { parseReaderOverlay, validateOverlay } from "../index.js";

function assertDefined<T>(v: T | null | undefined): T {
  if (v === null || v === undefined) throw new Error("expected defined value");
  return v;
}

function validate(xml: string): string[] {
  const doc = assertDefined(parseReaderOverlay(xml).document);
  return validateOverlay(doc).map((d) => d.code);
}

function wrap(body: string, opts: { imports?: string } = {}): string {
  const imports = opts.imports ?? '<import prefix="p" doc="https://example.org/p"/>';
  return `<reader-overlay xmlns="urn:argml:v1" reader="r"><imports>${imports}</imports>${body}</reader-overlay>`;
}

describe("validateOverlay", () => {
  it("clean overlay produces no diagnostics", () => {
    const codes = validate(
      wrap(`<attitudes>
        <attitude target="p:C1" kind="accept" credence="confident"/>
        <attitude target="p:C2" kind="reject" rejection-type="undermine"/>
        <attitude target="p:C3" kind="open"/>
      </attitudes><substitutions>
        <substitution target="p:t1" use="p:t2"/>
      </substitutions>`),
    );
    expect(codes).toEqual([]);
  });

  it("OVERLAY001: duplicate attitudes targeting the same id", () => {
    const codes = validate(
      wrap(`<attitudes>
        <attitude target="p:C1" kind="accept"/>
        <attitude target="p:C1" kind="reject" rejection-type="rebut"/>
      </attitudes><substitutions/>`),
    );
    expect(codes).toContain("OVERLAY001");
  });

  it("OVERLAY002: reject attitude without rejection-type", () => {
    const codes = validate(
      wrap(`<attitudes><attitude target="p:C1" kind="reject"/></attitudes><substitutions/>`),
    );
    expect(codes).toContain("OVERLAY002");
  });

  it("OVERLAY003: accept attitude carrying rejection-type", () => {
    const codes = validate(
      wrap(
        `<attitudes><attitude target="p:C1" kind="accept" rejection-type="rebut"/></attitudes><substitutions/>`,
      ),
    );
    expect(codes).toContain("OVERLAY003");
  });

  it("OVERLAY004: attitude target uses an undeclared prefix", () => {
    const codes = validate(
      wrap(`<attitudes><attitude target="zzz:C1" kind="accept"/></attitudes><substitutions/>`),
    );
    expect(codes).toContain("OVERLAY004");
  });

  it("OVERLAY005: attitude target has no prefix segment", () => {
    const codes = validate(
      wrap(`<attitudes><attitude target="C1" kind="accept"/></attitudes><substitutions/>`),
    );
    expect(codes).toContain("OVERLAY005");
  });

  it("OVERLAY006: substitution use uses an undeclared prefix", () => {
    const codes = validate(
      wrap(`<attitudes/><substitutions><substitution target="p:t1" use="zzz:t2"/></substitutions>`),
    );
    expect(codes).toContain("OVERLAY006");
  });

  it("OVERLAY007: duplicate substitution targets", () => {
    const codes = validate(
      wrap(`<attitudes/><substitutions>
        <substitution target="p:t1" use="p:t2"/>
        <substitution target="p:t1" use="p:t3"/>
      </substitutions>`),
    );
    expect(codes).toContain("OVERLAY007");
  });

  it("OVERLAY008: numeric credence outside [0, 1]", () => {
    const codes = validate(
      wrap(
        `<attitudes><attitude target="p:C1" kind="accept" credence="1.5"/></attitudes><substitutions/>`,
      ),
    );
    expect(codes).toContain("OVERLAY008");
  });

  it("OVERLAY008: numeric credence with spurious precision", () => {
    const codes = validate(
      wrap(
        `<attitudes><attitude target="p:C1" kind="accept" credence="0.12345"/></attitudes><substitutions/>`,
      ),
    );
    expect(codes).toContain("OVERLAY008");
  });
});
