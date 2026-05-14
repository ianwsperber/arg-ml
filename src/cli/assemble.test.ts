import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseArgML } from "../index.js";
import { runAssemble } from "./assemble.js";

const here = fileURLToPath(new URL(".", import.meta.url));
const mwcManifest = resolve(
  here,
  "../../examples/manifests/morality-without-consciousness.manifest.xml",
);
const mwcSource = resolve(here, "../../examples/consciousness-without-morality.md");

const hasPython3 = spawnSync("python3", ["--version"], { stdio: "ignore" }).status === 0;
const describeIfPython = hasPython3 ? describe : describe.skip;

const TINY_SOURCE = `[¶0.1] Hello world.

[¶0.2] This is a second paragraph with a key term in it.
`;

const TINY_MANIFEST_OK = `<?xml version="1.0" encoding="UTF-8"?>
<argml-manifest xmlns="urn:argml-manifest:v1" spec-version="0.2">
  <source>
    <title>Tiny</title>
    <author>Test</author>
    <date>2026-05-14</date>
  </source>
  <head>
    <metadata>
      <title>Tiny</title>
      <author>Test</author>
      <date>2026-05-14</date>
    </metadata>
    <provenance>
      <generator id="g-extract" type="llm" model="claude-opus-4.7" date="2026-05-14" role="extractor"/>
    </provenance>
    <terms>
      <term id="key-term" scope="local" provenance="g-extract">
        <gloss>A term defined for the test fixture.</gloss>
      </term>
    </terms>
  </head>
  <edits>
    <inline section="0" paragraph="2">
      <find>key term</find>
      <replace><term ref="key-term">key term</term></replace>
    </inline>
  </edits>
</argml-manifest>
`;

// A manifest whose <find> doesn't appear in the source — engine must abort
// with a precondition failure (exit code 1).
const TINY_MANIFEST_PRECOND_FAIL = `<?xml version="1.0" encoding="UTF-8"?>
<argml-manifest xmlns="urn:argml-manifest:v1" spec-version="0.2">
  <source>
    <title>Tiny</title>
    <author>Test</author>
    <date>2026-05-14</date>
  </source>
  <head>
    <metadata>
      <title>Tiny</title>
      <author>Test</author>
      <date>2026-05-14</date>
    </metadata>
    <provenance>
      <generator id="g-extract" type="llm" model="claude-opus-4.7" date="2026-05-14" role="extractor"/>
    </provenance>
  </head>
  <edits>
    <inline section="0" paragraph="2">
      <find>this text is definitely not in the source</find>
      <replace><term ref="missing">this text is definitely not in the source</term></replace>
    </inline>
  </edits>
</argml-manifest>
`;

describeIfPython("runAssemble", () => {
  let tmp: string;
  let manifestPath: string;
  let sourcePath: string;
  let outputPath: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "argml-assemble-test-"));
    manifestPath = join(tmp, "manifest.xml");
    sourcePath = join(tmp, "source.md");
    outputPath = join(tmp, "out.argml.xml");
    writeFileSync(sourcePath, TINY_SOURCE, "utf8");
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("happy path: assembles a tiny manifest into a valid-parsing ArgML file", () => {
    writeFileSync(manifestPath, TINY_MANIFEST_OK, "utf8");
    const result = runAssemble(manifestPath, sourcePath, { output: outputPath });
    expect(result.exitCode).toBe(0);
    expect(existsSync(outputPath)).toBe(true);
    const xml = readFileSync(outputPath, "utf8");
    expect(xml).toContain('<post xmlns="urn:argml:v1">');
    expect(xml).toContain('<term ref="key-term">key term</term>');
    // The output should be parseable as ArgML with no parse errors.
    const parse = parseArgML(xml);
    expect(parse.document).toBeTruthy();
    const errors = parse.diagnostics.filter((d) => d.severity === "error");
    expect(errors).toEqual([]);
  });

  it("precondition failure: missing find span aborts with exit code 1", () => {
    writeFileSync(manifestPath, TINY_MANIFEST_PRECOND_FAIL, "utf8");
    const result = runAssemble(manifestPath, sourcePath, { output: outputPath });
    expect(result.exitCode).toBe(1);
    // The engine streams its JSON error report to stderr via stdio inherit, so
    // we can't capture it here as a string — but we can verify the engine did
    // not produce an output file.
    expect(existsSync(outputPath)).toBe(false);
  });

  it("--validate: runs the validator on the assembled output and exits 0 when clean", () => {
    writeFileSync(manifestPath, TINY_MANIFEST_OK, "utf8");
    const result = runAssemble(manifestPath, sourcePath, {
      output: outputPath,
      validate: true,
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/0 errors/);
  });

  it("integration: assembles the MWC fixture and the output is valid ArgML", () => {
    // Skip if the bundled fixture is missing (e.g., partial checkout).
    if (!existsSync(mwcManifest) || !existsSync(mwcSource)) return;
    const result = runAssemble(mwcManifest, mwcSource, { output: outputPath });
    expect(result.exitCode).toBe(0);
    const xml = readFileSync(outputPath, "utf8");
    const parse = parseArgML(xml);
    expect(parse.document).toBeTruthy();
    const parseErrors = parse.diagnostics.filter((d) => d.severity === "error");
    expect(parseErrors).toEqual([]);
  });
});

// Always-run guard: if python3 isn't on PATH, runAssemble must return exit
// code 4 with a clear message — verify that path directly using a python
// stand-in that doesn't exist. We don't have a clean way to mock the spawn,
// so we just assert findPython's fallback by intercepting the case where
// neither python3 nor python resolves. This test runs only when both
// interpreters are absent (rare in CI), so we gate it accordingly.
const hasPython = spawnSync("python", ["--version"], { stdio: "ignore" }).status === 0;
const describeIfNoPython = !hasPython3 && !hasPython ? describe : describe.skip;

describeIfNoPython("runAssemble without python", () => {
  it("returns exit code 4 when no python interpreter is available", () => {
    const tmp = mkdtempSync(join(tmpdir(), "argml-assemble-test-"));
    try {
      const manifestPath = join(tmp, "manifest.xml");
      const sourcePath = join(tmp, "source.md");
      writeFileSync(manifestPath, TINY_MANIFEST_OK, "utf8");
      writeFileSync(sourcePath, TINY_SOURCE, "utf8");
      const result = runAssemble(manifestPath, sourcePath, {});
      expect(result.exitCode).toBe(4);
      expect(result.stderr).toContain("requires python3");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
