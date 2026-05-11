import type {
  ArgMLDocument,
  AssumptionNode,
  BlockOrInline,
  BucketOrNumericValue,
  ClaimNode,
  ConflictNode,
  EvidenceNode,
  HeadingNode,
  InferenceNode,
  InlineNode,
  MetadataNode,
  NoteNode,
  ParagraphNode,
  SectionNode,
  TermDeclaration,
  TermRefNode,
  TextNode,
} from "../ast/index.js";
import { escapeAttr, escapeText } from "./escape.js";
import { ARGML_STYLES } from "./styles.js";

export interface RenderOptions {
  /** Inject extra CSS after the bundled stylesheet (escape-hat for examples). */
  readonly extraCss?: string;
}

export function renderHTML(doc: ArgMLDocument, options: RenderOptions = {}): string {
  const termIndex = buildTermIndex(doc);
  const ctx: RenderContext = { termIndex };

  const meta = doc.head.metadata;
  const title = meta.title ?? doc.id;
  const docLang = "en";

  const head = [
    "<head>",
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<title>${escapeText(title)}</title>`,
    "<style>",
    ARGML_STYLES,
    options.extraCss ? `\n${options.extraCss}` : "",
    "</style>",
    "</head>",
  ].join("\n");

  const body = [
    "<body>",
    `<article class="argml-page" id="${escapeAttr(doc.id)}">`,
    renderEpistemicBanner(meta),
    renderDocHeader(meta),
    renderAssumptionsPanel(doc.head.assumptions?.assumptions ?? []),
    ...doc.body.children.map((child) => renderBlockOrInline(child, ctx, true)),
    "</article>",
    "</body>",
  ]
    .filter((s) => s.length > 0)
    .join("\n");

  return ["<!doctype html>", `<html lang="${docLang}">`, head, body, "</html>", ""].join("\n");
}

interface RenderContext {
  readonly termIndex: Map<string, TermDeclaration>;
}

function buildTermIndex(doc: ArgMLDocument): Map<string, TermDeclaration> {
  const m = new Map<string, TermDeclaration>();
  for (const t of doc.head.terms?.terms ?? []) m.set(t.id, t);
  return m;
}

/* --------------------------------- Head ---------------------------------- */

function renderEpistemicBanner(meta: MetadataNode): string {
  if (!meta.epistemicStatus) return "";
  return `<aside class="argml-epistemic-status" aria-label="Epistemic status">${escapeText(meta.epistemicStatus)}</aside>`;
}

function renderDocHeader(meta: MetadataNode): string {
  const parts: string[] = ['<header class="argml-doc-header">'];
  if (meta.title) {
    parts.push(`<h1 class="argml-title">${escapeText(meta.title)}</h1>`);
  }
  const bylineBits: string[] = [];
  if (meta.authors.length > 0) bylineBits.push(escapeText(meta.authors.join(", ")));
  if (meta.date)
    bylineBits.push(`<time datetime="${escapeAttr(meta.date)}">${escapeText(meta.date)}</time>`);
  if (meta.source) {
    bylineBits.push(`<a href="${escapeAttr(meta.source)}" rel="noopener noreferrer">source</a>`);
  }
  if (bylineBits.length > 0) {
    parts.push(`<p class="argml-byline">${bylineBits.join(" · ")}</p>`);
  }
  parts.push("</header>");
  return parts.join("\n");
}

function renderAssumptionsPanel(assumptions: AssumptionNode[]): string {
  if (assumptions.length === 0) return "";
  const items = assumptions
    .map(
      (a) =>
        `<li id="${escapeAttr(a.id)}"><span class="argml-assumption-id">${escapeText(a.id)}</span>${escapeText(a.text)}${
          a.restsOn.length > 0
            ? ` <span class="argml-rests-on">rests on ${a.restsOn
                .map((r) => referenceLink(r))
                .join(", ")}</span>`
            : ""
        }</li>`,
    )
    .join("\n");
  return `<section class="argml-assumptions" aria-label="Assumptions">
<h2>Assumptions</h2>
<ol>
${items}
</ol>
</section>`;
}

/* --------------------------------- Body ---------------------------------- */

function renderBlockOrInline(node: BlockOrInline, ctx: RenderContext, topLevel: boolean): string {
  switch (node.kind) {
    case "section":
      return renderSection(node, ctx);
    case "p":
      return renderParagraph(node, ctx);
    default:
      // Body may contain bare inline elements (e.g. block-level inference/conflict).
      // Wrap stray inline text/term-ref in a paragraph at the top level.
      if (topLevel && needsParagraphWrap(node)) {
        return `<p>${renderInline(node, ctx)}</p>`;
      }
      return renderInline(node, ctx);
  }
}

function needsParagraphWrap(n: InlineNode): boolean {
  return (
    n.kind === "text" ||
    n.kind === "term-ref" ||
    n.kind === "claim" ||
    n.kind === "evidence" ||
    n.kind === "note"
  );
}

function renderSection(node: SectionNode, ctx: RenderContext): string {
  const idAttr = node.id ? ` id="${escapeAttr(node.id)}"` : "";
  const heading = node.heading ? renderHeading(node.heading, ctx) : "";
  const children = node.children.map((child) => renderBlockOrInline(child, ctx, true)).join("\n");
  return `<section class="argml-section"${idAttr}>
${heading}
${children}
</section>`;
}

function renderHeading(node: HeadingNode, ctx: RenderContext): string {
  // ArgML levels 1..6 map to <h2>..<h6> (h1 is reserved for the document title).
  const clamped = Math.max(1, Math.min(6, Math.floor(node.level)));
  const tag = `h${Math.min(6, clamped + 1)}`;
  const inner = node.children.map((c) => renderInline(c, ctx)).join("");
  return `<${tag}>${inner}</${tag}>`;
}

function renderParagraph(node: ParagraphNode, ctx: RenderContext): string {
  const inner = node.children.map((c) => renderInline(c, ctx)).join("");
  return `<p>${inner}</p>`;
}

function renderInline(node: InlineNode, ctx: RenderContext): string {
  switch (node.kind) {
    case "text":
      return renderText(node);
    case "term-ref":
      return renderTermRef(node, ctx);
    case "claim":
      return renderClaim(node, ctx);
    case "inference":
      return renderInference(node, ctx);
    case "conflict":
      return renderConflict(node, ctx);
    case "evidence":
      return renderEvidence(node);
    case "note":
      return renderNote(node);
  }
}

function renderText(node: TextNode): string {
  return escapeText(node.text);
}

function renderTermRef(node: TermRefNode, ctx: RenderContext): string {
  const decl = ctx.termIndex.get(node.ref);
  const external = node.ref.includes(":") && !decl;
  const tooltip = buildTermTooltip(node.ref, decl, external);
  const classes = ["argml-term"];
  if (external) classes.push("argml-external");
  const inner = node.children.map((c) => renderInline(c, ctx)).join("");
  const tooltipAttr = tooltip ? ` data-tooltip-summary="${escapeAttr(tooltip)}"` : "";
  const refAttr = ` data-term-ref="${escapeAttr(node.ref)}"`;
  return `<span class="${classes.join(" ")}" tabindex="0"${refAttr}${tooltipAttr}>${inner}</span>`;
}

function buildTermTooltip(
  ref: string,
  decl: TermDeclaration | undefined,
  external: boolean,
): string {
  const lines: string[] = [];
  if (decl) {
    lines.push(`term: ${decl.id}`);
    if (decl.gloss) lines.push(decl.gloss.text);
    if (decl.canonical) lines.push(`canonical: ${decl.canonical}`);
    if (decl.scope === "local") lines.push("scope: local");
    if (decl.aliases.length > 0) {
      lines.push(`aliases: ${decl.aliases.map((a) => a.text).join(", ")}`);
    }
  } else if (external) {
    lines.push(`external term: ${ref}`);
    lines.push("(import not resolved at this phase)");
  } else {
    lines.push(`term: ${ref}`);
    lines.push("(unresolved)");
  }
  return lines.join("\n");
}

function renderClaim(node: ClaimNode, ctx: RenderContext): string {
  const classes = ["argml-claim"];
  if (node.defeasible === false) classes.push("argml-defeasible-false");
  else classes.push("argml-defeasible-true");

  const tooltip = buildClaimTooltip(node);
  const tooltipAttr = ` data-tooltip-summary="${escapeAttr(tooltip)}"`;

  const marker = `<a class="argml-claim-marker" href="#${escapeAttr(node.id)}" aria-label="Claim ${escapeAttr(node.id)}">${escapeText(node.id)}</a>`;
  const credenceBadge = node.credence ? renderCredenceBadge(node.credence) : "";
  const restsOnBadge = renderRestsOnBadges(node.restsOn);
  const inner = node.children.map((c) => renderInline(c, ctx)).join("");

  return `<span class="${classes.join(" ")}" id="${escapeAttr(node.id)}" tabindex="0"${tooltipAttr}>${marker}${credenceBadge}${inner}${restsOnBadge}</span>`;
}

function buildClaimTooltip(node: ClaimNode): string {
  const lines: string[] = [`claim: ${node.id}`];
  if (node.credence) lines.push(`credence: ${valueText(node.credence)}`);
  if (node.defeasible === false) lines.push("defeasible: false (strict)");
  if (node.scheme) lines.push(`scheme: ${node.scheme}`);
  if (node.supports.length > 0) lines.push(`supports: ${node.supports.join(", ")}`);
  if (node.attacks.length > 0) {
    const at = node.attackType ?? "rebut";
    lines.push(`attacks (${at}): ${node.attacks.join(", ")}`);
  }
  if (node.restsOn.length > 0) lines.push(`rests on: ${node.restsOn.join(", ")}`);
  if (node.via) lines.push(`via inference: ${node.via}`);
  return lines.join("\n");
}

function renderCredenceBadge(v: BucketOrNumericValue): string {
  if (v.kind === "bucket") {
    const cls = `argml-credence-${v.value}`;
    return ` <span class="argml-credence ${cls}">${escapeText(v.value)}</span> `;
  }
  return ` <span class="argml-credence">${escapeText(v.raw)}</span> `;
}

function renderStrengthBadge(v: BucketOrNumericValue): string {
  if (v.kind === "bucket") {
    const cls = `argml-strength-${v.value}`;
    return `<span class="argml-strength ${cls}">${escapeText(v.value)}</span>`;
  }
  return `<span class="argml-strength">${escapeText(v.raw)}</span>`;
}

function renderRestsOnBadges(restsOn: readonly string[]): string {
  if (restsOn.length === 0) return "";
  const items = restsOn.map((r) => referenceLink(r)).join(", ");
  return ` <span class="argml-rests-on">[rests on ${items}]</span>`;
}

function referenceLink(ref: string): string {
  // Local refs link to their anchor; cross-doc refs render as plain text.
  if (ref.includes(":")) {
    return `<span class="argml-external" data-ref="${escapeAttr(ref)}">${escapeText(ref)}</span>`;
  }
  return `<a href="#${escapeAttr(ref)}">${escapeText(ref)}</a>`;
}

function renderInference(node: InferenceNode, ctx: RenderContext): string {
  const classes = ["argml-inference"];
  if (node.defeasible === false) classes.push("argml-defeasible-false");
  else classes.push("argml-defeasible-true");

  const tooltip = buildInferenceTooltip(node);
  const tooltipAttr = ` data-tooltip-summary="${escapeAttr(tooltip)}"`;

  const headerBits: string[] = [
    `inference ${escapeText(node.id)}`,
    `${escapeText(node.from.join(" ∧ "))} ⊢ ${escapeText(node.to)}`,
  ];
  if (node.scheme) headerBits.push(escapeText(node.scheme));
  const label = headerBits.join(" · ");
  const strength = node.strength ? ` ${renderStrengthBadge(node.strength)}` : "";
  const warrant = node.warrant.map((c) => renderInline(c, ctx)).join("");

  return `<aside class="${classes.join(" ")}" id="${escapeAttr(node.id)}" tabindex="0"${tooltipAttr}>
<span class="argml-inference-label">${label}${strength}</span>
${warrant}
</aside>`;
}

function buildInferenceTooltip(node: InferenceNode): string {
  const lines: string[] = [`inference: ${node.id}`];
  lines.push(`from: ${node.from.join(", ")}`);
  lines.push(`to: ${node.to}`);
  if (node.scheme) lines.push(`scheme: ${node.scheme}`);
  if (node.defeasible === false) lines.push("defeasible: false (strict)");
  else lines.push("defeasible: true");
  if (node.strength) lines.push(`strength: ${valueText(node.strength)}`);
  return lines.join("\n");
}

function renderConflict(node: ConflictNode, ctx: RenderContext): string {
  const at = node.attackType ?? "rebut";
  const attacker = referenceLink(node.attacker.idref);
  const target = referenceLink(node.target.idref);
  const response = node.response
    ? `<div class="argml-conflict-response">${node.response.children
        .map((c) => renderBlockOrInline(c, ctx, false))
        .join("\n")}</div>`
    : "";
  return `<aside class="argml-conflict" id="${escapeAttr(node.id)}">
<span class="argml-conflict-label">conflict ${escapeText(node.id)} · ${escapeText(at)}</span>
<span class="argml-conflict-attack">${attacker} → ${target}</span>
${response}
</aside>`;
}

function renderEvidence(node: EvidenceNode): string {
  const isUrl = /^https?:\/\//i.test(node.ref);
  const tooltipParts: string[] = [];
  if (node.evidenceType) tooltipParts.push(`type: ${node.evidenceType}`);
  tooltipParts.push(`ref: ${node.ref}`);
  if (node.gloss) tooltipParts.push(node.gloss.text);
  const tooltipAttr = ` data-tooltip-summary="${escapeAttr(tooltipParts.join("\n"))}"`;
  const inner = isUrl
    ? `<a href="${escapeAttr(node.ref)}" rel="noopener noreferrer">★</a>`
    : "<span>★</span>";
  return `<sup class="argml-evidence"${tooltipAttr}>${inner}</sup>`;
}

function renderNote(node: NoteNode): string {
  const tooltipParts: string[] = ["note"];
  if (node.status) tooltipParts.push(`status: ${node.status}`);
  const tooltipAttr = ` data-tooltip-summary="${escapeAttr(tooltipParts.join("\n"))}"`;
  return `<span class="argml-note"${tooltipAttr}>${escapeText(node.text)}</span>`;
}

function valueText(v: BucketOrNumericValue): string {
  return v.kind === "bucket" ? v.value : v.raw;
}
