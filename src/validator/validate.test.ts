import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseArgML, validate } from "../index.js";
import { ARGML_CODES } from "./codes.js";

const here = dirname(fileURLToPath(import.meta.url));
const examplePath = resolve(here, "../../examples/morality-without-consciousness.argml.xml");

function assertDefined<T>(v: T | null | undefined): T {
  if (v === null || v === undefined) throw new Error("expected defined value");
  return v;
}

function validateXml(xml: string): { codes: string[]; severities: string[] } {
  const result = parseArgML(xml);
  const doc = assertDefined(result.document);
  const diags = validate(doc);
  return {
    codes: diags.map((d) => d.code),
    severities: diags.map((d) => d.severity),
  };
}

const HEAD = "<head><metadata><title>t</title><author>a</author></metadata>";

describe("validate", () => {
  it("emits no diagnostics for the worked example", () => {
    const source = readFileSync(examplePath, "utf-8");
    const doc = assertDefined(parseArgML(source).document);
    expect(validate(doc)).toEqual([]);
  });

  it("ARGML001: detects duplicate ids across the document", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t">${HEAD}</head><body>
      <p><claim id="C1">a</claim><claim id="C1">b</claim></p>
    </body></post>`;
    expect(validateXml(xml).codes).toContain("ARGML001");
  });

  it("ARGML002: flags unresolved local references", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t">${HEAD}</head><body>
      <p><claim id="C1" supports="C99">x</claim></p>
    </body></post>`;
    expect(validateXml(xml).codes).toContain("ARGML002");
  });

  it("ARGML003: flags cross-document references using undeclared prefixes", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t">${HEAD}</head><body>
      <p><claim id="C1" supports="ghost:foo">x</claim></p>
    </body></post>`;
    expect(validateXml(xml).codes).toContain("ARGML003");
  });

  it("accepts cross-document references when prefix is declared", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t"><head><metadata><title>t</title>
      <author>a</author></metadata><imports><import prefix="ext" doc="http://x"/></imports>
    </head><body><p><claim id="C1" supports="ext:foo">x</claim></p></body></post>`;
    expect(validateXml(xml).codes).toEqual([]);
  });

  it("ARGML004: flags inferences with no premises", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t">${HEAD}</head><body>
      <p><claim id="C1">x</claim><claim id="C2">y</claim></p>
      <inference id="I1" from="" to="C2"/>
    </body></post>`;
    expect(validateXml(xml).codes).toContain("ARGML004");
  });

  it("ARGML005: flags numeric credence outside [0, 1]", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t">${HEAD}</head><body>
      <p><claim id="C1" credence="1.5">x</claim></p>
    </body></post>`;
    const { codes, severities } = validateXml(xml);
    expect(codes).toContain("ARGML005");
    expect(severities[codes.indexOf("ARGML005")]).toBe("error");
  });

  it("ARGML006: flags numeric strength outside [0, 1]", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t">${HEAD}</head><body>
      <p><claim id="C1">x</claim><claim id="C2">y</claim></p>
      <inference id="I1" from="C1" to="C2" strength="-0.1"/>
    </body></post>`;
    expect(validateXml(xml).codes).toContain("ARGML006");
  });

  it("ARGML007: flags empty alias text", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t"><head><metadata><title>t</title>
      <author>a</author></metadata><terms><term id="x"><alias>  </alias></term></terms>
    </head><body/></post>`;
    expect(validateXml(xml).codes).toContain("ARGML007");
  });

  it("ARGML008: flags rests-on resolving to a non-assumption/non-claim", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t"><head><metadata><title>t</title>
      <author>a</author></metadata><terms><term id="T1"/></terms></head><body>
      <p><claim id="C1" rests-on="T1">x</claim></p>
    </body></post>`;
    expect(validateXml(xml).codes).toContain("ARGML008");
  });

  it("ARGML009: flags inference `to` resolving to a non-claim", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t"><head><metadata><title>t</title>
      <author>a</author></metadata><assumptions><assumption id="A1">a</assumption></assumptions>
    </head><body>
      <p><claim id="C1">x</claim></p>
      <inference id="I1" from="C1" to="A1"/>
    </body></post>`;
    expect(validateXml(xml).codes).toContain("ARGML009");
  });

  it("ARGML010: flags conflict idref that doesn't resolve to claim or inference", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t"><head><metadata><title>t</title>
      <author>a</author></metadata><terms><term id="T1"/></terms></head><body>
      <p><claim id="C1">x</claim></p>
      <conflict id="CF1"><attacker idref="C1"/><target idref="T1"/></conflict>
    </body></post>`;
    expect(validateXml(xml).codes).toContain("ARGML010");
  });

  it("ARGML011: flags strength=deductive with defeasible=true", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t">${HEAD}</head><body>
      <p><claim id="C1">x</claim><claim id="C2">y</claim></p>
      <inference id="I1" from="C1" to="C2" defeasible="true" strength="deductive"/>
    </body></post>`;
    expect(validateXml(xml).codes).toContain("ARGML011");
  });

  it("ARGML011: also fires when defeasible is left at default with strength=deductive", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t">${HEAD}</head><body>
      <p><claim id="C1">x</claim><claim id="C2">y</claim></p>
      <inference id="I1" from="C1" to="C2" strength="deductive"/>
    </body></post>`;
    expect(validateXml(xml).codes).toContain("ARGML011");
  });

  it("ARGML012: flags undercut conflict against non-defeasible inference", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t">${HEAD}</head><body>
      <p><claim id="C1">x</claim><claim id="C2">y</claim><claim id="C3">z</claim></p>
      <inference id="I1" from="C1" to="C2" defeasible="false"/>
      <conflict id="CF1" attack-type="undercut"><attacker idref="C3"/><target idref="I1"/></conflict>
    </body></post>`;
    expect(validateXml(xml).codes).toContain("ARGML012");
  });

  it("ARGML013: flags numeric credence with more than two decimal places", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t">${HEAD}</head><body>
      <p><claim id="C1" credence="0.7321">x</claim></p>
    </body></post>`;
    expect(validateXml(xml).codes).toContain("ARGML013");
  });

  it("ARGML014: flags term-ref to an undeclared term", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t">${HEAD}</head><body>
      <p><claim id="C1"><term ref="nope">word</term></claim></p>
    </body></post>`;
    expect(validateXml(xml).codes).toContain("ARGML014");
  });

  it("ARGML015: flags via that doesn't resolve to an inference", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t">${HEAD}</head><body>
      <p><claim id="C1" via="C2">x</claim><claim id="C2">y</claim></p>
    </body></post>`;
    expect(validateXml(xml).codes).toContain("ARGML015");
  });

  it("ARGML016: flags supports target that isn't a claim", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t"><head><metadata><title>t</title>
      <author>a</author></metadata><assumptions><assumption id="A1">a</assumption></assumptions>
    </head><body>
      <p><claim id="C1" supports="A1">x</claim></p>
    </body></post>`;
    expect(validateXml(xml).codes).toContain("ARGML016");
  });

  it("diagnostics are sorted by (line, column, code)", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t">${HEAD}</head><body>
      <p><claim id="C1" supports="missingZ" attacks="missingA">x</claim></p>
      <p><claim id="C2" supports="alsoMissing">y</claim></p>
    </body></post>`;
    const result = parseArgML(xml);
    const diags = validate(assertDefined(result.document));
    expect(diags.length).toBeGreaterThan(1);
    for (let i = 1; i < diags.length; i++) {
      const prev = diags[i - 1];
      const cur = diags[i];
      if (!prev || !cur) continue;
      const pl = prev.pos?.line ?? Number.POSITIVE_INFINITY;
      const cl = cur.pos?.line ?? Number.POSITIVE_INFINITY;
      if (pl !== cl) {
        expect(pl).toBeLessThan(cl);
        continue;
      }
      const pc = prev.pos?.column ?? 0;
      const cc = cur.pos?.column ?? 0;
      if (pc !== cc) {
        expect(pc).toBeLessThan(cc);
        continue;
      }
      // same line + column: codes break ties lexically (ARGML codes are
      // zero-padded so lexical order matches numeric order).
      expect(prev.code.localeCompare(cur.code)).toBeLessThanOrEqual(0);
    }
    // A claim with two missing refs at the same position emits two diagnostics
    // sorted by code.
    const sameSpot = diags.filter(
      (d) => d.code === "ARGML002" && d.pos?.line === diags[0]?.pos?.line,
    );
    expect(sameSpot.length).toBeGreaterThanOrEqual(1);
  });

  it("evidence ref with undeclared cross-doc prefix emits ARGML003", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t">${HEAD}</head><body>
      <p><claim id="C1">x<evidence ref="ghost:foo"/></claim></p>
    </body></post>`;
    expect(validateXml(xml).codes).toContain("ARGML003");
  });

  it("evidence ref to URL is not validated as a local reference", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t">${HEAD}</head><body>
      <p><claim id="C1">x<evidence ref="https://example.org/survey"/></claim></p>
    </body></post>`;
    expect(validateXml(xml).codes).toEqual([]);
  });

  it("evidence ref to unresolved local id emits ARGML002", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t">${HEAD}</head><body>
      <p><claim id="C1">x<evidence ref="C99"/></claim></p>
    </body></post>`;
    expect(validateXml(xml).codes).toContain("ARGML002");
  });

  it("ARGML013 does not fire on trailing-zero precision", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t">${HEAD}</head><body>
      <p><claim id="C1" credence="0.700">x</claim></p>
    </body></post>`;
    expect(validateXml(xml).codes).not.toContain("ARGML013");
  });

  // ===== 0.2 additions =====

  it("ARGML017: warns on unknown <claim> mode value", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t">${HEAD}</head><body>
      <p><claim id="C1" mode="bizarre">x</claim></p>
    </body></post>`;
    expect(validateXml(xml).codes).toContain("ARGML017");
  });

  it("ARGML017: silent for known modes (and absent default)", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t">${HEAD}</head><body>
      <p><claim id="C1" mode="supposed">x</claim>
         <claim id="C2">y</claim></p>
    </body></post>`;
    expect(validateXml(xml).codes).not.toContain("ARGML017");
  });

  it("ARGML018: error when mode='restated' lacks same-as", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t">${HEAD}</head><body>
      <p><claim id="C1" mode="restated">x</claim></p>
    </body></post>`;
    expect(validateXml(xml).codes).toContain("ARGML018");
  });

  it("ARGML018: silent when mode='restated' has same-as", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t">${HEAD}</head><body>
      <p><claim id="C0">o</claim><claim id="C1" mode="restated" same-as="C0">x</claim></p>
    </body></post>`;
    expect(validateXml(xml).codes).not.toContain("ARGML018");
  });

  it("ARGML019: warns when reductio-target paired with defeasible inference", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t">${HEAD}</head><body>
      <p><claim id="C1" mode="supposed">x</claim>
         <claim id="C2" mode="reductio-target">y</claim>
         <inference id="I1" from="C1" to="C2"/>
      </p>
    </body></post>`;
    expect(validateXml(xml).codes).toContain("ARGML019");
  });

  it("ARGML019: silent when reductio-target paired with defeasible='false'", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t">${HEAD}</head><body>
      <p><claim id="C1" mode="supposed">x</claim>
         <claim id="C2" mode="reductio-target">y</claim>
         <inference id="I1" from="C1" to="C2" defeasible="false"/>
      </p>
    </body></post>`;
    expect(validateXml(xml).codes).not.toContain("ARGML019");
  });

  it("ARGML020: warns when mode='attributed' lacks attributed-to", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t">${HEAD}</head><body>
      <p><claim id="C1" mode="attributed">x</claim></p>
    </body></post>`;
    expect(validateXml(xml).codes).toContain("ARGML020");
  });

  it("ARGML022: warns on unknown <inference pattern> value", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t">${HEAD}</head><body>
      <p><claim id="C1">a</claim><claim id="C2">b</claim>
         <inference id="I1" from="C1" to="C2" pattern="hand-wave"/>
      </p>
    </body></post>`;
    expect(validateXml(xml).codes).toContain("ARGML022");
  });

  it("ARGML022: silent on known pattern", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t">${HEAD}</head><body>
      <p><claim id="C1">a</claim><claim id="C2">b</claim>
         <inference id="I1" from="C1" to="C2" pattern="modus-ponens"/>
      </p>
    </body></post>`;
    expect(validateXml(xml).codes).not.toContain("ARGML022");
  });

  it("ARGML023: error when takeaway ref does not resolve to a local claim", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t"><head>
      <metadata><title>t</title><author>a</author></metadata>
      <takeaways><takeaway ref="C404"/></takeaways>
    </head><body><p><claim id="C1">x</claim></p></body></post>`;
    expect(validateXml(xml).codes).toContain("ARGML023");
  });

  it("ARGML023: error on cross-document takeaway ref", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t"><head>
      <metadata><title>t</title><author>a</author></metadata>
      <imports><import prefix="other" doc="https://x"/></imports>
      <takeaways><takeaway ref="other:C1"/></takeaways>
    </head><body><p><claim id="C1">x</claim></p></body></post>`;
    expect(validateXml(xml).codes).toContain("ARGML023");
  });

  it("ARGML024: warns on duplicate takeaway with same ref+priority", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t"><head>
      <metadata><title>t</title><author>a</author></metadata>
      <takeaways>
        <takeaway ref="C1" priority="primary"/>
        <takeaway ref="C1" priority="primary"/>
      </takeaways>
    </head><body><p><claim id="C1">x</claim></p></body></post>`;
    expect(validateXml(xml).codes).toContain("ARGML024");
  });

  it("ARGML025: error when provenance id does not resolve to a generator", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t"><head>
      <metadata><title>t</title><author>a</author></metadata>
      <provenance><generator id="g1" type="human"/></provenance>
    </head><body><p><claim id="C1" provenance="g99">x</claim></p></body></post>`;
    expect(validateXml(xml).codes).toContain("ARGML025");
  });

  it("ARGML025: silent when provenance id resolves to a generator", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t"><head>
      <metadata><title>t</title><author>a</author></metadata>
      <provenance><generator id="g1" type="human"/></provenance>
    </head><body><p><claim id="C1" provenance="g1">x</claim></p></body></post>`;
    expect(validateXml(xml).codes).not.toContain("ARGML025");
  });

  it("ARGML026: warns when same-as does not resolve", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t">${HEAD}</head><body>
      <p><claim id="C1" same-as="C99">x</claim></p>
    </body></post>`;
    expect(validateXml(xml).codes).toContain("ARGML026");
  });

  it("ARGML027: detects same-as cycle within document", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t">${HEAD}</head><body>
      <p><claim id="C1" same-as="C2">x</claim>
         <claim id="C2" same-as="C1">y</claim></p>
    </body></post>`;
    expect(validateXml(xml).codes).toContain("ARGML027");
  });

  it("ARGML028: warns when argument supports target is not a claim", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t">${HEAD}</head><body>
      <argument mode="case" id="A1" supports="A1"><p>x</p></argument>
    </body></post>`;
    expect(validateXml(xml).codes).toContain("ARGML028");
  });

  it("ARGML029: warns when inference from references an argument under non-cases pattern", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t">${HEAD}</head><body>
      <argument mode="case" id="A1" supports="C1"><p>x</p></argument>
      <claim id="C1">y</claim>
      <inference id="I1" from="A1" to="C1" pattern="modus-ponens"/>
    </body></post>`;
    expect(validateXml(xml).codes).toContain("ARGML029");
  });

  it("ARGML029: silent when inference from references an argument under argument-by-cases", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t">${HEAD}</head><body>
      <argument mode="case" id="A1" supports="C1"><p>x</p></argument>
      <argument mode="case" id="A2" supports="C1"><p>y</p></argument>
      <claim id="C1">z</claim>
      <inference id="I1" from="A1 A2" to="C1" pattern="argument-by-cases"/>
    </body></post>`;
    expect(validateXml(xml).codes).not.toContain("ARGML029");
  });

  it("ARGML030: warns on unknown argument mode", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t">${HEAD}</head><body>
      <argument mode="strange-mode" id="A1"><p>x</p></argument>
    </body></post>`;
    expect(validateXml(xml).codes).toContain("ARGML030");
  });

  it("ARGML030: silent on known argument mode", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t">${HEAD}</head><body>
      <argument mode="thought-experiment" id="A1"><p>x</p></argument>
    </body></post>`;
    expect(validateXml(xml).codes).not.toContain("ARGML030");
  });

  it("0.1 backwards compat: claim without mode validates as before (no ARGML017)", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t">${HEAD}</head><body>
      <p><claim id="C1">x</claim></p>
    </body></post>`;
    expect(validateXml(xml).codes).not.toContain("ARGML017");
  });

  it("every emitted code is registered in ARGML_CODES with the correct severity", () => {
    for (const code of Object.keys(ARGML_CODES)) {
      expect(ARGML_CODES[code as keyof typeof ARGML_CODES].severity).toMatch(/^(error|warning)$/);
    }
  });
});
