import { describe, expect, it } from "vitest";
import { parseArgML } from "../index.js";
import { computeEquivalenceClasses } from "./equivalence.js";
import { buildPropagationGraph } from "./graph.js";

function doc(xml: string) {
  const r = parseArgML(xml);
  if (!r.document) throw new Error(`parse failed: ${JSON.stringify(r.diagnostics)}`);
  return r.document;
}

describe("buildPropagationGraph", () => {
  it("records claim.supports as a premise→consequent edge", () => {
    const d = doc(`<post xmlns="urn:argml:v1" id="t">
      <head><metadata><title>t</title><author>a</author></metadata></head>
      <body><p>
        <claim id="C1" supports="C2">premise</claim>
        <claim id="C2">conclusion</claim>
      </p></body>
    </post>`);
    const eq = computeEquivalenceClasses(d);
    const g = buildPropagationGraph(d, eq);
    expect([...g.ancestorsOf("C2")]).toEqual(["C1"]);
    expect([...g.ancestorsOf("C1")]).toEqual([]);
  });

  it("treats inference.to/from as ancestor edges", () => {
    const d = doc(`<post xmlns="urn:argml:v1" id="t">
      <head><metadata><title>t</title><author>a</author></metadata></head>
      <body><p>
        <claim id="P1">p1</claim>
        <claim id="P2">p2</claim>
        <claim id="C">conclusion</claim>
        <inference id="I1" from="P1 P2" to="C"/>
      </p></body>
    </post>`);
    const eq = computeEquivalenceClasses(d);
    const g = buildPropagationGraph(d, eq);
    expect([...g.ancestorsOf("C")]).toEqual(["I1"]);
    expect([...g.ancestorsOf("I1")].sort()).toEqual(["P1", "P2"]);
  });

  it("argument.supports creates an A→target ancestor edge", () => {
    const d = doc(`<post xmlns="urn:argml:v1" id="t">
      <head><metadata><title>t</title><author>a</author></metadata></head>
      <body>
        <argument id="A1" mode="case" supports="C1"><p>x</p></argument>
        <p><claim id="C1">target</claim></p>
      </body>
    </post>`);
    const eq = computeEquivalenceClasses(d);
    const g = buildPropagationGraph(d, eq);
    expect([...g.ancestorsOf("C1")]).toEqual(["A1"]);
    const a = g.nodes.get("A1");
    expect(a?.kind).toBe("argument");
    expect(a?.argumentSupports).toEqual(["C1"]);
  });

  it("rests-on creates an ancestor edge", () => {
    const d = doc(`<post xmlns="urn:argml:v1" id="t">
      <head>
        <metadata><title>t</title><author>a</author></metadata>
        <assumptions><assumption id="A1">x</assumption></assumptions>
      </head>
      <body><p>
        <claim id="C1" rests-on="A1">x</claim>
      </p></body>
    </post>`);
    const eq = computeEquivalenceClasses(d);
    const g = buildPropagationGraph(d, eq);
    expect([...g.ancestorsOf("C1")]).toEqual(["A1"]);
  });

  it("does not create an edge for claim.via (informational only)", () => {
    const d = doc(`<post xmlns="urn:argml:v1" id="t">
      <head><metadata><title>t</title><author>a</author></metadata></head>
      <body><p>
        <claim id="P1">p</claim>
        <claim id="C1">c1</claim>
        <claim id="C2" via="I1">c2 — note: via points at I1 but I1.to=C1</claim>
        <inference id="I1" from="P1" to="C1"/>
      </p></body>
    </post>`);
    const eq = computeEquivalenceClasses(d);
    const g = buildPropagationGraph(d, eq);
    // The authoritative edge is I1.to=C1.
    expect([...g.ancestorsOf("C1")]).toEqual(["I1"]);
    // C2.via=I1 is informational, so C2 has no inference ancestor.
    expect([...g.ancestorsOf("C2")]).toEqual([]);
  });

  it("merges ancestors across same-as classes", () => {
    const d = doc(`<post xmlns="urn:argml:v1" id="t">
      <head><metadata><title>t</title><author>a</author></metadata></head>
      <body><p>
        <claim id="C1" supports="C2">premise</claim>
        <claim id="C2">original</claim>
        <claim id="C3" mode="restated" same-as="C2">restated</claim>
      </p></body>
    </post>`);
    const eq = computeEquivalenceClasses(d);
    const g = buildPropagationGraph(d, eq);
    // C3 inherits C2's ancestors via same-as merging.
    expect([...g.ancestorsOf("C3")]).toEqual(["C1"]);
    expect([...g.ancestorsOf("C2")]).toEqual(["C1"]);
  });

  it("drops cross-document edges", () => {
    const d = doc(`<post xmlns="urn:argml:v1" id="t">
      <head>
        <metadata><title>t</title><author>a</author></metadata>
        <imports><import prefix="ext" doc="https://x"/></imports>
      </head>
      <body><p>
        <claim id="C1" rests-on="ext:remote">x</claim>
      </p></body>
    </post>`);
    const eq = computeEquivalenceClasses(d);
    const g = buildPropagationGraph(d, eq);
    expect([...g.ancestorsOf("C1")]).toEqual([]);
  });
});
