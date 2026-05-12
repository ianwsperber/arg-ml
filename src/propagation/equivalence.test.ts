import { describe, expect, it } from "vitest";
import { parseArgML } from "../index.js";
import { computeEquivalenceClasses } from "./equivalence.js";

function doc(xml: string) {
  const r = parseArgML(xml);
  if (!r.document) throw new Error(`parse failed: ${JSON.stringify(r.diagnostics)}`);
  return r.document;
}

describe("computeEquivalenceClasses", () => {
  it("groups two claims linked by same-as into one class", () => {
    const d = doc(`<post xmlns="urn:argml:v1" id="t">
      <head><metadata><title>t</title><author>a</author></metadata></head>
      <body><p>
        <claim id="C1">x</claim>
        <claim id="C2" mode="restated" same-as="C1">x'</claim>
      </p></body>
    </post>`);
    const eq = computeEquivalenceClasses(d);
    expect(eq.equivalent("C1", "C2")).toBe(true);
    expect([...eq.members("C1")].sort()).toEqual(["C1", "C2"]);
  });

  it("treats unrelated claims as singletons", () => {
    const d = doc(`<post xmlns="urn:argml:v1" id="t">
      <head><metadata><title>t</title><author>a</author></metadata></head>
      <body><p>
        <claim id="C1">a</claim>
        <claim id="C2">b</claim>
      </p></body>
    </post>`);
    const eq = computeEquivalenceClasses(d);
    expect(eq.equivalent("C1", "C2")).toBe(false);
    expect([...eq.members("C1")]).toEqual(["C1"]);
  });

  it("merges transitively: C3 same-as C2 same-as C1 form one class", () => {
    const d = doc(`<post xmlns="urn:argml:v1" id="t">
      <head><metadata><title>t</title><author>a</author></metadata></head>
      <body><p>
        <claim id="C1">a</claim>
        <claim id="C2" mode="restated" same-as="C1">a'</claim>
        <claim id="C3" mode="restated" same-as="C2">a''</claim>
      </p></body>
    </post>`);
    const eq = computeEquivalenceClasses(d);
    expect(eq.equivalent("C1", "C3")).toBe(true);
    expect([...eq.members("C3")].sort()).toEqual(["C1", "C2", "C3"]);
  });

  it("ignores cross-document same-as (prefix:id)", () => {
    const d = doc(`<post xmlns="urn:argml:v1" id="t">
      <head>
        <metadata><title>t</title><author>a</author></metadata>
        <imports><import prefix="ext" doc="https://x"/></imports>
      </head>
      <body><p>
        <claim id="C1" mode="restated" same-as="ext:other">x</claim>
      </p></body>
    </post>`);
    const eq = computeEquivalenceClasses(d);
    // C1 is its own class; the ext: reference is not merged locally.
    expect([...eq.members("C1")]).toEqual(["C1"]);
  });

  it("returns singleton for unknown ids without mutating state", () => {
    const d = doc(`<post xmlns="urn:argml:v1" id="t">
      <head><metadata><title>t</title><author>a</author></metadata></head>
      <body><p><claim id="C1">x</claim></p></body>
    </post>`);
    const eq = computeEquivalenceClasses(d);
    expect([...eq.members("missing")]).toEqual(["missing"]);
    expect(eq.classOf("missing")).toBe("missing");
  });
});
