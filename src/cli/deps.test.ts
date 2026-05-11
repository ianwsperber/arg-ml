import { describe, expect, it } from "vitest";
import { parseArgML } from "../index.js";
import { runDepsOn } from "./deps.js";

function parseOrThrow(xml: string) {
  const r = parseArgML(xml);
  if (!r.document) throw new Error("parse failed");
  return r.document;
}

describe("runDeps", () => {
  it("errors with exit 2 when target id is not found", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t">
      <head><metadata><title>t</title><author>a</author></metadata></head>
      <body><p><claim id="C1">x</claim></p></body>
    </post>`;
    const result = runDepsOn(parseOrThrow(xml), "MISSING");
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("not found");
  });

  it("renders a tree showing rests-on, supports, and supported-by relations", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t">
      <head>
        <metadata><title>t</title><author>a</author></metadata>
        <assumptions><assumption id="A1">a</assumption></assumptions>
      </head>
      <body><p>
        <claim id="C1" supports="C0" rests-on="A1" credence="confident">root</claim>
        <claim id="C2" supports="C1">a premise</claim>
        <claim id="C3" supports="C1">another premise</claim>
      </p></body>
    </post>`;
    const result = runDepsOn(parseOrThrow(xml), "C1");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("claim C1");
    expect(result.stdout).toContain("Supports");
    expect(result.stdout).toContain("Supported by");
    expect(result.stdout).toContain("C2");
    expect(result.stdout).toContain("C3");
    expect(result.stdout).toContain("A1");
    expect(result.stdout).toContain("C0");
  });

  it("marks cross-document references as external", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t">
      <head>
        <metadata><title>t</title><author>a</author></metadata>
        <imports><import prefix="ext" doc="https://x"/></imports>
      </head>
      <body><p>
        <claim id="C1" rests-on="ext:remote-claim">x</claim>
      </p></body>
    </post>`;
    const result = runDepsOn(parseOrThrow(xml), "C1");
    expect(result.stdout).toContain("ext:remote-claim");
    expect(result.stdout).toContain("[external]");
  });

  it("detects cycles in rests-on", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t">
      <head>
        <metadata><title>t</title><author>a</author></metadata>
      </head>
      <body><p>
        <claim id="C1" rests-on="C2">x</claim>
        <claim id="C2" rests-on="C1">y</claim>
      </p></body>
    </post>`;
    const result = runDepsOn(parseOrThrow(xml), "C1");
    expect(result.stdout).toContain("[cycle]");
  });
});
