import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runRender } from "./render.js";

const here = fileURLToPath(new URL(".", import.meta.url));
const examplePath = resolve(here, "../../examples/morality-without-consciousness.argml.xml");

describe("runRender", () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "argml-render-"));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("renders the worked example to stdout", () => {
    const result = runRender(examplePath, {});
    expect(result.exitCode).toBe(0);
    expect(result.stdout.startsWith("<!doctype html>")).toBe(true);
    expect(result.stdout).toContain("Morality without Consciousness");
  });

  it("writes HTML to --output", () => {
    const out = join(tmp, "out.html");
    const result = runRender(examplePath, { output: out });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(`wrote ${out}`);
    const written = readFileSync(out, "utf8");
    expect(written.startsWith("<!doctype html>")).toBe(true);
    expect(written).toContain('<script id="argml-source" type="application/xml">');
  });

  it("returns exit code 2 for a missing file", () => {
    const result = runRender(join(tmp, "missing.argml.xml"), {});
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("cannot read");
  });
});
