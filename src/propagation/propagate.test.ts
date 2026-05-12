import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ReaderOverlayDocument } from "../ast/overlay.js";
import { parse, parseArgML } from "../index.js";
import { propagate } from "./propagate.js";

const SAMPLE_POST = readFileSync(
  path.resolve(__dirname, "../../examples/morality-without-consciousness.argml.xml"),
  "utf8",
);
const SAMPLE_OVERLAY = readFileSync(
  path.resolve(__dirname, "../../examples/morality-without-consciousness.overlay.xml"),
  "utf8",
);

function doc(xml: string) {
  const r = parseArgML(xml);
  if (!r.document) throw new Error(`parse failed: ${JSON.stringify(r.diagnostics)}`);
  return r.document;
}

function overlay(xml: string): ReaderOverlayDocument {
  const r = parse(xml);
  if (!r.document || r.document.kind !== "reader-overlay") {
    throw new Error(`overlay parse failed: ${JSON.stringify(r.diagnostics)}`);
  }
  return r.document;
}

const TINY_POST = (extraAttitudes = ""): string =>
  `<post xmlns="urn:argml:v1" id="t">
    <head>
      <metadata><title>t</title><author>a</author></metadata>
      <assumptions><assumption id="A1">x</assumption></assumptions>
      <takeaways><takeaway ref="C2" priority="primary"/></takeaways>
    </head>
    <body><p>
      <claim id="C1" supports="C2" rests-on="A1">premise</claim>
      <claim id="C2">conclusion</claim>
      ${extraAttitudes}
    </p></body>
  </post>`;

const TINY_OVERLAY = (...atts: string[]): string =>
  `<reader-overlay xmlns="urn:argml:v1" reader="r" updated="2026-05-12">
    <imports><import prefix="p" doc="https://x.test/t"/></imports>
    <attitudes>${atts.join("\n")}</attitudes>
  </reader-overlay>`;

describe("propagate (spec §13.5)", () => {
  it("returns `supported` when no attitudes touch the ancestry", () => {
    const r = propagate(doc(TINY_POST()), overlay(TINY_OVERLAY()));
    expect(r.takeaways).toHaveLength(1);
    expect(r.takeaways[0]).toMatchObject({ id: "C2", status: "supported" });
  });

  it("returns `endorsed` when the takeaway itself is accepted and no rejection/open", () => {
    const r = propagate(
      doc(TINY_POST()),
      overlay(TINY_OVERLAY(`<attitude target="p:C2" kind="accept"/>`)),
    );
    expect(r.takeaways[0]).toMatchObject({ id: "C2", status: "endorsed", accepted: true });
  });

  it("returns `provisional` when an ancestor is `open`", () => {
    const r = propagate(
      doc(TINY_POST()),
      overlay(TINY_OVERLAY(`<attitude target="p:C1" kind="open"/>`)),
    );
    expect(r.takeaways[0]).toMatchObject({
      id: "C2",
      status: "provisional",
      openAncestors: ["C1"],
    });
  });

  it("returns `blocked` when an asserted claim ancestor is rejected", () => {
    const r = propagate(
      doc(TINY_POST()),
      overlay(TINY_OVERLAY(`<attitude target="p:C1" kind="reject" rejection-type="rebut"/>`)),
    );
    expect(r.takeaways[0]).toMatchObject({
      id: "C2",
      status: "blocked",
      rejectedAncestors: ["C1"],
    });
  });

  it("does NOT block when a rejected ancestor is mode=anticipated-objection", () => {
    const post = doc(`<post xmlns="urn:argml:v1" id="t">
      <head><metadata><title>t</title><author>a</author></metadata>
        <takeaways><takeaway ref="C2" priority="primary"/></takeaways>
      </head>
      <body><p>
        <claim id="O1" mode="anticipated-objection" supports="C2">objection</claim>
        <claim id="C2">conclusion</claim>
      </p></body>
    </post>`);
    const r = propagate(
      post,
      overlay(TINY_OVERLAY(`<attitude target="p:O1" kind="reject" rejection-type="rebut"/>`)),
    );
    expect(r.takeaways[0]).toMatchObject({ status: "supported", rejectedAncestors: [] });
  });

  it("does NOT block when a rejected ancestor is mode=conceded", () => {
    const post = doc(`<post xmlns="urn:argml:v1" id="t">
      <head><metadata><title>t</title><author>a</author></metadata>
        <takeaways><takeaway ref="C2" priority="primary"/></takeaways>
      </head>
      <body><p>
        <claim id="C1" mode="conceded" supports="C2">conceded</claim>
        <claim id="C2">conclusion</claim>
      </p></body>
    </post>`);
    const r = propagate(
      post,
      overlay(TINY_OVERLAY(`<attitude target="p:C1" kind="reject" rejection-type="rebut"/>`)),
    );
    expect(r.takeaways[0]).toMatchObject({ status: "supported" });
  });

  it("blocks via inference rejection (undercut)", () => {
    const post = doc(`<post xmlns="urn:argml:v1" id="t">
      <head><metadata><title>t</title><author>a</author></metadata>
        <takeaways><takeaway ref="C" priority="primary"/></takeaways>
      </head>
      <body><p>
        <claim id="P1">p</claim>
        <claim id="C">c</claim>
        <inference id="I1" from="P1" to="C"/>
      </p></body>
    </post>`);
    const r = propagate(
      post,
      overlay(TINY_OVERLAY(`<attitude target="p:I1" kind="reject" rejection-type="undercut"/>`)),
    );
    expect(r.takeaways[0]).toMatchObject({ status: "blocked", rejectedAncestors: ["I1"] });
  });

  it("argument rejection blocks only when the argument directly supports the takeaway with no alternate path", () => {
    const onlyArgPost = doc(`<post xmlns="urn:argml:v1" id="t">
      <head><metadata><title>t</title><author>a</author></metadata>
        <takeaways><takeaway ref="C1" priority="primary"/></takeaways>
      </head>
      <body>
        <argument id="A1" mode="case" supports="C1"><p>x</p></argument>
        <p><claim id="C1">target</claim></p>
      </body>
    </post>`);
    const r1 = propagate(
      onlyArgPost,
      overlay(TINY_OVERLAY(`<attitude target="p:A1" kind="reject" rejection-type="rebut"/>`)),
    );
    expect(r1.takeaways[0]).toMatchObject({ status: "blocked", rejectedAncestors: ["A1"] });

    // With an alternate support path, rejection of the argument is non-blocking.
    const altPost = doc(`<post xmlns="urn:argml:v1" id="t">
      <head><metadata><title>t</title><author>a</author></metadata>
        <takeaways><takeaway ref="C1" priority="primary"/></takeaways>
      </head>
      <body>
        <argument id="A1" mode="case" supports="C1"><p>x</p></argument>
        <p>
          <claim id="P1" supports="C1">alt premise</claim>
          <claim id="C1">target</claim>
        </p>
      </body>
    </post>`);
    const r2 = propagate(
      altPost,
      overlay(TINY_OVERLAY(`<attitude target="p:A1" kind="reject" rejection-type="rebut"/>`)),
    );
    expect(r2.takeaways[0]).toMatchObject({ status: "supported", rejectedAncestors: [] });
  });

  it("argument rejection on an indirect ancestor does NOT block (spec §13.5: rejection only breaks the argument's own supports edge)", () => {
    const post = doc(`<post xmlns="urn:argml:v1" id="t">
      <head><metadata><title>t</title><author>a</author></metadata>
        <takeaways><takeaway ref="C2" priority="primary"/></takeaways>
      </head>
      <body>
        <argument id="A1" mode="case" supports="C1"><p>x</p></argument>
        <p>
          <claim id="C1" supports="C2">middle</claim>
          <claim id="C2">target</claim>
        </p>
      </body>
    </post>`);
    const r = propagate(
      post,
      overlay(TINY_OVERLAY(`<attitude target="p:A1" kind="reject" rejection-type="rebut"/>`)),
    );
    expect(r.takeaways[0]).toMatchObject({ status: "supported" });
  });

  it("non-blocking mode on the TARGETED claim wins over the visited same-as class member's mode", () => {
    // Reader rejects O1 (mode=anticipated-objection, same-as=C1). C1 is the
    // graph ancestor of the takeaway; O1 is not. The §13.5 non-blocking rule
    // must consult O1's mode (the claim the reader actually responded to) —
    // not C1's `asserted` default — and treat the rejection as non-blocking.
    const post = doc(`<post xmlns="urn:argml:v1" id="t">
      <head><metadata><title>t</title><author>a</author></metadata>
        <takeaways><takeaway ref="C2" priority="primary"/></takeaways>
      </head>
      <body><p>
        <claim id="C1" supports="C2">premise</claim>
        <claim id="O1" mode="anticipated-objection" same-as="C1">objection-form</claim>
        <claim id="C2">conclusion</claim>
      </p></body>
    </post>`);
    const r = propagate(
      post,
      overlay(TINY_OVERLAY(`<attitude target="p:O1" kind="reject" rejection-type="rebut"/>`)),
    );
    expect(r.takeaways[0]).toMatchObject({ status: "supported", rejectedAncestors: [] });
  });

  it("rejection on an `asserted` target still blocks when same-as bridges to an `anticipated-objection` claim", () => {
    // Mirror image of the previous test: the asserted form C1 is rejected;
    // the same-as bridge to O1 (anticipated-objection) must NOT shield the
    // rejection — the reader rejected the load-bearing claim, not the
    // anticipated objection.
    const post = doc(`<post xmlns="urn:argml:v1" id="t">
      <head><metadata><title>t</title><author>a</author></metadata>
        <takeaways><takeaway ref="C2" priority="primary"/></takeaways>
      </head>
      <body><p>
        <claim id="C1" supports="C2">premise</claim>
        <claim id="O1" mode="anticipated-objection" same-as="C1">objection-form</claim>
        <claim id="C2">conclusion</claim>
      </p></body>
    </post>`);
    const r = propagate(
      post,
      overlay(TINY_OVERLAY(`<attitude target="p:C1" kind="reject" rejection-type="rebut"/>`)),
    );
    expect(r.takeaways[0]).toMatchObject({ status: "blocked", rejectedAncestors: ["C1"] });
  });

  it("propagates attitudes through same-as equivalence (attitude on the equivalent claim flows to its class)", () => {
    const post = doc(`<post xmlns="urn:argml:v1" id="t">
      <head><metadata><title>t</title><author>a</author></metadata>
        <takeaways><takeaway ref="C-recap" priority="primary"/></takeaways>
      </head>
      <body><p>
        <claim id="C1" supports="C-recap">premise</claim>
        <claim id="C-recap">target</claim>
        <claim id="C2" mode="restated" same-as="C1">restated premise</claim>
      </p></body>
    </post>`);
    // Reject the restated form C2. Through same-as, C1 (an ancestor of C-recap) is treated as rejected.
    const r = propagate(
      post,
      overlay(TINY_OVERLAY(`<attitude target="p:C2" kind="reject" rejection-type="rebut"/>`)),
    );
    expect(r.takeaways[0]?.status).toBe("blocked");
  });

  it("emits PROP001 when the overlay declares no import matching the post id", () => {
    const r = propagate(
      doc(TINY_POST()),
      overlay(`<reader-overlay xmlns="urn:argml:v1" reader="r">
        <imports><import prefix="other" doc="https://x.test/different"/></imports>
        <attitudes><attitude target="other:C1" kind="reject" rejection-type="rebut"/></attitudes>
      </reader-overlay>`),
    );
    expect(r.diagnostics.map((d) => d.code)).toContain("PROP001");
    expect(r.takeaways[0]?.status).toBe("supported");
  });

  it("emits PROP003 when an attitude targets an id that doesn't resolve in the post", () => {
    const r = propagate(
      doc(TINY_POST()),
      overlay(
        TINY_OVERLAY(`<attitude target="p:DOES-NOT-EXIST" kind="reject" rejection-type="rebut"/>`),
      ),
    );
    expect(r.diagnostics.map((d) => d.code)).toContain("PROP003");
  });
});

describe("propagate — Appendix B integration", () => {
  it("matches the spec's expected propagation table for the worked example", () => {
    const post = doc(SAMPLE_POST);
    const o = overlay(SAMPLE_OVERLAY);
    const r = propagate(post, o);

    expect(r.postPrefix).toBe("ian-mwc");
    expect(r.diagnostics).toEqual([]);

    const byId = new Map(r.takeaways.map((t) => [t.id, t]));

    expect(byId.get("C6.7")).toMatchObject({
      status: "provisional",
      openAncestors: ["C4.5"],
      rejectedAncestors: [],
    });
    expect(byId.get("C4.9")).toMatchObject({
      status: "provisional",
      openAncestors: ["C4.5"],
      rejectedAncestors: [],
    });
    expect(byId.get("C3.6")).toMatchObject({
      status: "blocked",
      rejectedAncestors: ["I-3.1"],
    });
  });
});

describe("propagate — monotonicity properties", () => {
  // For a fixed post P and base overlay O, adding a `reject` attitude on any
  // ancestor never UPGRADES a takeaway status; adding an `accept` never
  // DOWNGRADES it. The status order is: blocked < provisional < supported < endorsed.

  const rank: Record<string, number> = {
    blocked: 0,
    provisional: 1,
    supported: 2,
    endorsed: 3,
  };

  const post = (): ReturnType<typeof doc> =>
    doc(`<post xmlns="urn:argml:v1" id="t">
      <head><metadata><title>t</title><author>a</author></metadata>
        <takeaways><takeaway ref="C2" priority="primary"/></takeaways>
      </head>
      <body><p>
        <claim id="C1" supports="C2">premise</claim>
        <claim id="C2">target</claim>
      </p></body>
    </post>`);

  it("adding a reject attitude never upgrades the takeaway", () => {
    const base = propagate(post(), overlay(TINY_OVERLAY()));
    for (const tid of ["C1", "C2"]) {
      const augmented = propagate(
        post(),
        overlay(TINY_OVERLAY(`<attitude target="p:${tid}" kind="reject" rejection-type="rebut"/>`)),
      );
      const beforeRank = rank[base.takeaways[0]?.status ?? "supported"] ?? 0;
      const afterRank = rank[augmented.takeaways[0]?.status ?? "supported"] ?? 0;
      expect(afterRank).toBeLessThanOrEqual(beforeRank);
    }
  });

  it("adding an accept attitude on the takeaway never downgrades it", () => {
    const base = propagate(post(), overlay(TINY_OVERLAY()));
    const augmented = propagate(
      post(),
      overlay(TINY_OVERLAY(`<attitude target="p:C2" kind="accept"/>`)),
    );
    const beforeRank = rank[base.takeaways[0]?.status ?? "supported"] ?? 0;
    const afterRank = rank[augmented.takeaways[0]?.status ?? "supported"] ?? 0;
    expect(afterRank).toBeGreaterThanOrEqual(beforeRank);
  });
});
