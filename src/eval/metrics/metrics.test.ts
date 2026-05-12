import { describe, expect, it } from "vitest";
import { parseArgML } from "../../parser/parse.js";
import { headEditDistance } from "./edit-distance.js";
import { bodySpanF1 } from "./span-f1.js";
import { conservatism, coverage, structuralCounts } from "./unsupervised.js";

function parse(xml: string) {
  const r = parseArgML(xml);
  if (!r.document) throw new Error("parse failed");
  return r.document;
}

function wrap(head: string, body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<post xmlns="urn:argml:v1" id="p">${head}${body}</post>`;
}

describe("headEditDistance", () => {
  it("returns 0 for identical heads", () => {
    const doc = parse(
      wrap(
        `<head><metadata><title>T</title></metadata>
         <terms><term id="t1"><gloss>g</gloss></term></terms></head>`,
        "<body><p>x</p></body>",
      ),
    );
    expect(headEditDistance(doc, doc)).toBe(0);
  });

  it("registers distance when terms differ", () => {
    const a = parse(
      wrap(
        `<head><metadata><title>T</title></metadata>
         <terms><term id="t1"><gloss>g</gloss></term></terms></head>`,
        "<body><p>x</p></body>",
      ),
    );
    const b = parse(
      wrap(
        `<head><metadata><title>T</title></metadata>
         <terms><term id="t2"><gloss>g</gloss></term></terms></head>`,
        "<body><p>x</p></body>",
      ),
    );
    expect(headEditDistance(a, b)).toBeGreaterThan(0);
  });
});

describe("bodySpanF1", () => {
  it("scores 1.0 when actual and gold mark the same spans", () => {
    const xml = wrap(
      `<head><metadata><title>T</title></metadata>
       <terms><term id="phys"><gloss>g</gloss></term></terms></head>`,
      `<body><p>The author argues for <term ref="phys">physicalism</term>.</p>
       <p><claim id="C1">a strong claim</claim></p></body>`,
    );
    const doc = parse(xml);
    const r = bodySpanF1(doc, doc);
    expect(r.f1).toBe(1);
  });

  it("scores 0 when nothing matches", () => {
    const a = parse(
      wrap(
        "<head><metadata><title>T</title></metadata></head>",
        `<body><p><claim id="C1">alpha</claim></p></body>`,
      ),
    );
    const b = parse(
      wrap(
        "<head><metadata><title>T</title></metadata></head>",
        `<body><p><claim id="C1">beta</claim></p></body>`,
      ),
    );
    expect(bodySpanF1(a, b).f1).toBe(0);
  });
});

describe("structuralCounts + conservatism + coverage", () => {
  it("counts heads + body elements", () => {
    const doc = parse(
      wrap(
        `<head><metadata><title>T</title></metadata>
         <terms><term id="t1"><gloss>g</gloss></term></terms>
         <assumptions><assumption id="a1">a</assumption></assumptions></head>`,
        `<body><p><claim id="C1" credence="confident">strong</claim></p></body>`,
      ),
    );
    const counts = structuralCounts(doc);
    expect(counts).toMatchObject({ terms: 1, claims: 1, assumptions: 1 });
    const cons = conservatism(doc, "the strong claim about something");
    expect(cons.claimsPer1kWords).toBeGreaterThan(0);
    const cov = coverage(doc, "I am confident that strong");
    expect(cov.claimsWithCredence).toBe(1);
  });
});
