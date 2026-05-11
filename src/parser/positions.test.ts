import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseArgML } from "../index.js";

const here = dirname(fileURLToPath(import.meta.url));
const examplePath = resolve(here, "../../examples/morality-without-consciousness.argml.xml");

function assertDefined<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error("expected defined value");
  }
  return value;
}

describe("source positions", () => {
  it("points at the start tag of <claim>, <inference>, <term ref>", () => {
    const source = readFileSync(examplePath, "utf-8");
    const result = parseArgML(source);
    const doc = assertDefined(result.document);

    type AnyNode = {
      kind: string;
      id?: string;
      ref?: string;
      pos?: { offset: number };
      children?: AnyNode[];
      warrant?: AnyNode[];
    };
    const visited: AnyNode[] = [];
    const walk = (n: AnyNode): void => {
      visited.push(n);
      for (const k of n.children ?? []) walk(k);
      for (const k of n.warrant ?? []) walk(k);
    };
    for (const c of doc.body.children as AnyNode[]) walk(c);

    const claim = assertDefined(visited.find((n) => n.kind === "claim" && n.id === "C1.1"));
    const claimPos = assertDefined(claim.pos);
    expect(source.slice(claimPos.offset, claimPos.offset + 6)).toBe("<claim");

    const inf = assertDefined(visited.find((n) => n.kind === "inference" && n.id === "I2"));
    const infPos = assertDefined(inf.pos);
    expect(source.slice(infPos.offset, infPos.offset + 10)).toBe("<inference");

    const termRef = assertDefined(
      visited.find((n) => n.kind === "term-ref" && n.ref === "consciousness"),
    );
    const termPos = assertDefined(termRef.pos);
    expect(source.slice(termPos.offset, termPos.offset + 5)).toBe("<term");
  });
});
