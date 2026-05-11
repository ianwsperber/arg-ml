import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseArgML } from "../index.js";
import { runSummary, runSummaryOn } from "./summary.js";

const here = dirname(fileURLToPath(import.meta.url));
const examplePath = resolve(here, "../../examples/morality-without-consciousness.argml.xml");

function parseOrThrow(xml: string) {
  const r = parseArgML(xml);
  if (!r.document) throw new Error("parse failed");
  return r.document;
}

describe("runSummary", () => {
  it("prints non-zero counts for the worked example", () => {
    const result = runSummary(examplePath);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/terms:\s+\d+/);
    expect(result.stdout).toMatch(/claims:\s+[1-9]/);
    expect(result.stdout).toMatch(/inferences:\s+[1-9]/);
    expect(result.stdout).toMatch(/assumptions:\s+[1-9]/);
  });

  it("lists cross-document references with their prefix-resolution status", () => {
    const result = runSummary(examplePath);
    expect(result.stdout).toContain("linch:");
    expect(result.stdout).toContain("sep:");
    expect(result.stdout).toContain("declared-prefix");
  });

  it("marks unknown prefixes", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t">
      <head><metadata><title>t</title><author>a</author></metadata>
        <imports><import prefix="known" doc="https://x"/></imports>
      </head>
      <body><p>
        <claim id="C1" supports="known:foo bar:baz">x</claim>
      </p></body>
    </post>`;
    const doc = parseOrThrow(xml);
    const result = runSummaryOn(doc);
    expect(result.stdout).toContain("known:foo");
    expect(result.stdout).toContain("declared-prefix");
    expect(result.stdout).toContain("bar:baz");
    expect(result.stdout).toContain("UNKNOWN PREFIX");
  });

  it("excludes URLs from cross-doc detection", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t">
      <head><metadata><title>t</title><author>a</author></metadata>
        <terms>
          <term id="x" canonical="https://example.com/x"/>
        </terms>
      </head>
      <body><p><claim id="C1">x</claim></p></body>
    </post>`;
    const doc = parseOrThrow(xml);
    const result = runSummaryOn(doc);
    expect(result.stdout).not.toContain("https://example.com/x");
  });
});
