import { describe, expect, it } from "vitest";
import { markdownToText } from "./markdown-to-text.js";
import { normalizeProse } from "./normalize.js";

function norm(s: string): string {
  return normalizeProse(markdownToText(s), { collapseAll: true });
}

describe("markdownToText", () => {
  it("strips ATX heading hashes", () => {
    expect(norm("# Title\n\nbody")).toBe("Title body");
    expect(norm("### Three deep")).toBe("Three deep");
  });

  it("preserves setext heading text and drops the underline", () => {
    expect(norm("Title\n=====\n\nbody")).toBe("Title body");
  });

  it("strips list bullets and ordered markers", () => {
    expect(norm("- one\n- two\n- three")).toBe("one two three");
    expect(norm("1. one\n2. two")).toBe("one two");
  });

  it("strips blockquote markers", () => {
    expect(norm("> quoted line\n> more quoted")).toBe("quoted line more quoted");
  });

  it("drops emphasis and strong marks but keeps text", () => {
    expect(norm("**bold** and *italic* and ***both***")).toBe("bold and italic and both");
    expect(norm("__strong__ and _em_")).toBe("strong and em");
  });

  it("unwraps inline links and images", () => {
    expect(norm("see [the docs](https://example.com)")).toBe("see the docs");
    expect(norm("![an image](x.png) caption")).toBe("an image caption");
  });

  it("unwraps reference links and drops definitions", () => {
    expect(norm("see [the docs][1]\n\n[1]: https://example.com")).toBe("see the docs");
  });

  it("preserves inline code text without backticks", () => {
    expect(norm("call `parseArgML` to start")).toBe("call parseArgML to start");
  });

  it("preserves fenced code block content verbatim", () => {
    expect(norm("```ts\nconst x = 1;\n```")).toBe("const x = 1;");
  });

  it("drops footnote markers, keeps body text", () => {
    expect(norm("a claim[^1] continues")).toBe("a claim continues");
  });

  it("drops HTML comments", () => {
    expect(norm("before <!-- secret --> after")).toBe("before after");
  });

  it("drops horizontal rules", () => {
    expect(norm("before\n\n---\n\nafter")).toBe("before after");
  });
});
