import type { ArgMLDocument, BodyNode, HeadNode } from "../ast/document.js";
import type {
  AliasNode,
  AssumptionNode,
  AssumptionsNode,
  AttackType,
  AttackerRef,
  BlockOrInline,
  BucketOrNumericValue,
  ClaimNode,
  ConflictNode,
  EvidenceNode,
  GlossNode,
  HeadingNode,
  ImportNode,
  ImportsNode,
  InferenceNode,
  InlineNode,
  MetadataNode,
  NoteNode,
  ParagraphNode,
  ResponseNode,
  SectionNode,
  TargetRef,
  TermDeclaration,
  TermRefNode,
  TermsNode,
  TextNode,
} from "../ast/nodes.js";
import type { SourcePosition } from "../ast/position.js";
import type { ParseDiagnostic } from "./diagnostics.js";
import type { LineMap } from "./positions.js";
import { type RawNode, metaOf, tagAttrs, tagChildren, tagName, textValue } from "./xml.js";

const ARGML_NS = "urn:argml:v1";

export interface BuildResult {
  document: ArgMLDocument | null;
  diagnostics: ParseDiagnostic[];
}

export function buildDocument(roots: RawNode[], lineMap: LineMap): BuildResult {
  const diagnostics: ParseDiagnostic[] = [];

  const postNode = roots.find((n) => tagName(n) === "post");
  if (!postNode) {
    diagnostics.push({
      code: "PARSE003",
      severity: "error",
      message: "Document root is not <post>.",
    });
    return { document: null, diagnostics };
  }

  const attrs = tagAttrs(postNode);
  if (attrs.xmlns !== ARGML_NS) {
    diagnostics.push({
      code: "PARSE002",
      severity: "error",
      message: `Root <post> must declare xmlns="${ARGML_NS}" (got ${JSON.stringify(attrs.xmlns ?? null)}).`,
      pos: posOf(postNode, lineMap),
    });
    return { document: null, diagnostics };
  }

  const id = attrs.id ?? "";
  const children = tagChildren(postNode, "post");

  const headRaw = children.find((c) => tagName(c) === "head");
  const bodyRaw = children.find((c) => tagName(c) === "body");

  if (!headRaw || !bodyRaw) {
    diagnostics.push({
      code: "PARSE004",
      severity: "error",
      message: "<post> must contain a <head> and a <body>.",
      pos: posOf(postNode, lineMap),
    });
    return { document: null, diagnostics };
  }

  const head = buildHead(headRaw, lineMap, diagnostics);
  const body = buildBody(bodyRaw, lineMap, diagnostics);

  const document: ArgMLDocument = {
    kind: "post",
    id,
    head,
    body,
    pos: posOf(postNode, lineMap),
  };
  return { document, diagnostics };
}

/* ----- positions ----- */

function posOf(node: RawNode, lineMap: LineMap): SourcePosition | undefined {
  const meta = metaOf(node);
  if (!meta || typeof meta.startIndex !== "number") return undefined;
  return lineMap.positionAt(meta.startIndex);
}

/* ----- head ----- */

function buildHead(raw: RawNode, lineMap: LineMap, diags: ParseDiagnostic[]): HeadNode {
  const kids = tagChildren(raw, "head");
  let metadata: MetadataNode | undefined;
  let imports: ImportsNode | undefined;
  let terms: TermsNode | undefined;
  let assumptions: AssumptionsNode | undefined;
  for (const k of kids) {
    const name = tagName(k);
    switch (name) {
      case "metadata":
        metadata = buildMetadata(k, lineMap);
        break;
      case "imports":
        imports = buildImports(k, lineMap);
        break;
      case "terms":
        terms = buildTerms(k, lineMap, diags);
        break;
      case "assumptions":
        assumptions = buildAssumptions(k, lineMap, diags);
        break;
      default:
        // structural elements ignore stray text/whitespace; unknown elements warn.
        if (name !== null) {
          diags.push({
            code: "PARSE005",
            severity: "warning",
            message: `Unknown element <${name}> in <head>.`,
            pos: posOf(k, lineMap),
          });
        }
    }
  }

  if (!metadata) {
    diags.push({
      code: "PARSE006",
      severity: "warning",
      message: "<head> is missing a <metadata> element.",
      pos: posOf(raw, lineMap),
    });
  }
  const head: HeadNode = {
    kind: "head",
    metadata: metadata ?? {
      kind: "metadata",
      authors: [],
    },
    pos: posOf(raw, lineMap),
  };
  if (imports) head.imports = imports;
  if (terms) head.terms = terms;
  if (assumptions) head.assumptions = assumptions;
  return head;
}

function buildMetadata(raw: RawNode, lineMap: LineMap): MetadataNode {
  const md: MetadataNode = {
    kind: "metadata",
    authors: [],
    pos: posOf(raw, lineMap),
  };
  for (const k of tagChildren(raw, "metadata")) {
    const name = tagName(k);
    if (name === null) continue;
    const text = collectText(k, name).trim();
    switch (name) {
      case "title":
        md.title = text;
        break;
      case "author":
        md.authors.push(text);
        break;
      case "date":
        md.date = text;
        break;
      case "source":
        md.source = text;
        break;
      case "epistemic-status":
        md.epistemicStatus = collectText(k, name);
        break;
    }
  }
  return md;
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

function buildTerms(raw: RawNode, lineMap: LineMap, diags: ParseDiagnostic[]): TermsNode {
  const terms: TermDeclaration[] = [];
  for (const k of tagChildren(raw, "terms")) {
    if (tagName(k) !== "term") continue;
    terms.push(buildTermDecl(k, lineMap, diags));
  }
  return { kind: "terms", terms, pos: posOf(raw, lineMap) };
}

function buildTermDecl(raw: RawNode, lineMap: LineMap, diags: ParseDiagnostic[]): TermDeclaration {
  const a = tagAttrs(raw);
  const decl: TermDeclaration = {
    kind: "term-decl",
    id: a.id ?? "",
    aliases: [],
    pos: posOf(raw, lineMap),
  };
  if (a.canonical !== undefined) decl.canonical = a.canonical;
  if (a.scope === "local") decl.scope = "local";
  for (const k of tagChildren(raw, "term")) {
    const name = tagName(k);
    if (name === "gloss") {
      decl.gloss = {
        kind: "gloss",
        text: collectText(k, "gloss"),
        pos: posOf(k, lineMap),
      };
    } else if (name === "alias") {
      const alias: AliasNode = {
        kind: "alias",
        text: collectText(k, "alias"),
        pos: posOf(k, lineMap),
      };
      decl.aliases.push(alias);
    } else if (name !== null) {
      diags.push({
        code: "PARSE005",
        severity: "warning",
        message: `Unknown element <${name}> in <term> declaration.`,
        pos: posOf(k, lineMap),
      });
    }
  }
  return decl;
}

function buildAssumptions(
  raw: RawNode,
  lineMap: LineMap,
  diags: ParseDiagnostic[],
): AssumptionsNode {
  const assumptions: AssumptionNode[] = [];
  for (const k of tagChildren(raw, "assumptions")) {
    if (tagName(k) !== "assumption") continue;
    assumptions.push(buildAssumption(k, lineMap, diags));
  }
  return { kind: "assumptions", assumptions, pos: posOf(raw, lineMap) };
}

function buildAssumption(raw: RawNode, lineMap: LineMap, diags: ParseDiagnostic[]): AssumptionNode {
  const a = tagAttrs(raw);
  const kids = tagChildren(raw, "assumption");
  const textParts: string[] = [];
  let note: NoteNode | undefined;
  for (const k of kids) {
    const name = tagName(k);
    const tv = textValue(k);
    if (tv !== null) {
      textParts.push(tv);
      continue;
    }
    if (name === "note") {
      note = {
        kind: "note",
        text: collectText(k, "note"),
        pos: posOf(k, lineMap),
      };
      const na = tagAttrs(k);
      if (na.status !== undefined) note.status = na.status;
    } else if (name !== null) {
      diags.push({
        code: "PARSE005",
        severity: "warning",
        message: `Unknown element <${name}> in <assumption>.`,
        pos: posOf(k, lineMap),
      });
    }
  }
  const node: AssumptionNode = {
    kind: "assumption",
    id: a.id ?? "",
    restsOn: splitIdList(a["rests-on"]),
    text: textParts.join(""),
    pos: posOf(raw, lineMap),
  };
  if (note) node.note = note;
  return node;
}

/* ----- body ----- */

function buildBody(raw: RawNode, lineMap: LineMap, diags: ParseDiagnostic[]): BodyNode {
  const children = buildBlockChildren(tagChildren(raw, "body"), lineMap, diags);
  return { kind: "body", children, pos: posOf(raw, lineMap) };
}

function buildBlockChildren(
  raws: RawNode[],
  lineMap: LineMap,
  diags: ParseDiagnostic[],
): BlockOrInline[] {
  const out: BlockOrInline[] = [];
  for (const k of raws) {
    const tv = textValue(k);
    if (tv !== null) {
      if (tv.trim() === "") continue;
      // Stray non-whitespace text at block level — keep as inline text.
      out.push({ kind: "text", text: tv });
      continue;
    }
    const name = tagName(k);
    if (name === null) continue;
    const built = buildBlockOrInline(name, k, lineMap, diags);
    if (built) out.push(built);
  }
  return out;
}

function buildBlockOrInline(
  name: string,
  raw: RawNode,
  lineMap: LineMap,
  diags: ParseDiagnostic[],
): BlockOrInline | null {
  switch (name) {
    case "section":
      return buildSection(raw, lineMap, diags);
    case "p":
      return buildParagraph(raw, lineMap, diags);
    default: {
      const inline = buildInline(name, raw, lineMap, diags);
      return inline;
    }
  }
}

function buildSection(raw: RawNode, lineMap: LineMap, diags: ParseDiagnostic[]): SectionNode {
  const a = tagAttrs(raw);
  const kids = tagChildren(raw, "section");
  let heading: HeadingNode | undefined;
  const remaining: RawNode[] = [];
  for (const k of kids) {
    const tv = textValue(k);
    if (tv !== null) {
      if (tv.trim() === "") continue;
      remaining.push(k);
      continue;
    }
    if (tagName(k) === "heading" && !heading) {
      heading = buildHeading(k, lineMap, diags);
    } else {
      remaining.push(k);
    }
  }
  const children = buildBlockChildren(remaining, lineMap, diags);
  const node: SectionNode = {
    kind: "section",
    children,
    pos: posOf(raw, lineMap),
  };
  if (a.id !== undefined) node.id = a.id;
  if (heading) node.heading = heading;
  return node;
}

function buildHeading(raw: RawNode, lineMap: LineMap, diags: ParseDiagnostic[]): HeadingNode {
  const a = tagAttrs(raw);
  const rawLevel = a.level;
  let level = 1;
  if (rawLevel !== undefined) {
    const parsed = Number.parseInt(rawLevel, 10);
    if (Number.isFinite(parsed) && String(parsed) === rawLevel.trim()) {
      level = parsed;
    } else {
      diags.push({
        code: "PARSE008",
        severity: "warning",
        message: `<heading level=${JSON.stringify(rawLevel)}> is not a valid integer; defaulting to 1.`,
        pos: posOf(raw, lineMap),
      });
    }
  }
  const children = buildInlineChildren(tagChildren(raw, "heading"), lineMap, diags);
  return {
    kind: "heading",
    level,
    children,
    pos: posOf(raw, lineMap),
  };
}

function buildParagraph(raw: RawNode, lineMap: LineMap, diags: ParseDiagnostic[]): ParagraphNode {
  const children = buildInlineChildren(tagChildren(raw, "p"), lineMap, diags);
  return { kind: "p", children, pos: posOf(raw, lineMap) };
}

function buildInlineChildren(
  raws: RawNode[],
  lineMap: LineMap,
  diags: ParseDiagnostic[],
): InlineNode[] {
  const out: InlineNode[] = [];
  for (const k of raws) {
    const tv = textValue(k);
    if (tv !== null) {
      out.push({ kind: "text", text: tv });
      continue;
    }
    const name = tagName(k);
    if (name === null) continue;
    const node = buildInline(name, k, lineMap, diags);
    if (node) out.push(node);
  }
  return out;
}

function buildInline(
  name: string,
  raw: RawNode,
  lineMap: LineMap,
  diags: ParseDiagnostic[],
): InlineNode | null {
  switch (name) {
    case "term":
      return buildTermRef(raw, lineMap, diags);
    case "claim":
      return buildClaim(raw, lineMap, diags);
    case "inference":
      return buildInference(raw, lineMap, diags);
    case "conflict":
      return buildConflict(raw, lineMap, diags);
    case "evidence":
      return buildEvidence(raw, lineMap);
    case "note":
      return buildNote(raw, lineMap);
    default:
      diags.push({
        code: "PARSE005",
        severity: "warning",
        message: `Unknown element <${name}> in body.`,
        pos: posOf(raw, lineMap),
      });
      return null;
  }
}

function buildTermRef(raw: RawNode, lineMap: LineMap, diags: ParseDiagnostic[]): TermRefNode {
  const a = tagAttrs(raw);
  return {
    kind: "term-ref",
    ref: a.ref ?? "",
    children: buildInlineChildren(tagChildren(raw, "term"), lineMap, diags),
    pos: posOf(raw, lineMap),
  };
}

function buildClaim(raw: RawNode, lineMap: LineMap, diags: ParseDiagnostic[]): ClaimNode {
  const a = tagAttrs(raw);
  const claim: ClaimNode = {
    kind: "claim",
    id: a.id ?? "",
    supports: splitIdList(a.supports),
    attacks: splitIdList(a.attacks),
    restsOn: splitIdList(a["rests-on"]),
    children: buildInlineChildren(tagChildren(raw, "claim"), lineMap, diags),
    pos: posOf(raw, lineMap),
  };
  const claimPos = posOf(raw, lineMap);
  const at = parseAttackType(a["attack-type"], "attack-type", "<claim>", claimPos, diags);
  if (at !== undefined) claim.attackType = at;
  if (a.via !== undefined) claim.via = a.via;
  const def = parseBoolean(a.defeasible, "defeasible", "<claim>", claimPos, diags);
  if (def !== undefined) claim.defeasible = def;
  if (a.scheme !== undefined) claim.scheme = a.scheme;
  const credence = parseBucketOrNumericAttr(a.credence);
  if (credence !== undefined) claim.credence = credence;
  return claim;
}

function buildInference(raw: RawNode, lineMap: LineMap, diags: ParseDiagnostic[]): InferenceNode {
  const a = tagAttrs(raw);
  const node: InferenceNode = {
    kind: "inference",
    id: a.id ?? "",
    from: splitIdList(a.from),
    to: a.to ?? "",
    warrant: buildInlineChildren(tagChildren(raw, "inference"), lineMap, diags),
    pos: posOf(raw, lineMap),
  };
  if (a.scheme !== undefined) node.scheme = a.scheme;
  const infPos = posOf(raw, lineMap);
  const def = parseBoolean(a.defeasible, "defeasible", "<inference>", infPos, diags);
  if (def !== undefined) node.defeasible = def;
  const strength = parseBucketOrNumericAttr(a.strength);
  if (strength !== undefined) node.strength = strength;
  return node;
}

function buildConflict(raw: RawNode, lineMap: LineMap, diags: ParseDiagnostic[]): ConflictNode {
  const a = tagAttrs(raw);
  let attacker: AttackerRef | undefined;
  let target: TargetRef | undefined;
  let response: ResponseNode | undefined;
  for (const k of tagChildren(raw, "conflict")) {
    const name = tagName(k);
    if (name === "attacker") {
      const ka = tagAttrs(k);
      attacker = { kind: "attacker", idref: ka.idref ?? "", pos: posOf(k, lineMap) };
    } else if (name === "target") {
      const ka = tagAttrs(k);
      target = { kind: "target", idref: ka.idref ?? "", pos: posOf(k, lineMap) };
    } else if (name === "response") {
      const children = buildBlockChildren(tagChildren(k, "response"), lineMap, diags);
      response = { kind: "response", children, pos: posOf(k, lineMap) };
    }
  }
  const conflictPos = posOf(raw, lineMap);
  if (!attacker) {
    diags.push({
      code: "PARSE009",
      severity: "warning",
      message: "<conflict> is missing a required <attacker> child.",
      pos: conflictPos,
    });
  }
  if (!target) {
    diags.push({
      code: "PARSE009",
      severity: "warning",
      message: "<conflict> is missing a required <target> child.",
      pos: conflictPos,
    });
  }
  const node: ConflictNode = {
    kind: "conflict",
    id: a.id ?? "",
    attacker: attacker ?? { kind: "attacker", idref: "" },
    target: target ?? { kind: "target", idref: "" },
    pos: conflictPos,
  };
  const at = parseAttackType(a["attack-type"], "attack-type", "<conflict>", conflictPos, diags);
  if (at !== undefined) node.attackType = at;
  if (response) node.response = response;
  return node;
}

function buildEvidence(raw: RawNode, lineMap: LineMap): EvidenceNode {
  const a = tagAttrs(raw);
  const node: EvidenceNode = {
    kind: "evidence",
    ref: a.ref ?? "",
    pos: posOf(raw, lineMap),
  };
  if (a.type !== undefined) node.evidenceType = a.type;
  for (const k of tagChildren(raw, "evidence")) {
    if (tagName(k) === "gloss") {
      const gloss: GlossNode = {
        kind: "gloss",
        text: collectText(k, "gloss"),
        pos: posOf(k, lineMap),
      };
      node.gloss = gloss;
      break;
    }
  }
  return node;
}

function buildNote(raw: RawNode, lineMap: LineMap): NoteNode {
  const a = tagAttrs(raw);
  const node: NoteNode = {
    kind: "note",
    text: collectText(raw, "note"),
    pos: posOf(raw, lineMap),
  };
  if (a.status !== undefined) node.status = a.status;
  return node;
}

/* ----- helpers ----- */

function collectText(raw: RawNode, name: string): string {
  const parts: string[] = [];
  for (const k of tagChildren(raw, name)) {
    const tv = textValue(k);
    if (tv !== null) {
      parts.push(tv);
    } else {
      const childName = tagName(k);
      if (childName !== null) parts.push(collectText(k, childName));
    }
  }
  return parts.join("");
}

function splitIdList(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(/\s+/).filter((s) => s.length > 0);
}

function parseAttackType(
  value: string | undefined,
  attrName: string,
  ownerLabel: string,
  pos: SourcePosition | undefined,
  diags: ParseDiagnostic[],
): AttackType | undefined {
  if (value === undefined) return undefined;
  if (value === "rebut" || value === "undermine" || value === "undercut") return value;
  diags.push({
    code: "PARSE007",
    severity: "warning",
    message: `${ownerLabel} ${attrName}=${JSON.stringify(value)} is not one of "rebut" | "undermine" | "undercut"; ignoring.`,
    pos,
  });
  return undefined;
}

function parseBoolean(
  value: string | undefined,
  attrName: string,
  ownerLabel: string,
  pos: SourcePosition | undefined,
  diags: ParseDiagnostic[],
): boolean | undefined {
  if (value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  diags.push({
    code: "PARSE007",
    severity: "warning",
    message: `${ownerLabel} ${attrName}=${JSON.stringify(value)} is not "true" or "false"; ignoring.`,
    pos,
  });
  return undefined;
}

function parseBucketOrNumericAttr(value: string | undefined): BucketOrNumericValue | undefined {
  if (value === undefined) return undefined;
  const num = Number(value);
  if (value.trim() !== "" && Number.isFinite(num)) {
    return { kind: "numeric", value: num };
  }
  return { kind: "bucket", value };
}
