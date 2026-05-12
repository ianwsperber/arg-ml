import { describe, expect, it } from "vitest";
import type { ArgMLDocument } from "../ast/document.js";
import type { ReaderOverlayDocument } from "../ast/overlay.js";
import { parse, parseArgML } from "../index.js";
import { runPropagateOn } from "./propagate.js";

function postOf(xml: string): ArgMLDocument {
  const r = parseArgML(xml);
  if (!r.document) throw new Error("parse failed");
  return r.document;
}
function overlayOf(xml: string): ReaderOverlayDocument {
  const r = parse(xml);
  if (!r.document || r.document.kind !== "reader-overlay") {
    throw new Error("overlay parse failed");
  }
  return r.document;
}

const POST = postOf(`<post xmlns="urn:argml:v1" id="my-post">
  <head>
    <metadata><title>t</title><author>a</author></metadata>
    <takeaways>
      <takeaway ref="C2" priority="primary"/>
      <takeaway ref="C3" priority="secondary"/>
    </takeaways>
  </head>
  <body><p>
    <claim id="C1" supports="C2">premise</claim>
    <claim id="C2">conclusion</claim>
    <claim id="C3">another</claim>
  </p></body>
</post>`);

const OVERLAY = overlayOf(`<reader-overlay xmlns="urn:argml:v1" reader="r">
  <imports><import prefix="p" doc="https://x.test/my-post"/></imports>
  <attitudes>
    <attitude target="p:C1" kind="reject" rejection-type="rebut"/>
    <attitude target="p:C3" kind="open"/>
  </attitudes>
</reader-overlay>`);

describe("runPropagateOn", () => {
  it("renders a text table by default with one row per takeaway", () => {
    const r = runPropagateOn(POST, OVERLAY);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain("Post:    my-post");
    expect(r.stdout).toContain("Prefix:  p");
    expect(r.stdout).toMatch(/C2.*primary.*blocked/);
    expect(r.stdout).toMatch(/C3.*secondary.*provisional/);
  });

  it("emits machine-readable JSON when --format json", () => {
    const r = runPropagateOn(POST, OVERLAY, { format: "json" });
    expect(r.exitCode).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.post).toBe("my-post");
    expect(parsed.postPrefix).toBe("p");
    const byId = new Map<string, { status: string }>(
      (parsed.takeaways as Array<{ id: string; status: string }>).map((t) => [t.id, t]),
    );
    expect(byId.get("C2")?.status).toBe("blocked");
    expect(byId.get("C3")?.status).toBe("provisional");
  });

  it("honors --prefix to override auto-detection", () => {
    const altOverlay = overlayOf(`<reader-overlay xmlns="urn:argml:v1" reader="r">
      <imports><import prefix="custom" doc="https://elsewhere.test/different"/></imports>
      <attitudes>
        <attitude target="custom:C1" kind="reject" rejection-type="rebut"/>
      </attitudes>
    </reader-overlay>`);
    // Without override: no matching prefix.
    const r1 = runPropagateOn(POST, altOverlay);
    expect(r1.stdout).toContain("note (PROP001)");
    // With override: prefix is forced.
    const r2 = runPropagateOn(POST, altOverlay, { prefix: "custom" });
    expect(r2.stdout).toContain("Prefix:  custom");
    expect(r2.stdout).toMatch(/C2.*blocked/);
  });
});
