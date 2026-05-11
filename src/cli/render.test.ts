import { describe, expect, it } from "vitest";
import { runRender } from "./render.js";

describe("runRender", () => {
  it("prints a stub message and exits 0", () => {
    const result = runRender("anything.argml.xml", {});
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("not yet implemented");
  });
});
