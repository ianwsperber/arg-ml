import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseArgML, serializeArgML } from "../index.js";

const here = dirname(fileURLToPath(import.meta.url));
const examplePath = resolve(here, "../../examples/morality-without-consciousness.argml.xml");

function stripPos<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(stripPos) as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === "pos") continue;
      out[k] = stripPos(v);
    }
    return out as T;
  }
  return value;
}

function assertDefined<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error("expected defined value");
  }
  return value;
}

describe("round-trip parse → serialize → parse", () => {
  it("structural equality (modulo source positions)", () => {
    const source = readFileSync(examplePath, "utf-8");
    const a = parseArgML(source);
    const aDoc = assertDefined(a.document);
    const xml = serializeArgML(aDoc);
    const b = parseArgML(xml);
    const bDoc = assertDefined(b.document);
    expect(stripPos(bDoc)).toEqual(stripPos(aDoc));
  });
});
