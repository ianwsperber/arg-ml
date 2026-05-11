import { describe, expect, it } from "vitest";
import { countSeverities, formatDiagnostic, formatSummaryLine } from "./format.js";

describe("formatDiagnostic", () => {
  it("includes line:col when pos is present", () => {
    const out = formatDiagnostic("a.xml", {
      code: "ARGML001",
      severity: "error",
      message: "boom",
      pos: { offset: 0, line: 4, column: 7 },
    });
    expect(out).toBe("a.xml:4:7: error ARGML001 boom");
  });

  it("omits line:col when pos is missing", () => {
    const out = formatDiagnostic("a.xml", {
      code: "PARSE001",
      severity: "error",
      message: "x",
    });
    expect(out).toBe("a.xml: error PARSE001 x");
  });
});

describe("countSeverities", () => {
  it("counts errors and warnings", () => {
    expect(
      countSeverities([
        { code: "X", severity: "error", message: "" },
        { code: "X", severity: "warning", message: "" },
        { code: "X", severity: "error", message: "" },
      ]),
    ).toEqual({ errors: 2, warnings: 1 });
  });
});

describe("formatSummaryLine", () => {
  it("uses singular for 1", () => {
    expect(formatSummaryLine(1, 1)).toBe("1 error, 1 warning");
  });
  it("uses plural otherwise", () => {
    expect(formatSummaryLine(0, 2)).toBe("0 errors, 2 warnings");
  });
});
