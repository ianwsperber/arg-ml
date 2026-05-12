import type { ArgMLDocument, BodyNode, HeadNode } from "../ast/document.js";
import type {
  ArgumentNode,
  AssumptionNode,
  AssumptionsNode,
  AttackerRef,
  BlockOrInline,
  ClaimNode,
  ConflictNode,
  CredenceValue,
  EvidenceNode,
  GeneratorNode,
  GlossNode,
  HeadingNode,
  ImportsNode,
  InferenceNode,
  InlineNode,
  MetadataNode,
  NoteNode,
  ParagraphNode,
  ProvenanceNode,
  ResponseNode,
  SectionNode,
  StrengthValue,
  TakeawayNode,
  TakeawaysNode,
  TargetRef,
  TermDeclaration,
  TermRefNode,
  TermsNode,
} from "../ast/nodes.js";
import type { AttitudeNode, ReaderOverlayDocument, SubstitutionNode } from "../ast/overlay.js";

const NS = "urn:argml:v1";

export function serializeArgML(doc: ArgMLDocument): string {
  const parts: string[] = [];
  parts.push(`<post xmlns="${NS}"`);
  if (doc.id) parts.push(` id="${escapeAttr(doc.id)}"`);
  parts.push(">");
  parts.push(serializeHead(doc.head));
  parts.push(serializeBody(doc.body));
  parts.push("</post>");
  return parts.join("");
}

export function serializeReaderOverlay(doc: ReaderOverlayDocument): string {
  const parts: string[] = [`<reader-overlay xmlns="${NS}"`];
  parts.push(` reader="${escapeAttr(doc.reader)}"`);
  if (doc.updated !== undefined) parts.push(` updated="${escapeAttr(doc.updated)}"`);
  parts.push(">");
  parts.push(serializeImports(doc.imports));
  parts.push("<attitudes>");
  for (const a of doc.attitudes) parts.push(serializeAttitude(a));
  parts.push("</attitudes>");
  parts.push("<substitutions>");
  for (const s of doc.substitutions) parts.push(serializeSubstitution(s));
  parts.push("</substitutions>");
  parts.push("</reader-overlay>");
  return parts.join("");
}

function serializeAttitude(a: AttitudeNode): string {
  const attrs: string[] = [
    `target="${escapeAttr(a.target)}"`,
    `kind="${escapeAttr(a.attitudeKind)}"`,
  ];
  if (a.rejectionType !== undefined) attrs.push(`rejection-type="${a.rejectionType}"`);
  if (a.credence !== undefined)
    attrs.push(`credence="${escapeAttr(formatBucketOrNumeric(a.credence))}"`);
  if (a.note.length === 0) return `<attitude ${attrs.join(" ")}/>`;
  return `<attitude ${attrs.join(" ")}>${a.note.map(serializeInline).join("")}</attitude>`;
}

function serializeSubstitution(s: SubstitutionNode): string {
  const attrs: string[] = [`target="${escapeAttr(s.target)}"`, `use="${escapeAttr(s.use)}"`];
  if (s.note.length === 0) return `<substitution ${attrs.join(" ")}/>`;
  return `<substitution ${attrs.join(" ")}>${s.note.map(serializeInline).join("")}</substitution>`;
}

function serializeHead(head: HeadNode): string {
  const parts = ["<head>"];
  parts.push(serializeMetadata(head.metadata));
  if (head.provenance) parts.push(serializeProvenance(head.provenance));
  if (head.imports) parts.push(serializeImports(head.imports));
  if (head.terms) parts.push(serializeTerms(head.terms));
  if (head.assumptions) parts.push(serializeAssumptions(head.assumptions));
  if (head.takeaways) parts.push(serializeTakeaways(head.takeaways));
  parts.push("</head>");
  return parts.join("");
}

function serializeProvenance(node: ProvenanceNode): string {
  const parts = ["<provenance>"];
  for (const g of node.generators) parts.push(serializeGenerator(g));
  parts.push("</provenance>");
  return parts.join("");
}

function serializeGenerator(g: GeneratorNode): string {
  const attrs: string[] = [`id="${escapeAttr(g.id)}"`];
  if (g.generatorType !== undefined) attrs.push(`type="${escapeAttr(g.generatorType)}"`);
  if (g.who !== undefined) attrs.push(`who="${escapeAttr(g.who)}"`);
  if (g.model !== undefined) attrs.push(`model="${escapeAttr(g.model)}"`);
  if (g.date !== undefined) attrs.push(`date="${escapeAttr(g.date)}"`);
  if (g.role !== undefined) attrs.push(`role="${escapeAttr(g.role)}"`);
  return `<generator ${attrs.join(" ")}/>`;
}

function serializeTakeaways(node: TakeawaysNode): string {
  const parts = ["<takeaways>"];
  for (const t of node.takeaways) parts.push(serializeTakeaway(t));
  parts.push("</takeaways>");
  return parts.join("");
}

function serializeTakeaway(t: TakeawayNode): string {
  const attrs: string[] = [`ref="${escapeAttr(t.ref)}"`];
  if (t.priority !== undefined) attrs.push(`priority="${escapeAttr(t.priority)}"`);
  if (t.provenance.length > 0) attrs.push(`provenance="${escapeAttr(t.provenance.join(" "))}"`);
  return `<takeaway ${attrs.join(" ")}/>`;
}

function serializeMetadata(md: MetadataNode): string {
  const parts = ["<metadata>"];
  if (md.title !== undefined) parts.push(`<title>${escapeText(md.title)}</title>`);
  for (const a of md.authors) parts.push(`<author>${escapeText(a)}</author>`);
  if (md.date !== undefined) parts.push(`<date>${escapeText(md.date)}</date>`);
  if (md.source !== undefined) parts.push(`<source>${escapeText(md.source)}</source>`);
  if (md.epistemicStatus !== undefined) {
    parts.push(`<epistemic-status>${escapeText(md.epistemicStatus)}</epistemic-status>`);
  }
  parts.push("</metadata>");
  return parts.join("");
}

function serializeImports(node: ImportsNode): string {
  const parts = ["<imports>"];
  for (const imp of node.imports) {
    parts.push(`<import prefix="${escapeAttr(imp.prefix)}" doc="${escapeAttr(imp.doc)}"/>`);
  }
  parts.push("</imports>");
  return parts.join("");
}

function serializeTerms(node: TermsNode): string {
  const parts = ["<terms>"];
  for (const t of node.terms) parts.push(serializeTermDecl(t));
  parts.push("</terms>");
  return parts.join("");
}

function serializeTermDecl(t: TermDeclaration): string {
  const attrs: string[] = [`id="${escapeAttr(t.id)}"`];
  if (t.canonical !== undefined) attrs.push(`canonical="${escapeAttr(t.canonical)}"`);
  if (t.scope === "local") attrs.push(`scope="local"`);
  if (t.provenance.length > 0) attrs.push(`provenance="${escapeAttr(t.provenance.join(" "))}"`);
  const inner: string[] = [];
  if (t.gloss) inner.push(serializeGloss(t.gloss));
  for (const a of t.aliases) inner.push(`<alias>${escapeText(a.text)}</alias>`);
  if (inner.length === 0) return `<term ${attrs.join(" ")}/>`;
  return `<term ${attrs.join(" ")}>${inner.join("")}</term>`;
}

function serializeGloss(g: GlossNode): string {
  return `<gloss>${escapeText(g.text)}</gloss>`;
}

function serializeAssumptions(node: AssumptionsNode): string {
  const parts = ["<assumptions>"];
  for (const a of node.assumptions) parts.push(serializeAssumption(a));
  parts.push("</assumptions>");
  return parts.join("");
}

function serializeAssumption(a: AssumptionNode): string {
  const attrs: string[] = [`id="${escapeAttr(a.id)}"`];
  if (a.restsOn.length > 0) attrs.push(`rests-on="${escapeAttr(a.restsOn.join(" "))}"`);
  if (a.provenance.length > 0) attrs.push(`provenance="${escapeAttr(a.provenance.join(" "))}"`);
  const inner: string[] = [escapeText(a.text)];
  if (a.note) inner.push(serializeNote(a.note));
  return `<assumption ${attrs.join(" ")}>${inner.join("")}</assumption>`;
}

function serializeBody(body: BodyNode): string {
  const parts = ["<body>"];
  for (const c of body.children) parts.push(serializeBlockOrInline(c));
  parts.push("</body>");
  return parts.join("");
}

function serializeBlockOrInline(node: BlockOrInline): string {
  switch (node.kind) {
    case "section":
      return serializeSection(node);
    case "p":
      return serializeParagraph(node);
    case "argument":
      return serializeArgument(node);
    default:
      return serializeInline(node);
  }
}

function serializeArgument(n: ArgumentNode): string {
  const attrs: string[] = [`mode="${escapeAttr(n.mode)}"`];
  if (n.id !== undefined) attrs.push(`id="${escapeAttr(n.id)}"`);
  if (n.supports.length > 0) attrs.push(`supports="${escapeAttr(n.supports.join(" "))}"`);
  if (n.restsOn.length > 0) attrs.push(`rests-on="${escapeAttr(n.restsOn.join(" "))}"`);
  if (n.via !== undefined) attrs.push(`via="${escapeAttr(n.via)}"`);
  if (n.attributedTo !== undefined) attrs.push(`attributed-to="${escapeAttr(n.attributedTo)}"`);
  if (n.provenance.length > 0) attrs.push(`provenance="${escapeAttr(n.provenance.join(" "))}"`);
  const inner = n.children.map(serializeBlockOrInline).join("");
  return `<argument ${attrs.join(" ")}>${inner}</argument>`;
}

function serializeSection(s: SectionNode): string {
  const attrs: string[] = [];
  if (s.id !== undefined) attrs.push(`id="${escapeAttr(s.id)}"`);
  const attrStr = attrs.length > 0 ? ` ${attrs.join(" ")}` : "";
  const parts = [`<section${attrStr}>`];
  if (s.heading) parts.push(serializeHeading(s.heading));
  for (const c of s.children) parts.push(serializeBlockOrInline(c));
  parts.push("</section>");
  return parts.join("");
}

function serializeHeading(h: HeadingNode): string {
  const inner = h.children.map(serializeInline).join("");
  return `<heading level="${h.level}">${inner}</heading>`;
}

function serializeParagraph(p: ParagraphNode): string {
  return `<p>${p.children.map(serializeInline).join("")}</p>`;
}

function serializeInline(node: InlineNode): string {
  switch (node.kind) {
    case "text":
      return escapeText(node.text);
    case "term-ref":
      return serializeTermRef(node);
    case "claim":
      return serializeClaim(node);
    case "inference":
      return serializeInference(node);
    case "conflict":
      return serializeConflict(node);
    case "evidence":
      return serializeEvidence(node);
    case "note":
      return serializeNote(node);
  }
}

function serializeTermRef(n: TermRefNode): string {
  return `<term ref="${escapeAttr(n.ref)}">${n.children.map(serializeInline).join("")}</term>`;
}

function serializeClaim(n: ClaimNode): string {
  const attrs: string[] = [`id="${escapeAttr(n.id)}"`];
  if (n.supports.length > 0) attrs.push(`supports="${escapeAttr(n.supports.join(" "))}"`);
  if (n.attacks.length > 0) attrs.push(`attacks="${escapeAttr(n.attacks.join(" "))}"`);
  if (n.attackType !== undefined) attrs.push(`attack-type="${n.attackType}"`);
  if (n.restsOn.length > 0) attrs.push(`rests-on="${escapeAttr(n.restsOn.join(" "))}"`);
  if (n.via !== undefined) attrs.push(`via="${escapeAttr(n.via)}"`);
  if (n.defeasible !== undefined) attrs.push(`defeasible="${n.defeasible ? "true" : "false"}"`);
  if (n.scheme !== undefined) attrs.push(`scheme="${escapeAttr(n.scheme)}"`);
  if (n.credence !== undefined)
    attrs.push(`credence="${escapeAttr(formatBucketOrNumeric(n.credence))}"`);
  if (n.mode !== undefined) attrs.push(`mode="${escapeAttr(n.mode)}"`);
  if (n.attributedTo !== undefined) attrs.push(`attributed-to="${escapeAttr(n.attributedTo)}"`);
  if (n.sameAs !== undefined) attrs.push(`same-as="${escapeAttr(n.sameAs)}"`);
  if (n.source !== undefined) attrs.push(`source="${escapeAttr(n.source)}"`);
  if (n.provenance.length > 0) attrs.push(`provenance="${escapeAttr(n.provenance.join(" "))}"`);
  return `<claim ${attrs.join(" ")}>${n.children.map(serializeInline).join("")}</claim>`;
}

function serializeInference(n: InferenceNode): string {
  const attrs: string[] = [`id="${escapeAttr(n.id)}"`];
  attrs.push(`from="${escapeAttr(n.from.join(" "))}"`);
  attrs.push(`to="${escapeAttr(n.to)}"`);
  if (n.scheme !== undefined) attrs.push(`scheme="${escapeAttr(n.scheme)}"`);
  if (n.pattern !== undefined) attrs.push(`pattern="${escapeAttr(n.pattern)}"`);
  if (n.defeasible !== undefined) attrs.push(`defeasible="${n.defeasible ? "true" : "false"}"`);
  if (n.strength !== undefined)
    attrs.push(`strength="${escapeAttr(formatBucketOrNumeric(n.strength))}"`);
  if (n.provenance.length > 0) attrs.push(`provenance="${escapeAttr(n.provenance.join(" "))}"`);
  return `<inference ${attrs.join(" ")}>${n.warrant.map(serializeInline).join("")}</inference>`;
}

function serializeConflict(n: ConflictNode): string {
  const attrs: string[] = [`id="${escapeAttr(n.id)}"`];
  if (n.attackType !== undefined) attrs.push(`attack-type="${n.attackType}"`);
  if (n.provenance.length > 0) attrs.push(`provenance="${escapeAttr(n.provenance.join(" "))}"`);
  const parts = [`<conflict ${attrs.join(" ")}>`];
  parts.push(serializeAttacker(n.attacker));
  parts.push(serializeTarget(n.target));
  if (n.response) parts.push(serializeResponse(n.response));
  parts.push("</conflict>");
  return parts.join("");
}

function serializeAttacker(a: AttackerRef): string {
  return `<attacker idref="${escapeAttr(a.idref)}"/>`;
}

function serializeTarget(t: TargetRef): string {
  return `<target idref="${escapeAttr(t.idref)}"/>`;
}

function serializeResponse(r: ResponseNode): string {
  return `<response>${r.children.map(serializeBlockOrInline).join("")}</response>`;
}

function serializeEvidence(e: EvidenceNode): string {
  const attrs: string[] = [`ref="${escapeAttr(e.ref)}"`];
  if (e.evidenceType !== undefined) attrs.push(`type="${escapeAttr(e.evidenceType)}"`);
  if (e.gloss) return `<evidence ${attrs.join(" ")}>${serializeGloss(e.gloss)}</evidence>`;
  return `<evidence ${attrs.join(" ")}/>`;
}

function serializeNote(n: NoteNode): string {
  const attrs: string[] = [];
  if (n.status !== undefined) attrs.push(`status="${escapeAttr(n.status)}"`);
  const attrStr = attrs.length > 0 ? ` ${attrs.join(" ")}` : "";
  return `<note${attrStr}>${escapeText(n.text)}</note>`;
}

function formatBucketOrNumeric(v: CredenceValue | StrengthValue): string {
  return v.kind === "numeric" ? v.raw : v.value;
}

function escapeText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
