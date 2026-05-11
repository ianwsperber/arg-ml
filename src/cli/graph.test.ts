import { describe, expect, it } from "vitest";
import { parseArgML } from "../index.js";
import { buildGraph, runGraphOn } from "./graph.js";

function parseOrThrow(xml: string) {
  const r = parseArgML(xml);
  if (!r.document) throw new Error("parse failed");
  return r.document;
}

const SAMPLE = `<post xmlns="urn:argml:v1" id="t">
  <head>
    <metadata><title>t</title><author>a</author></metadata>
    <assumptions><assumption id="A1">a</assumption></assumptions>
  </head>
  <body><p>
    <claim id="C1" rests-on="A1" credence="confident">root</claim>
    <claim id="C2" supports="C1" attacks="C1" attack-type="undermine">x</claim>
    <inference id="I1" from="C2" to="C1" strength="moderate"/>
  </p></body>
</post>`;

describe("buildGraph", () => {
  it("emits nodes for claims, assumptions, and inferences", () => {
    const g = buildGraph(parseOrThrow(SAMPLE));
    const kinds = g.nodes.map((n) => `${n.kind}:${n.id}`).sort();
    expect(kinds).toEqual(["assumption:A1", "claim:C1", "claim:C2", "inference:I1"].sort());
  });

  it("emits supports, attacks, rests-on, and inference edges", () => {
    const g = buildGraph(parseOrThrow(SAMPLE));
    const kinds = new Set(g.edges.map((e) => e.kind));
    expect(kinds.has("supports")).toBe(true);
    expect(kinds.has("attacks")).toBe(true);
    expect(kinds.has("rests-on")).toBe(true);
    expect(kinds.has("from")).toBe(true);
    expect(kinds.has("to")).toBe(true);
    const attack = g.edges.find((e) => e.kind === "attacks");
    expect(attack?.attackType).toBe("undermine");
  });

  it("includes external nodes for cross-doc references", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t">
      <head>
        <metadata><title>t</title><author>a</author></metadata>
        <imports><import prefix="ext" doc="https://x"/></imports>
      </head>
      <body><p>
        <claim id="C1" rests-on="ext:remote">x</claim>
      </p></body>
    </post>`;
    const g = buildGraph(parseOrThrow(xml));
    expect(g.nodes.find((n) => n.id === "ext:remote")?.kind).toBe("external");
  });
});

describe("runGraphOn", () => {
  it("emits valid JSON in cytoscape shape", () => {
    const result = runGraphOn(parseOrThrow(SAMPLE), "json");
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(Array.isArray(parsed.nodes)).toBe(true);
    expect(Array.isArray(parsed.edges)).toBe(true);
    expect(parsed.nodes[0].data).toBeDefined();
  });

  it("emits Graphviz DOT format", () => {
    const result = runGraphOn(parseOrThrow(SAMPLE), "dot");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("digraph argml");
    expect(result.stdout).toContain("shape=box");
    expect(result.stdout).toContain("shape=ellipse");
    expect(result.stdout).toContain("shape=diamond");
    expect(result.stdout).toContain("->");
  });
});
