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

describe("escape stateless across calls", () => {
  // Regression: when escapeText/escapeAttr used a /g regex with .test() short-circuit,
  // lastIndex carried between calls and silently skipped escaping on shorter inputs.
  it("escapeText escapes correctly on consecutive calls with varying lengths", () => {
    const long = "a long string with < at the end <";
    const short = "<x>";
    expect(escapeText(long)).toBe("a long string with &lt; at the end &lt;");
    expect(escapeText(short)).toBe("&lt;x&gt;");
    expect(escapeText(short)).toBe("&lt;x&gt;");
    expect(escapeText(long)).toBe("a long string with &lt; at the end &lt;");
  });

  it("escapeAttr escapes correctly on consecutive calls with varying lengths", () => {
    const long = `a long attribute value with " at the end "`;
    const short = `"x"`;
    expect(escapeAttr(long)).toBe("a long attribute value with &quot; at the end &quot;");
    expect(escapeAttr(short)).toBe("&quot;x&quot;");
    expect(escapeAttr(short)).toBe("&quot;x&quot;");
    expect(escapeAttr(long)).toBe("a long attribute value with &quot; at the end &quot;");
  });
});
