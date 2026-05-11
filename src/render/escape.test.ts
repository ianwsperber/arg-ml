import { describe, expect, it } from "vitest";
import { escapeAttr, escapeText } from "./escape.js";

describe("escapeText", () => {
  it("passes through plain text unchanged", () => {
    expect(escapeText("hello world")).toBe("hello world");
  });

  it("escapes &, <, >", () => {
    expect(escapeText("a & b < c > d")).toBe("a &amp; b &lt; c &gt; d");
  });

  it("does not escape quotes (they are safe in text content)", () => {
    expect(escapeText(`"single" and 'double'`)).toBe(`"single" and 'double'`);
  });

  it("escapes a <script> injection attempt", () => {
    expect(escapeText("<script>alert('x')</script>")).toBe(
      "&lt;script&gt;alert('x')&lt;/script&gt;",
    );
  });
});

describe("escapeAttr", () => {
  it("passes through plain text unchanged", () => {
    expect(escapeAttr("hello world")).toBe("hello world");
  });

  it("escapes &, <, >, double-quote, single-quote", () => {
    expect(escapeAttr(`a & b < c > d " e ' f`)).toBe("a &amp; b &lt; c &gt; d &quot; e &#39; f");
  });

  it("safely encodes attribute-injection attempts", () => {
    expect(escapeAttr(`" onclick="x`)).toBe("&quot; onclick=&quot;x");
  });
});
