import { describe, expect, it } from "vitest";
import { parseArgML } from "../parser/parse.js";
import { verbatimCheck } from "./check.js";

function parse(xml: string) {
  const r = parseArgML(xml);
  if (!r.document) throw new Error("parse failed");
  return r.document;
}

function wrap(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<post xmlns="urn:argml:v1" id="p"><head><metadata><title>t</title></metadata></head>
<body>${body}</body></post>`;
}

describe("verbatimCheck", () => {
  it("passes when stripped output matches markdown source", () => {
    const md = "The author argues for **physicalism**.";
    const doc = parse(wrap("<p>The author argues for physicalism.</p>"));
    const r = verbatimCheck(md, doc);
    expect(r.ok).toBe(true);
    expect(r.diagnostics).toHaveLength(0);
  });

  it("passes when ArgML inline elements wrap original prose unchanged", () => {
    const md = "The author argues for **physicalism** about the mind.";
    const doc = parse(
      wrap(
        `<p>The author argues for <term ref="physicalism">physicalism</term> about the mind.</p>`,
      ),
    );
    expect(verbatimCheck(md, doc).ok).toBe(true);
  });

  it("passes across an ATX heading + paragraph", () => {
    const md = "# Section\n\nbody prose here.";
    const doc = parse(
      wrap(`<section><heading level="1">Section</heading><p>body prose here.</p></section>`),
    );
    expect(verbatimCheck(md, doc).ok).toBe(true);
  });

  it("fails when the LLM substitutes a word", () => {
    const md = "The author argues for physicalism.";
    const doc = parse(wrap("<p>The author argues for materialism.</p>"));
    const r = verbatimCheck(md, doc);
    expect(r.ok).toBe(false);
    expect(r.diagnostics[0]?.code).toBe("VERBATIM001");
    expect(r.diagnostics[0]?.message).toMatch(/physicalism.*materialism/);
  });

  it("fails when the LLM drops a word", () => {
    const md = "The author argues strongly for physicalism.";
    const doc = parse(wrap("<p>The author argues for physicalism.</p>"));
    const r = verbatimCheck(md, doc);
    expect(r.ok).toBe(false);
  });

  it("fails when the LLM inserts new prose", () => {
    const md = "The author argues for physicalism.";
    const doc = parse(wrap("<p>The author argues for physicalism, and this is important.</p>"));
    expect(verbatimCheck(md, doc).ok).toBe(false);
  });

  it("normalizes smart quotes and dashes between source and output", () => {
    const md = "“Phenomenal” consciousness — see SEP.";
    const doc = parse(wrap(`<p>"Phenomenal" consciousness - see SEP.</p>`));
    expect(verbatimCheck(md, doc).ok).toBe(true);
  });

  it("ignores paragraph re-wrapping by the LLM", () => {
    const md = "one. two. three.";
    const doc = parse(wrap("<p>one.</p><p>two.</p><p>three.</p>"));
    expect(verbatimCheck(md, doc).ok).toBe(true);
  });
});
