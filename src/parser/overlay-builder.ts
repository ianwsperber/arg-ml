import type { AttackType, ImportNode, ImportsNode, InlineNode } from "../ast/nodes.js";
import type {
  AttitudeKind,
  AttitudeNode,
  ReaderOverlayDocument,
  SubstitutionNode,
} from "../ast/overlay.js";
import { buildInlineChildren, parseBucketOrNumericAttr, posOf } from "./builder.js";
import type { ParseDiagnostic } from "./diagnostics.js";
import type { LineMap } from "./positions.js";
import { type RawNode, tagAttrs, tagChildren, tagName } from "./xml.js";

const ARGML_NS = "urn:argml:v1";
const KNOWN_ATTITUDE_KINDS: ReadonlySet<string> = new Set(["accept", "reject", "open"]);
const KNOWN_ATTACK_TYPES: ReadonlySet<string> = new Set(["rebut", "undermine", "undercut"]);

export interface OverlayBuildResult {
  document: ReaderOverlayDocument | null;
  diagnostics: ParseDiagnostic[];
}

export function buildOverlay(root: RawNode, lineMap: LineMap): OverlayBuildResult {
  const diagnostics: ParseDiagnostic[] = [];
  const attrs = tagAttrs(root);
  if (attrs.xmlns !== ARGML_NS) {
    diagnostics.push({
      code: "PARSE002",
      severity: "error",
      message: `Root <reader-overlay> must declare xmlns="${ARGML_NS}" (got ${JSON.stringify(attrs.xmlns ?? null)}).`,
      pos: posOf(root, lineMap),
    });
    return { document: null, diagnostics };
  }

  const reader = attrs.reader;
  const rootPos = posOf(root, lineMap);
  if (reader === undefined || reader === "") {
    diagnostics.push({
      code: "PARSE014",
      severity: "error",
      message: "<reader-overlay> is missing required `reader` attribute.",
      pos: rootPos,
    });
  }

  let imports: ImportsNode | undefined;
  const attitudes: AttitudeNode[] = [];
  const substitutions: SubstitutionNode[] = [];

  for (const k of tagChildren(root, "reader-overlay")) {
    const name = tagName(k);
    switch (name) {
      case "imports":
        imports = buildImports(k, lineMap);
        break;
      case "attitudes":
        for (const a of tagChildren(k, "attitudes")) {
          if (tagName(a) === "attitude") {
            attitudes.push(buildAttitude(a, lineMap, diagnostics));
          } else if (tagName(a) !== null) {
            diagnostics.push({
              code: "PARSE005",
              severity: "warning",
              message: `Unknown element <${tagName(a)}> in <attitudes>.`,
              pos: posOf(a, lineMap),
            });
          }
        }
        break;
      case "substitutions":
        for (const s of tagChildren(k, "substitutions")) {
          if (tagName(s) === "substitution") {
            substitutions.push(buildSubstitution(s, lineMap, diagnostics));
          } else if (tagName(s) !== null) {
            diagnostics.push({
              code: "PARSE005",
              severity: "warning",
              message: `Unknown element <${tagName(s)}> in <substitutions>.`,
              pos: posOf(s, lineMap),
            });
          }
        }
        break;
      default:
        if (name !== null) {
          diagnostics.push({
            code: "PARSE005",
            severity: "warning",
            message: `Unknown element <${name}> in <reader-overlay>.`,
            pos: posOf(k, lineMap),
          });
        }
    }
  }

  const document: ReaderOverlayDocument = {
    kind: "reader-overlay",
    reader: reader ?? "",
    imports: imports ?? { kind: "imports", imports: [] },
    attitudes,
    substitutions,
    pos: rootPos,
  };
  if (attrs.updated !== undefined) document.updated = attrs.updated;
  return { document, diagnostics };
}

function buildImports(raw: RawNode, lineMap: LineMap): ImportsNode {
  const imports: ImportNode[] = [];
  for (const k of tagChildren(raw, "imports")) {
    if (tagName(k) !== "import") continue;
    const a = tagAttrs(k);
    imports.push({
      kind: "import",
      prefix: a.prefix ?? "",
      doc: a.doc ?? "",
      pos: posOf(k, lineMap),
    });
  }
  return { kind: "imports", imports, pos: posOf(raw, lineMap) };
}

function buildAttitude(raw: RawNode, lineMap: LineMap, diags: ParseDiagnostic[]): AttitudeNode {
  const a = tagAttrs(raw);
  const pos = posOf(raw, lineMap);
  const target = a.target ?? "";
  const kindAttr = a.kind ?? "";
  if (target === "" || kindAttr === "") {
    diags.push({
      code: "PARSE015",
      severity: "error",
      message: "<attitude> requires both `target` and `kind` attributes.",
      pos,
    });
  }
  let attitudeKind: AttitudeKind = "open";
  if (KNOWN_ATTITUDE_KINDS.has(kindAttr)) {
    attitudeKind = kindAttr as AttitudeKind;
  } else if (kindAttr !== "") {
    diags.push({
      code: "PARSE015",
      severity: "error",
      message: `<attitude kind=${JSON.stringify(kindAttr)}> is not one of "accept" | "reject" | "open".`,
      pos,
    });
  }

  const note: InlineNode[] = buildInlineChildren(tagChildren(raw, "attitude"), lineMap, diags);

  const node: AttitudeNode = {
    kind: "attitude",
    target,
    attitudeKind,
    note,
    pos,
  };
  const rt = a["rejection-type"];
  if (rt !== undefined) {
    if (KNOWN_ATTACK_TYPES.has(rt)) {
      node.rejectionType = rt as AttackType;
    } else {
      diags.push({
        code: "PARSE007",
        severity: "warning",
        message: `<attitude rejection-type=${JSON.stringify(rt)}> is not one of "rebut" | "undermine" | "undercut"; ignoring.`,
        pos,
      });
    }
  }
  const credence = parseBucketOrNumericAttr(a.credence);
  if (credence !== undefined) node.credence = credence;
  return node;
}

function buildSubstitution(
  raw: RawNode,
  lineMap: LineMap,
  diags: ParseDiagnostic[],
): SubstitutionNode {
  const a = tagAttrs(raw);
  const pos = posOf(raw, lineMap);
  const target = a.target ?? "";
  const use = a.use ?? "";
  if (target === "" || use === "") {
    diags.push({
      code: "PARSE016",
      severity: "error",
      message: "<substitution> requires both `target` and `use` attributes.",
      pos,
    });
  }
  const note = buildInlineChildren(tagChildren(raw, "substitution"), lineMap, diags);
  return {
    kind: "substitution",
    target,
    use,
    note,
    pos,
  };
}
