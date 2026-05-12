import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseArgML } from "../index.js";
import { runValidate, runValidateOn, runValidatePair } from "./validate.js";

const here = dirname(fileURLToPath(import.meta.url));
const examplePath = resolve(here, "../../examples/morality-without-consciousness.argml.xml");
const overlayPath = resolve(here, "../../examples/morality-without-consciousness.overlay.xml");

const HEAD = "<head><metadata><title>t</title><author>a</author></metadata>";

describe("runValidate", () => {
  it("exits 0 with a clean summary for the worked example", () => {
    const result = runValidate(examplePath);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim().endsWith("0 errors, 0 warnings")).toBe(true);
  });

  it("exits 2 when the file cannot be read", () => {
    const result = runValidate("/no/such/file.argml.xml");
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("cannot read");
  });

  it("validates post and overlay together with --overlay (worked example is clean)", () => {
    const result = runValidatePair(examplePath, overlayPath);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("ok — all overlay targets resolve in the post.");
  });

  it("exits 1 when validation finds an error", () => {
    const xml = `<post xmlns="urn:argml:v1" id="t">${HEAD}</head><body>
      <p><claim id="C1">a</claim><claim id="C1">b</claim></p>
    </body></post>`;
    const parse = parseArgML(xml);
    const result = runValidateOn("inline.xml", { path: "inline.xml", source: xml, parse });
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toMatch(/ARGML001/);
    expect(result.stdout).toMatch(/1 error/);
  });
});
