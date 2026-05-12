import type { ArgMLDocument, BodyNode, HeadNode } from "../ast/document.js";
import type {
  AliasNode,
  ArgumentNode,
  AssumptionNode,
  AssumptionsNode,
  AttackType,
  AttackerRef,
  BlockOrInline,
  BucketOrNumericValue,
  ClaimNode,
  ConflictNode,
  EvidenceNode,
  GeneratorNode,
  GlossNode,
  HeadingNode,
  ImportNode,
  ImportsNode,
  InferenceNode,
  InlineNode,
  MetadataNode,
  NoteNode,
  ParagraphNode,
  ProvenanceNode,
  ResponseNode,
  SectionNode,
  TakeawayNode,
  TakeawaysNode,
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

/** Spec-defined order of head children (§5). Used by PARSE010 to detect
 * out-of-order declarations. */
const HEAD_CHILD_ORDER: Record<string, number> = {
  metadata: 0,
  provenance: 1,
  imports: 2,
  terms: 3,
  assumptions: 4,
  takeaways: 5,
};

function buildHead(raw: RawNode, lineMap: LineMap, diags: ParseDiagnostic[]): HeadNode {
  const kids = tagChildren(raw, "head");
  let metadata: MetadataNode | undefined;
  let provenance: ProvenanceNode | undefined;
  let imports: ImportsNode | undefined;
  let terms: TermsNode | undefined;
  let assumptions: AssumptionsNode | undefined;
  let takeaways: TakeawaysNode | undefined;
  let lastOrder = -1;
  let lastName: string | null = null;
  for (const k of kids) {
    const name = tagName(k);
    if (name !== null && name in HEAD_CHILD_ORDER) {
      const order = HEAD_CHILD_ORDER[name] ?? -1;
      if (order < lastOrder && lastName !== null) {
        diags.push({
          code: "PARSE010",
          severity: "warning",
          message: `<${name}> appears after <${lastName}> in <head>; spec order is metadata, provenance, imports, terms, assumptions, takeaways.`,
          pos: posOf(k, lineMap),
        });
      } else {
        lastOrder = order;
        lastName = name;
      }
    }
    switch (name) {
      case "metadata":
        metadata = buildMetadata(k, lineMap);
        break;
      case "provenance":
        provenance = buildProvenance(k, lineMap, diags);
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
      case "takeaways":
        takeaways = buildTakeaways(k, lineMap, diags);
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
  if (provenance) head.provenance = provenance;
  if (imports) head.imports = imports;
  if (terms) head.terms = terms;
  if (assumptions) head.assumptions = assumptions;
  if (takeaways) head.takeaways = takeaways;
  return head;
}

function buildProvenance(raw: RawNode, lineMap: LineMap, diags: ParseDiagnostic[]): ProvenanceNode {
  const generators: GeneratorNode[] = [];
  for (const k of tagChildren(raw, "provenance")) {
    const name = tagName(k);
    if (name === "generator") {
      generators.push(buildGenerator(k, lineMap, diags));
    } else if (name !== null) {
      diags.push({
        code: "PARSE005",
        severity: "warning",
        message: `Unknown element <${name}> in <provenance>.`,
        pos: posOf(k, lineMap),
      });
    }
  }
  return { kind: "provenance", generators, pos: posOf(raw, lineMap) };
}

function buildGenerator(raw: RawNode, lineMap: LineMap, diags: ParseDiagnostic[]): GeneratorNode {
  const a = tagAttrs(raw);
  const pos = posOf(raw, lineMap);
  const id = a.id ?? "";
  if (id === "") {
    diags.push({
      code: "PARSE013",
      severity: "warning",
      message: "<generator> is missing required `id` attribute.",
      pos,
    });
  }
  const node: GeneratorNode = { kind: "generator", id, pos };
  if (a.type !== undefined) node.generatorType = a.type;
  if (a.who !== undefined) node.who = a.who;
  if (a.model !== undefined) node.model = a.model;
  if (a.date !== undefined) node.date = a.date;
  if (a.role !== undefined) node.role = a.role;
  return node;
}

function buildTakeaways(raw: RawNode, lineMap: LineMap, diags: ParseDiagnostic[]): TakeawaysNode {
  const takeaways: TakeawayNode[] = [];
  for (const k of tagChildren(raw, "takeaways")) {
    const name = tagName(k);
    if (name === "takeaway") {
      takeaways.push(buildTakeaway(k, lineMap, diags));
    } else if (name !== null) {
      diags.push({
        code: "PARSE005",
        severity: "warning",
        message: `Unknown element <${name}> in <takeaways>.`,
        pos: posOf(k, lineMap),
      });
    }
  }
  return { kind: "takeaways", takeaways, pos: posOf(raw, lineMap) };
}

function buildTakeaway(raw: RawNode, lineMap: LineMap, diags: ParseDiagnostic[]): TakeawayNode {
  const a = tagAttrs(raw);
  const pos = posOf(raw, lineMap);
  const ref = a.ref ?? "";
  if (ref === "") {
    diags.push({
      code: "PARSE012",
      severity: "warning",
      message: "<takeaway> is missing required `ref` attribute.",
      pos,
    });
  }
  const node: TakeawayNode = {
    kind: "takeaway",
    ref,
    provenance: splitIdList(a.provenance),
    pos,
  };
  if (a.priority !== undefined) node.priority = a.priority;
  return node;
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
    provenance: splitIdList(a.provenance),
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
    provenance: splitIdList(a.provenance),
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
    case "argument":
      return buildArgument(raw, lineMap, diags);
    default: {
      const inline = buildInline(name, raw, lineMap, diags);
      return inline;
    }
  }
}

function buildArgument(raw: RawNode, lineMap: LineMap, diags: ParseDiagnostic[]): ArgumentNode {
  const a = tagAttrs(raw);
  const pos = posOf(raw, lineMap);
  const mode = a.mode;
  if (mode === undefined || mode === "") {
    diags.push({
      code: "PARSE011",
      severity: "warning",
      message: "<argument> is missing required `mode` attribute.",
      pos,
    });
  }
  const node: ArgumentNode = {
    kind: "argument",
    mode: mode ?? "",
    supports: splitIdList(a.supports),
    restsOn: splitIdList(a["rests-on"]),
    provenance: splitIdList(a.provenance),
    children: buildBlockChildren(tagChildren(raw, "argument"), lineMap, diags),
    pos,
  };
  if (a.id !== undefined) node.id = a.id;
  if (a.via !== undefined) node.via = a.via;
  if (a["attributed-to"] !== undefined) node.attributedTo = a["attributed-to"];
  return node;
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

const PRESENTATIONAL_TAGS = new Set(["em", "strong", "code", "a"]);

function buildInlineChildren(
  raws: RawNode[],
  lineMap: LineMap,
  diags: ParseDiagnostic[],
): InlineNode[] {
  const out: InlineNode[] = [];
  const append = (node: InlineNode): void => {
    const last = out[out.length - 1];
    if (node.kind === "text" && last?.kind === "text") {
      last.text += node.text;
      return;
    }
    out.push(node);
  };
  const visit = (k: RawNode): void => {
    const tv = textValue(k);
    if (tv !== null) {
      append({ kind: "text", text: tv });
      return;
    }
    const name = tagName(k);
    if (name === null) return;
    if (PRESENTATIONAL_TAGS.has(name)) {
      // Spec: presentational HTML-like markup is permitted but ignored by ArgML
      // semantics. Flatten its children inline so the document round-trips.
      for (const inner of tagChildren(k, name)) visit(inner);
      return;
    }
    const node = buildInline(name, k, lineMap, diags);
    if (node) append(node);
  };
  for (const k of raws) visit(k);
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
    provenance: splitIdList(a.provenance),
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
  if (a.mode !== undefined) claim.mode = a.mode;
  if (a["attributed-to"] !== undefined) claim.attributedTo = a["attributed-to"];
  if (a["same-as"] !== undefined) claim.sameAs = a["same-as"];
  if (a.source !== undefined) claim.source = a.source;
  return claim;
}

function buildInference(raw: RawNode, lineMap: LineMap, diags: ParseDiagnostic[]): InferenceNode {
  const a = tagAttrs(raw);
  const node: InferenceNode = {
    kind: "inference",
    id: a.id ?? "",
    from: splitIdList(a.from),
    to: a.to ?? "",
    provenance: splitIdList(a.provenance),
    warrant: buildInlineChildren(tagChildren(raw, "inference"), lineMap, diags),
    pos: posOf(raw, lineMap),
  };
  if (a.scheme !== undefined) node.scheme = a.scheme;
  if (a.pattern !== undefined) node.pattern = a.pattern;
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
    provenance: splitIdList(a.provenance),
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
    return { kind: "numeric", value: num, raw: value };
  }
  return { kind: "bucket", value };
}
