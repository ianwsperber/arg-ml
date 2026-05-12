import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runOverlayShow } from "./overlay.js";
import { runSummary } from "./summary.js";
import { runValidate } from "./validate.js";

const here = dirname(fileURLToPath(import.meta.url));
const overlayPath = resolve(here, "../../examples/morality-without-consciousness.overlay.xml");
const postPath = resolve(here, "../../examples/morality-without-consciousness.argml.xml");

describe("overlay CLI", () => {
  it("runValidate accepts an overlay file and exits 0", () => {
    const result = runValidate(overlayPath);
    expect(result.exitCode).toBe(0);
  });

  it("runSummary prints reader + attitude counts for an overlay", () => {
    const result = runSummary(overlayPath);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Reader-overlay: reader-example");
    expect(result.stdout).toContain("Updated: 2026-05-12");
    expect(result.stdout).toContain("attitudes:");
    expect(result.stdout).toContain("substitutions:");
    expect(result.stdout).toContain("ian-mwc:A1");
  });

  it("runSummary still works on a post", () => {
    const result = runSummary(postPath);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/claims:\s+[1-9]/);
  });

  it("runOverlayShow tabulates attitudes and substitutions", () => {
    const result = runOverlayShow(overlayPath);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("TARGET");
    expect(result.stdout).toContain("KIND");
    expect(result.stdout).toContain("ian-mwc:I-3.1");
    expect(result.stdout).toContain("undercut");
    expect(result.stdout).toContain("ian-mwc:preference");
  });

  it("runOverlayShow refuses a <post> document", () => {
    const result = runOverlayShow(postPath);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("not a <reader-overlay>");
  });
});
