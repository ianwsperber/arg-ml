// Client-side renderer for ArgML documents.
//
// Compiled by `tsconfig.client.json` and bundled into `assets.generated.ts` by
// `scripts/generate-render-assets.ts`. The bundler strips `export` keywords and
// appends `mount(document, window);` inside an IIFE, producing a single inline
// script for `renderHTML` to emit.
//
// Pure helpers are exported so they can be unit-tested without a DOM.

export const NS = "urn:argml:v1";

// ============================================================================
// Types
// ============================================================================

export interface TermDecl {
  readonly id: string;
  readonly canonical: string | null;
  readonly scope: string | null;
  readonly gloss: string | null;
  readonly aliases: readonly string[];
}

export interface AssumptionDecl {
  readonly id: string;
  readonly text: string;
  readonly restsOn: string | null;
}

export interface ClaimRec {
  readonly id: string;
  readonly supports: readonly string[];
  readonly attacks: readonly string[];
  readonly restsOn: readonly string[];
  readonly via: string | null;
  readonly credence: string | null;
  readonly attackType: string;
  readonly defeasible: string;
  readonly scheme: string | null;
  /** Spec §6.7: speech-act / discourse status. Null when default `asserted`. */
  readonly mode: string | null;
  /** Spec §6.9: party to whom an attributed claim is ascribed. */
  readonly attributedTo: string | null;
  /** Spec §6.10: identifier of an equivalent claim. */
  readonly sameAs: string | null;
  /** Spec §6.9: external source URL for an attributed claim. */
  readonly source: string | null;
  /** Spec §5.2: space-separated list of generator ids. */
  readonly provenance: readonly string[];
}

export interface InferenceRec {
  readonly id: string;
  readonly from: readonly string[];
  readonly to: string | null;
  readonly scheme: string | null;
  readonly strength: string | null;
  readonly defeasible: string;
  readonly warrant: string;
  /** Spec §10.2: compositional pattern (e.g. `reductio-ad-absurdum`). */
  readonly pattern: string | null;
  /** Spec §5.2: space-separated list of generator ids. */
  readonly provenance: readonly string[];
}

export interface ArgumentRec {
  readonly id: string;
  readonly mode: string;
  readonly supports: readonly string[];
  readonly restsOn: readonly string[];
  readonly via: string | null;
  readonly attributedTo: string | null;
  readonly provenance: readonly string[];
}

export interface GeneratorRec {
  readonly id: string;
  readonly type: string | null;
  readonly who: string | null;
  readonly model: string | null;
  readonly date: string | null;
  readonly role: string | null;
}

export interface TakeawayRec {
  readonly ref: string;
  readonly priority: string | null;
}

export interface NoteRec {
  readonly idx: number;
  readonly html: string;
  readonly editorial: boolean;
}

export interface Metadata {
  readonly title: string;
  readonly author: string;
  readonly date: string;
  readonly source: string;
  readonly epistemicStatus: string | null;
}

export interface RenderState {
  readonly imports: Record<string, string>;
  readonly terms: Record<string, TermDecl>;
  readonly assumptions: Record<string, AssumptionDecl>;
  readonly claims: Record<string, ClaimRec>;
  readonly inferences: Record<string, InferenceRec>;
  readonly arguments: Record<string, ArgumentRec>;
  readonly generators: Record<string, GeneratorRec>;
  readonly takeaways: TakeawayRec[];
  readonly notes: NoteRec[];
  noteCounter: number;
}

// ============================================================================
// Pure helpers
// ============================================================================

export function escapeHtml(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function escapeAttr(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

// URL-scheme allowlist for any href emitted into rendered HTML. Rejects
// javascript:, data:, vbscript:, file:, etc. — schemes that would execute or
// exfiltrate when the user clicks. Returns null for rejected URLs so callers
// can fall back to rendering plain text.
const SAFE_SCHEME = /^(?:https?|mailto):/i;
export function safeHref(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = String(url).trim();
  if (!trimmed) return null;
  // Fragment-only and relative paths are safe (no scheme).
  if (
    trimmed.startsWith("#") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("./") ||
    trimmed.startsWith("../")
  ) {
    return trimmed;
  }
  // If the value looks like it has a scheme, require it to be on the allowlist.
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return SAFE_SCHEME.test(trimmed) ? trimmed : null;
  }
  // Otherwise treat as a relative path.
  return trimmed;
}

export function parseList(s: string | null | undefined): string[] {
  if (!s) return [];
  return s
    .trim()
    .split(/\s+/)
    .filter((x) => x.length > 0);
}

export function mdLinks(s: string): string {
  return s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) => {
    const safe = safeHref(u);
    if (!safe) return escapeHtml(t);
    return `<a href="${escapeAttr(safe)}" target="_blank" rel="noopener">${escapeHtml(t)}</a>`;
  });
}

export function formatDate(d: string): string {
  if (!d) return "";
  try {
    const parsed = new Date(d);
    if (Number.isNaN(parsed.getTime())) return d;
    return parsed.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return d;
  }
}

export function refLabel(ref: string): string {
  if (!ref) return "";
  if (ref.includes(":")) {
    const [pref, rest] = ref.split(":");
    return `<span class="pref">${escapeHtml(pref ?? "")}</span>:${escapeHtml(rest ?? "")}`;
  }
  return escapeHtml(ref);
}

// ============================================================================
// Element helpers
// ============================================================================

function childrenByName(el: Element, name: string): Element[] {
  return Array.from(el.children).filter((c) => c.localName === name);
}

function firstChild(el: Element, name: string): Element | null {
  return childrenByName(el, name)[0] ?? null;
}

function textOf(el: Element | null | undefined): string {
  return el?.textContent?.trim() ?? "";
}

function attr(el: Element, name: string): string | null {
  return el.getAttribute(name);
}

// ============================================================================
// Collectors (XML doc → typed records)
// ============================================================================

export function collectMetadata(doc: Document): Metadata {
  const md = doc.querySelector("metadata");
  if (!md) {
    return { title: "", author: "", date: "", source: "", epistemicStatus: null };
  }
  return {
    title: textOf(md.querySelector("title")),
    author: textOf(md.querySelector("author")),
    date: textOf(md.querySelector("date")),
    source: textOf(md.querySelector("source")),
    epistemicStatus: md.querySelector("epistemic-status")?.textContent?.trim() ?? null,
  };
}

export function collectImports(doc: Document): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of Array.from(doc.querySelectorAll("imports > import"))) {
    const prefix = i.getAttribute("prefix");
    const url = i.getAttribute("doc");
    if (prefix && url) out[prefix] = url;
  }
  return out;
}

export function collectTerms(doc: Document): Record<string, TermDecl> {
  const out: Record<string, TermDecl> = {};
  for (const t of Array.from(doc.querySelectorAll("terms > term"))) {
    const id = t.getAttribute("id");
    if (!id) continue;
    out[id] = {
      id,
      canonical: t.getAttribute("canonical"),
      scope: t.getAttribute("scope"),
      gloss: textOf(firstChild(t, "gloss")) || null,
      aliases: childrenByName(t, "alias").map((a) => textOf(a)),
    };
  }
  return out;
}

export function collectAssumptions(doc: Document): Record<string, AssumptionDecl> {
  const out: Record<string, AssumptionDecl> = {};
  for (const a of Array.from(doc.querySelectorAll("assumptions > assumption"))) {
    const id = a.getAttribute("id");
    if (!id) continue;
    out[id] = {
      id,
      text: a.textContent?.trim() ?? "",
      restsOn: a.getAttribute("rests-on"),
    };
  }
  return out;
}

export function collectGenerators(doc: Document): Record<string, GeneratorRec> {
  const out: Record<string, GeneratorRec> = {};
  for (const g of Array.from(doc.querySelectorAll("provenance > generator"))) {
    const id = g.getAttribute("id");
    if (!id) continue;
    out[id] = {
      id,
      type: g.getAttribute("type"),
      who: g.getAttribute("who"),
      model: g.getAttribute("model"),
      date: g.getAttribute("date"),
      role: g.getAttribute("role"),
    };
  }
  return out;
}

export function collectTakeaways(doc: Document): TakeawayRec[] {
  const out: TakeawayRec[] = [];
  for (const t of Array.from(doc.querySelectorAll("takeaways > takeaway"))) {
    const ref = t.getAttribute("ref");
    if (!ref) continue;
    out.push({ ref, priority: t.getAttribute("priority") });
  }
  return out;
}

export function createState(doc: Document): RenderState {
  return {
    imports: collectImports(doc),
    terms: collectTerms(doc),
    assumptions: collectAssumptions(doc),
    claims: {},
    inferences: {},
    arguments: {},
    generators: collectGenerators(doc),
    takeaways: collectTakeaways(doc),
    notes: [],
    noteCounter: 1,
  };
}

// ============================================================================
// renderNode: tree-walk producing HTML strings, mutating state.{claims,inferences,notes}
// ============================================================================

export function renderNode(node: Node, state: RenderState): string {
  if (node.nodeType === 3 /* TEXT_NODE */) {
    return mdLinks(escapeHtml(node.nodeValue ?? ""));
  }
  if (node.nodeType !== 1 /* ELEMENT_NODE */) return "";
  const el = node as Element;
  const name = el.localName;
  const inner = Array.from(el.childNodes)
    .map((c) => renderNode(c, state))
    .join("");

  switch (name) {
    case "section":
      return `<section>${inner}</section>`;
    case "heading": {
      const rawLevel = Number.parseInt(attr(el, "level") ?? "1", 10);
      const lvl = Math.min(6, Math.max(1, Number.isFinite(rawLevel) ? rawLevel : 1));
      return `<h${lvl}><span class="h-rule"></span>${inner}</h${lvl}>`;
    }
    case "p":
      return `<p>${inner}</p>`;
    case "em":
      return `<em>${inner}</em>`;
    case "strong":
      return `<strong>${inner}</strong>`;
    case "code":
      return `<code>${inner}</code>`;
    case "a": {
      const safe = safeHref(attr(el, "href"));
      if (!safe) return inner;
      return `<a href="${escapeAttr(safe)}" target="_blank" rel="noopener">${inner}</a>`;
    }

    case "term": {
      const ref = attr(el, "ref") ?? "";
      const isExternal = ref.includes(":");
      return `<span class="ann ann-term" data-ref="${escapeAttr(ref)}" data-external="${isExternal}">${inner}</span>`;
    }

    case "claim": {
      const id = attr(el, "id") ?? "";
      const rec: ClaimRec = {
        id,
        supports: parseList(attr(el, "supports")),
        attacks: parseList(attr(el, "attacks")),
        restsOn: parseList(attr(el, "rests-on")),
        via: attr(el, "via"),
        credence: attr(el, "credence"),
        attackType: attr(el, "attack-type") ?? "rebut",
        defeasible: attr(el, "defeasible") ?? "true",
        scheme: attr(el, "scheme"),
        mode: attr(el, "mode"),
        attributedTo: attr(el, "attributed-to"),
        sameAs: attr(el, "same-as"),
        source: attr(el, "source"),
        provenance: parseList(attr(el, "provenance")),
      };
      state.claims[id] = rec;
      const dataMode =
        rec.mode && rec.mode !== "asserted" ? ` data-mode="${escapeAttr(rec.mode)}"` : "";
      const dataSameAs = rec.sameAs ? ` data-same-as="${escapeAttr(rec.sameAs)}"` : "";
      const dataAttrTo = rec.attributedTo
        ? ` data-attributed-to="${escapeAttr(rec.attributedTo)}"`
        : "";
      const dataProv =
        rec.provenance.length > 0
          ? ` data-provenance="${escapeAttr(rec.provenance.join(" "))}"`
          : "";
      return `<span class="ann ann-claim" id="claim-${escapeAttr(id)}" data-id="${escapeAttr(id)}" data-defeasible="${escapeAttr(rec.defeasible)}"${dataMode}${dataSameAs}${dataAttrTo}${dataProv}>${inner}</span>`;
    }

    case "argument": {
      const id = attr(el, "id") ?? "";
      const mode = attr(el, "mode") ?? "";
      const rec: ArgumentRec = {
        id,
        mode,
        supports: parseList(attr(el, "supports")),
        restsOn: parseList(attr(el, "rests-on")),
        via: attr(el, "via"),
        attributedTo: attr(el, "attributed-to"),
        provenance: parseList(attr(el, "provenance")),
      };
      if (id) state.arguments[id] = rec;
      const supportsAttr =
        rec.supports.length > 0 ? ` data-supports="${escapeAttr(rec.supports.join(" "))}"` : "";
      const idAttr = id ? ` id="arg-${escapeAttr(id)}" data-id="${escapeAttr(id)}"` : "";
      const attrTo = rec.attributedTo
        ? ` data-attributed-to="${escapeAttr(rec.attributedTo)}"`
        : "";
      const headLabel = rec.attributedTo
        ? `${escapeHtml(mode)} — attributed to ${escapeHtml(rec.attributedTo)}`
        : escapeHtml(mode);
      const idChip = id ? `<span class="arg-id">${escapeHtml(id)}</span>` : "";
      const supportsLabel = rec.supports.length
        ? `<span class="arg-supports">supports ${rec.supports.map((r) => escapeHtml(r)).join(", ")}</span>`
        : "";
      return `<aside class="argument-block" data-mode="${escapeAttr(mode)}"${idAttr}${supportsAttr}${attrTo}>
          <div class="arg-head">${idChip}<span class="arg-mode">${headLabel}</span>${supportsLabel}</div>
          ${inner}
        </aside>`;
    }

    case "evidence": {
      const ref = attr(el, "ref") ?? "";
      const type = attr(el, "type") ?? "src";
      const gloss = textOf(firstChild(el, "gloss"));
      const safe = safeHref(ref);
      if (!safe) {
        return `<span class="ann ann-evidence" data-type="${escapeAttr(type)}" data-gloss="${escapeAttr(gloss)}">${escapeHtml(type)}</span>`;
      }
      return `<a class="ann ann-evidence" href="${escapeAttr(safe)}" target="_blank" rel="noopener" data-type="${escapeAttr(type)}" data-gloss="${escapeAttr(gloss)}">${escapeHtml(type)}</a>`;
    }

    case "note": {
      const idx = state.noteCounter++;
      const status = attr(el, "status") ?? "";
      state.notes.push({ idx, html: inner, editorial: status === "editorial" });
      return `<a class="ann ann-note-marker" href="#fn-${idx}" data-idx="${idx}">${idx}</a>`;
    }

    case "inference": {
      const id = attr(el, "id") ?? "";
      const from = parseList(attr(el, "from"));
      const to = attr(el, "to");
      const scheme = attr(el, "scheme");
      const strength = attr(el, "strength");
      const defeasible = attr(el, "defeasible") ?? "true";
      const pattern = attr(el, "pattern");
      const provenance = parseList(attr(el, "provenance"));
      state.inferences[id] = {
        id,
        from,
        to,
        scheme,
        strength,
        defeasible,
        warrant: inner,
        pattern,
        provenance,
      };
      const meta = [
        from.length && to ? `${from.join(" + ")} → ${to}` : null,
        scheme,
        pattern ? `pattern: ${pattern}` : null,
        strength ? `strength: ${strength}` : null,
        defeasible === "false" ? "strict" : null,
      ]
        .filter((x): x is string => Boolean(x))
        .join(" · ");
      const dataPattern = pattern ? ` data-pattern="${escapeAttr(pattern)}"` : "";
      const dataProv =
        provenance.length > 0 ? ` data-provenance="${escapeAttr(provenance.join(" "))}"` : "";
      return `<aside class="inference-block" id="inf-${escapeAttr(id)}" data-id="${escapeAttr(id)}"${dataPattern}${dataProv}>
          <span class="inf-head">Inference ${escapeHtml(id)} <span class="inf-meta">${escapeHtml(meta)}</span></span>
          ${inner}
        </aside>`;
    }

    case "conflict": {
      const id = attr(el, "id") ?? "";
      const attackType = attr(el, "attack-type") ?? "rebut";
      const attacker = el.querySelector("attacker")?.getAttribute("idref") ?? "";
      const target = el.querySelector("target")?.getAttribute("idref") ?? "";
      const resp = el.querySelector("response");
      const respHtml = resp
        ? Array.from(resp.childNodes)
            .map((c) => renderNode(c, state))
            .join("")
        : "";
      return `<aside class="inference-block" id="conf-${escapeAttr(id)}">
          <span class="inf-head">Conflict ${escapeHtml(id)} <span class="inf-meta">${escapeHtml(attackType)}: ${escapeHtml(attacker)} → ${escapeHtml(target)}</span></span>
          ${respHtml}
        </aside>`;
    }

    default:
      return inner;
  }
}

export function renderProse(bodyEl: Element, state: RenderState): string {
  return Array.from(bodyEl.childNodes)
    .map((c) => renderNode(c, state))
    .join("");
}

// ============================================================================
// Frontmatter
// ============================================================================

export function renderFrontmatter(state: RenderState): string {
  let out = "";

  const importEntries = Object.entries(state.imports);
  if (importEntries.length) {
    out += `<div class="fm-block"><h3>Imports <span class="count">${importEntries.length}</span></h3>`;
    for (const [pref, url] of importEntries) {
      const safe = safeHref(url);
      const urlCell = safe
        ? `<a href="${escapeAttr(safe)}" target="_blank" rel="noopener">${escapeHtml(url)}</a>`
        : escapeHtml(url);
      out += `<div class="fm-row"><div class="key">${escapeHtml(pref)}:</div>
          <div class="desc">${urlCell}</div></div>`;
    }
    out += "</div>";
  }

  const termList = Object.values(state.terms);
  if (termList.length) {
    out += `<div class="fm-block"><h3>Terms <span class="count">${termList.length}</span></h3>`;
    for (const t of termList) {
      const aliases = t.aliases.length
        ? `<div>${t.aliases.map((a) => `<span class="alias">${escapeHtml(a)}</span>`).join("")}</div>`
        : "";
      const canon = t.canonical
        ? `<span class="canon">canonical: ${escapeHtml(t.canonical)}${t.scope === "local" ? " · local scope" : ""}</span>`
        : t.scope === "local"
          ? `<span class="canon">local scope</span>`
          : "";
      out += `<div class="fm-row">
          <div class="key">${escapeHtml(t.id)}</div>
          <div class="desc">${t.gloss ? escapeHtml(t.gloss) : "<em>(no gloss)</em>"}${aliases}${canon}</div>
        </div>`;
    }
    out += "</div>";
  }

  const assumptionList = Object.values(state.assumptions);
  if (assumptionList.length) {
    out += `<div class="fm-block"><h3>Assumptions <span class="count">${assumptionList.length}</span></h3>`;
    for (const a of assumptionList) {
      out += `<div class="fm-row">
          <div class="key">${escapeHtml(a.id)}</div>
          <div class="desc">${escapeHtml(a.text)}${a.restsOn ? `<span class="canon">rests on: ${escapeHtml(a.restsOn)}</span>` : ""}</div>
        </div>`;
    }
    out += "</div>";
  }

  if (state.takeaways.length) {
    out += `<div class="fm-block fm-takeaways"><h3>Takeaways <span class="count">${state.takeaways.length}</span></h3>`;
    for (const t of state.takeaways) {
      const pri = t.priority
        ? `<span class="takeaway-priority takeaway-${escapeAttr(t.priority)}">${escapeHtml(t.priority)}</span>`
        : "";
      out += `<div class="fm-row">
          <div class="key"><a href="#claim-${escapeAttr(t.ref)}">${escapeHtml(t.ref)}</a></div>
          <div class="desc">${pri}</div>
        </div>`;
    }
    out += "</div>";
  }

  const generatorList = Object.values(state.generators);
  if (generatorList.length) {
    out += `<div class="fm-block fm-provenance"><h3>Provenance <span class="count">${generatorList.length}</span></h3>`;
    for (const g of generatorList) {
      const who = g.who ? escapeHtml(g.who) : g.model ? escapeHtml(g.model) : "(unattributed)";
      const role = g.role ? `<span class="canon">${escapeHtml(g.role)}</span>` : "";
      const date = g.date ? `<span class="canon">${escapeHtml(g.date)}</span>` : "";
      const type = g.type ? `<span class="canon">${escapeHtml(g.type)}</span>` : "";
      out += `<div class="fm-row">
          <div class="key">${escapeHtml(g.id)}</div>
          <div class="desc">${who}${type}${role}${date}</div>
        </div>`;
    }
    out += "</div>";
  }

  return out;
}

// ============================================================================
// Gloss builders
// ============================================================================

export function buildClaimGloss(id: string, state: RenderState): string {
  const c = state.claims[id];
  if (!c) return "";
  const cred = c.credence
    ? `<span class="cred"><span class="cred-dot cred-${escapeAttr(c.credence)}"></span>${escapeHtml(c.credence)}</span>`
    : "";
  const modeBadge =
    c.mode && c.mode !== "asserted"
      ? `<span class="mode-badge mode-${escapeAttr(c.mode)}">${escapeHtml(c.mode)}</span>`
      : "";
  const rels: string[] = [];
  const relRow = (kind: string, label: string, refs: readonly string[]): string =>
    `<div class="rel ${kind}"><div class="key">${escapeHtml(label)}</div><div class="vals">${refs
      .map(
        (r) =>
          `<a data-target="${escapeAttr(r)}" data-rel="${escapeAttr(kind)}">${refLabel(r)}</a>`,
      )
      .join("")}</div></div>`;
  if (c.supports.length) rels.push(relRow("supports", "supports", c.supports));
  if (c.attacks.length) rels.push(relRow("attacks", `${c.attackType}s`, c.attacks));
  if (c.restsOn.length) rels.push(relRow("rests-on", "rests on", c.restsOn));
  if (c.via) {
    rels.push(
      `<div class="rel"><div class="key">via</div><div class="vals"><a data-target="${escapeAttr(c.via)}">${escapeHtml(c.via)}</a></div></div>`,
    );
  }
  if (c.sameAs) {
    rels.push(
      `<div class="rel same-as"><div class="key">same as</div><div class="vals"><a data-target="${escapeAttr(c.sameAs)}" data-rel="same-as">${refLabel(c.sameAs)}</a></div></div>`,
    );
  }
  if (c.attributedTo) {
    rels.push(
      `<div class="rel"><div class="key">attributed to</div><div class="vals">${escapeHtml(c.attributedTo)}</div></div>`,
    );
  }
  if (c.source) {
    const safe = safeHref(c.source);
    const src = safe
      ? `<a href="${escapeAttr(safe)}" target="_blank" rel="noopener">${escapeHtml(c.source)}</a>`
      : escapeHtml(c.source);
    rels.push(`<div class="rel"><div class="key">source</div><div class="vals">${src}</div></div>`);
  }
  if (c.provenance.length) {
    rels.push(
      `<div class="rel"><div class="key">provenance</div><div class="vals">${c.provenance.map((p) => `<span class="prov">${escapeHtml(p)}</span>`).join(" → ")}</div></div>`,
    );
  }
  return `
      <div class="gloss-head">
        <span class="id">${escapeHtml(id)}</span>
        ${modeBadge}
        ${cred}
        ${c.defeasible === "false" ? '<span class="cred">strict</span>' : ""}
      </div>
      ${rels.join("")}
    `;
}

export function buildTermGloss(ref: string, state: RenderState): string {
  if (ref.includes(":")) {
    const [pref, _rest] = ref.split(":");
    const url = state.imports[pref ?? ""] ?? "";
    return `<div class="gloss-head"><span class="id">${escapeHtml(ref)}</span><span class="cred">imported</span></div>
        <div class="term-def">Cross-document reference. Prefix <code style="font-family:inherit">${escapeHtml(pref ?? "")}</code> bound to ${escapeHtml(url || "(unbound)")}.</div>`;
  }
  const t = state.terms[ref];
  if (!t) {
    return `<div class="gloss-head"><span class="id">${escapeHtml(ref)}</span><span class="cred">undefined</span></div>`;
  }
  return `
      <div class="gloss-head">
        <span class="id">term:${escapeHtml(t.id)}</span>
        ${t.scope === "local" ? '<span class="cred">local</span>' : '<span class="cred">canonical</span>'}
      </div>
      ${t.gloss ? `<div class="term-def">${escapeHtml(t.gloss)}</div>` : ""}
      ${t.aliases.length ? `<div class="term-aliases">aka ${t.aliases.map((a) => `“${escapeHtml(a)}”`).join(", ")}</div>` : ""}
      ${t.canonical ? `<div class="term-aliases">canonical: ${escapeHtml(t.canonical)}</div>` : ""}
    `;
}

export function buildInferenceGloss(id: string, state: RenderState): string {
  const inf = state.inferences[id];
  if (!inf) return "";
  const fromVals = inf.from
    .map((r) => `<a data-target="${escapeAttr(r)}">${escapeHtml(r)}</a>`)
    .join("");
  return `<div class="gloss-head">
      <span class="id">${escapeHtml(id)}</span>
      ${inf.strength ? `<span class="cred"><span class="cred-dot str-${escapeAttr(inf.strength)}"></span>${escapeHtml(inf.strength)}</span>` : ""}
    </div>
    <div class="rel supports"><div class="key">from</div><div class="vals">${fromVals}</div></div>
    <div class="rel supports"><div class="key">to</div><div class="vals"><a data-target="${escapeAttr(inf.to ?? "")}">${escapeHtml(inf.to ?? "")}</a></div></div>
    ${inf.scheme ? `<div class="rel"><div class="key">scheme</div><div class="vals">${escapeHtml(inf.scheme)}</div></div>` : ""}
    ${inf.pattern ? `<div class="rel"><div class="key">pattern</div><div class="vals">${escapeHtml(inf.pattern)}</div></div>` : ""}
    ${inf.provenance.length ? `<div class="rel"><div class="key">provenance</div><div class="vals">${inf.provenance.map((p) => `<span class="prov">${escapeHtml(p)}</span>`).join(" → ")}</div></div>` : ""}
    `;
}

export function buildEvidenceGloss(a: Element): string {
  const type = a.getAttribute("data-type") ?? "evidence";
  const gloss = a.getAttribute("data-gloss") ?? "";
  return `<div class="gloss-head"><span class="id">evidence</span><span class="cred">${escapeHtml(type)}</span></div>
      ${gloss ? `<div class="term-def">${escapeHtml(gloss)}</div>` : ""}
      <div class="term-aliases">${escapeHtml(a.getAttribute("href") ?? "")}</div>`;
}

// ============================================================================
// Page composition
// ============================================================================

export function renderPageHtml(state: RenderState, meta: Metadata, proseHtml: string): string {
  const headerYear = meta.date ? new Date(meta.date).getFullYear() : "";
  return `
    <header class="doc-header">
      <div class="doc-eyebrow">An ArgML rendering · ${escapeHtml(String(headerYear))}</div>
      <h1 class="doc-title">${escapeHtml(meta.title)}</h1>
      <div class="doc-byline">
        <span>${escapeHtml(meta.author)}</span>
        <span class="sep">·</span>
        <span>${escapeHtml(formatDate(meta.date))}</span>
        ${(() => {
          const safe = safeHref(meta.source);
          if (!safe) return "";
          return `<span class="sep">·</span><a href="${escapeAttr(safe)}" target="_blank" rel="noopener">original</a>`;
        })()}
      </div>
    </header>
    ${
      meta.epistemicStatus
        ? `
      <aside class="epistemic-banner">
        <span class="label">Epistemic status</span>
        ${escapeHtml(meta.epistemicStatus)}
      </aside>`
        : ""
    }
    <nav class="toolbar" role="toolbar" aria-label="Reader controls">
      <span class="brand">ArgML</span>
      <div class="group">
        <button class="btn" data-toggle="frontmatter" aria-pressed="false"><span class="dot"></span>Frontmatter</button>
        <button class="btn" data-toggle="annotations" aria-pressed="false"><span class="dot"></span>Annotations</button>
        <button class="btn" data-toggle="graph" aria-pressed="false"><span class="dot"></span>Graph</button>
      </div>
    </nav>
    <section class="frontmatter">${renderFrontmatter(state)}</section>
    <div class="reader">
      <aside class="left-gutter graph-panel">
        <div class="graph-legend">
          <div class="row"><span class="swatch supports"></span>supports</div>
          <div class="row"><span class="swatch attacks"></span>attacks</div>
          <div class="row"><span class="swatch rests-on"></span>rests on</div>
        </div>
        <svg class="graph-svg" xmlns="http://www.w3.org/2000/svg"></svg>
      </aside>
      <article class="prose">${proseHtml}</article>
      <aside class="right-gutter"></aside>
      <svg class="arrows" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <marker id="ah-supports" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="#4a6a3e"/>
          </marker>
          <marker id="ah-attacks" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="#8a3434"/>
          </marker>
          <marker id="ah-rests" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="#6a614a"/>
          </marker>
        </defs>
      </svg>
    </div>
    ${
      state.notes.length
        ? `
      <section class="footnotes" id="footnotes">
        <h2>Notes</h2>
        <ol>${state.notes.map((n) => `<li id="fn-${n.idx}" data-editorial="${n.editorial}">${n.html}</li>`).join("")}</ol>
      </section>`
        : ""
    }
  `;
}

// ============================================================================
// DOM-tied: gloss-row construction and positioning
// ============================================================================

interface GlossMaps {
  glossByAnn: Map<Element, HTMLElement>;
  glossById: Map<string, HTMLElement>;
  groupByHost: Map<Element, HTMLElement>;
}

function hostBlockFor(el: Element): Element {
  return (
    el.closest(
      ".claim-wrap, p, li, h1, h2, h3, h4, figure, blockquote, .inference-block, .conflict-block, .evidence-block",
    ) ??
    el.parentElement ??
    el
  );
}

function buildGlossRows(
  doc: Document,
  state: RenderState,
  proseEl: Element,
  rightGutter: Element,
): GlossMaps {
  const glossByAnn = new Map<Element, HTMLElement>();
  const glossById = new Map<string, HTMLElement>();
  const groupByHost = new Map<Element, HTMLElement>();
  const seenTerms = new Set<string>();

  const ensureGroup = (host: Element): HTMLElement => {
    const existing = groupByHost.get(host);
    if (existing) return existing;
    const g = doc.createElement("div");
    g.className = "gloss-group";
    g.dataset.host = host.id || "";
    rightGutter.appendChild(g);
    groupByHost.set(host, g);
    return g;
  };

  const makeRow = (host: Element, kind: string, id: string | null, html: string): HTMLElement => {
    const grp = ensureGroup(host);
    const row = doc.createElement("div");
    row.className = "gloss-row";
    row.dataset.kind = kind;
    if (id) row.dataset.id = id;
    row.innerHTML = html;
    grp.appendChild(row);
    return row;
  };

  const allAnn = Array.from(proseEl.querySelectorAll(".ann"));
  for (const ann of allAnn) {
    const host = hostBlockFor(ann);
    let row: HTMLElement | null = null;

    if (ann.classList.contains("ann-claim")) {
      const id = (ann as HTMLElement).dataset.id ?? "";
      if (glossById.has(id)) {
        const existing = glossById.get(id);
        if (existing) glossByAnn.set(ann, existing);
        continue;
      }
      row = makeRow(host, "claim", id, buildClaimGloss(id, state));
      glossById.set(id, row);
    } else if (ann.classList.contains("ann-term")) {
      const ref = (ann as HTMLElement).dataset.ref ?? "";
      const key = `term:${ref}`;
      if (seenTerms.has(ref)) {
        const existing = glossById.get(key);
        if (existing) glossByAnn.set(ann, existing);
        continue;
      }
      seenTerms.add(ref);
      row = makeRow(host, "term", null, buildTermGloss(ref, state));
      row.dataset.ref = ref;
      glossById.set(key, row);
    } else if (ann.classList.contains("ann-evidence")) {
      row = makeRow(host, "evidence", null, buildEvidenceGloss(ann));
    } else if (ann.classList.contains("ann-note-marker")) {
      const idx = (ann as HTMLElement).dataset.idx ?? "";
      const n = state.notes.find((x) => String(x.idx) === idx);
      const html = `<div class="gloss-head"><span class="id">note ${escapeHtml(idx)}</span>${n?.editorial ? '<span class="cred">editorial</span>' : ""}</div><div class="term-def">${n?.html ?? ""}</div>`;
      row = makeRow(host, "note", null, html);
    }
    if (row) glossByAnn.set(ann, row);
  }

  for (const inf of Array.from(proseEl.querySelectorAll(".inference-block"))) {
    const id = (inf as HTMLElement).dataset.id ?? "";
    const host = hostBlockFor(inf);
    const row = makeRow(host, "inference", id, buildInferenceGloss(id, state));
    glossByAnn.set(inf, row);
    glossById.set(id, row);
  }

  return { glossByAnn, glossById, groupByHost };
}

// ============================================================================
// mount(): wires the renderer into a Document/Window pair
// ============================================================================

export function decodeArgmlPayload(encoded: string): string {
  // Inverse of html.ts:encodeArgmlPayload — base64 → UTF-8 string.
  const bin = atob(encoded.trim());
  // atob produces a binary string; decode UTF-8 bytes via TextDecoder if available.
  if (typeof TextDecoder !== "undefined") {
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  }
  return decodeURIComponent(escape(bin));
}

export function mount(doc: Document, win: Window): void {
  const sourceScript = doc.getElementById("argml-source");
  if (!sourceScript || !sourceScript.textContent) return;
  const xmlText = decodeArgmlPayload(sourceScript.textContent);
  const xmlDoc = new DOMParser().parseFromString(xmlText, "application/xml");

  const perr = xmlDoc.querySelector("parsererror");
  if (perr) {
    doc.body.innerHTML = `<pre style="padding:32px">${escapeHtml(perr.textContent ?? "")}</pre>`;
    return;
  }

  const meta = collectMetadata(xmlDoc);
  const state = createState(xmlDoc);
  const bodyEl = xmlDoc.querySelector("body");
  const proseHtml = bodyEl ? renderProse(bodyEl, state) : "";

  doc.title = meta.title || "ArgML";
  const rootMaybe = doc.getElementById("root");
  if (!rootMaybe) return;
  const root: HTMLElement = rootMaybe;
  root.innerHTML = renderPageHtml(state, meta, proseHtml);

  const proseElMaybe = root.querySelector(".prose");
  const rightGutterMaybe = root.querySelector(".right-gutter");
  if (!proseElMaybe || !rightGutterMaybe) return;
  const proseEl: Element = proseElMaybe;
  const rightGutter: Element = rightGutterMaybe;

  const { glossByAnn, glossById, groupByHost } = buildGlossRows(doc, state, proseEl, rightGutter);

  // ---- interaction ----
  const popup = doc.createElement("div");
  popup.className = "gloss-popup";
  doc.body.appendChild(popup);

  const isGutterVisible = (): boolean => {
    const rg = root.querySelector<HTMLElement>(".right-gutter");
    if (!rg) return false;
    const cs = win.getComputedStyle(rg);
    return cs.display !== "none" && cs.visibility !== "hidden";
  };
  const isGraphPanelNarrow = (): boolean => win.matchMedia("(max-width: 1100px)").matches;

  const showPopup = (ann: Element, html: string): void => {
    popup.innerHTML = html;
    popup.classList.add("is-visible");
    const r = ann.getBoundingClientRect();
    const w = 320;
    const margin = 12;
    const left = Math.min(win.innerWidth - w - margin, Math.max(margin, r.left));
    let top = r.bottom + 8;
    if (top + popup.offsetHeight > win.innerHeight - margin) {
      top = Math.max(margin, r.top - popup.offsetHeight - 8);
    }
    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
  };
  const hidePopup = (): void => {
    popup.classList.remove("is-visible");
  };

  const arrowsSvg = (): SVGElement | null => root.querySelector<SVGElement>(".arrows");
  const clearArrows = (): void => {
    const svg = arrowsSvg();
    if (!svg) return;
    for (const p of Array.from(svg.querySelectorAll("path.edge"))) p.remove();
  };

  const clearActiveStates = (): void => {
    for (const n of Array.from(root.querySelectorAll(".ann.is-active, .ann.is-related"))) {
      n.classList.remove("is-active", "is-related");
    }
    for (const n of Array.from(
      root.querySelectorAll(".gloss-row.is-active, .gloss-row.is-related"),
    )) {
      n.classList.remove("is-active", "is-related");
    }
    for (const n of Array.from(root.querySelectorAll(".gloss-row.is-expanded"))) {
      n.classList.remove("is-expanded");
    }
    clearArrows();
    unhighlightGraph();
  };

  const drawArrowsFor = (sourceEl: Element, rec: ClaimRec | InferenceRec): void => {
    clearArrows();
    const svg = arrowsSvg();
    const reader = root.querySelector<HTMLElement>(".reader");
    if (!svg || !reader) return;
    const readerRect = reader.getBoundingClientRect();
    const sourceGloss = glossByAnn.get(sourceEl);
    if (!sourceGloss || !isGutterVisible()) return;

    const makeArrow = (targetId: string | null | undefined, kind: string): void => {
      if (!targetId || targetId.includes(":")) return;
      const tg = glossById.get(targetId);
      if (!tg) return;
      const a = sourceGloss.getBoundingClientRect();
      const b = tg.getBoundingClientRect();
      const ax = a.right - readerRect.left;
      const ay = a.top + a.height / 2 - readerRect.top;
      const bx = b.right - readerRect.left;
      const by = b.top + b.height / 2 - readerRect.top;
      const channel = Math.min(readerRect.width - 6, Math.max(ax, bx) + 18);
      const p = doc.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", `M ${ax} ${ay} L ${channel} ${ay} L ${channel} ${by} L ${bx - 2} ${by}`);
      p.setAttribute("class", `edge ${kind} is-active`);
      const marker = kind === "rests-on" ? "rests" : kind === "attacks" ? "attacks" : "supports";
      p.setAttribute("marker-end", `url(#ah-${marker})`);
      p.style.opacity = "0.85";
      svg.appendChild(p);
    };

    if ("supports" in rec) {
      for (const s of rec.supports) makeArrow(s, "supports");
      for (const s of rec.attacks) makeArrow(s, "attacks");
      for (const s of rec.restsOn) makeArrow(s, "rests-on");
    }
    if ("from" in rec) {
      for (const f of rec.from) makeArrow(f, "supports");
      makeArrow(rec.to, "supports");
    }
  };

  const setActive = (ann: Element | null): void => {
    clearActiveStates();
    if (!ann) return;
    ann.classList.add("is-active");
    const g = glossByAnn.get(ann);

    const isCompact =
      ann.classList.contains("ann-term") ||
      ann.classList.contains("ann-evidence") ||
      ann.classList.contains("ann-note-marker");

    if (g && (isCompact || !isGutterVisible())) {
      showPopup(ann, g.innerHTML);
      if (isGutterVisible()) g.classList.add("is-active");
      return;
    }
    if (g) {
      g.classList.add("is-active", "is-expanded");
      if (win.getComputedStyle(g).display === "none") {
        g.classList.remove("is-expanded");
        showPopup(ann, g.innerHTML);
      }
    }
    const dataId = (ann as HTMLElement).dataset.id;
    if (ann.classList.contains("ann-claim") || dataId) {
      const id = dataId ?? "";
      highlightGraph(id);
      const rec = state.claims[id] ?? state.inferences[id];
      if (rec) {
        const related: (string | null)[] = [];
        if ("supports" in rec) {
          related.push(...rec.supports, ...rec.attacks, ...rec.restsOn, rec.via);
        }
        if ("from" in rec) {
          related.push(...rec.from, rec.to);
        }
        for (const rid of related.filter((r): r is string => Boolean(r))) {
          if (rid.includes(":")) continue;
          const rt = doc.getElementById(`claim-${rid}`) ?? doc.getElementById(`inf-${rid}`);
          rt?.classList.add("is-related");
          glossById.get(rid)?.classList.add("is-related", "is-expanded");
        }
        drawArrowsFor(ann, rec);
      }
    }
  };

  const attachHovers = (): void => {
    for (const ann of Array.from(proseEl.querySelectorAll(".ann"))) {
      ann.addEventListener("mouseenter", () => setActive(ann));
      ann.addEventListener("mouseleave", () => {
        hidePopup();
        clearActiveStates();
      });
    }
    for (const inf of Array.from(proseEl.querySelectorAll(".inference-block"))) {
      inf.addEventListener("mouseenter", () => setActive(inf));
      inf.addEventListener("mouseleave", () => {
        hidePopup();
        clearActiveStates();
      });
    }
    rightGutter.addEventListener("click", (e) => {
      const target = e.target as Element | null;
      const a = target?.closest("a[data-target]");
      if (!a) return;
      const t = (a as HTMLElement).dataset.target;
      if (!t || t.includes(":")) return;
      e.preventDefault();
      const tgt = doc.getElementById(`claim-${t}`) ?? doc.getElementById(`inf-${t}`);
      if (tgt) {
        tgt.scrollIntoView({ block: "center", behavior: "smooth" });
        tgt.classList.add("is-active");
        win.setTimeout(() => tgt.classList.remove("is-active"), 1400);
      }
    });
  };

  // ---- toolbar ----
  const setupToolbar = (): void => {
    root.dataset.modeAnnotations = "off";
    root.dataset.modeFrontmatter = "off";
    root.dataset.modeGraph = "off";

    for (const btn of Array.from(root.querySelectorAll<HTMLButtonElement>(".toolbar .btn"))) {
      btn.addEventListener("click", () => {
        const key = btn.dataset.toggle ?? "";
        const attrName = `mode${key.charAt(0).toUpperCase()}${key.slice(1)}`;
        const cur = root.dataset[attrName];
        const next = cur === "on" ? "off" : "on";
        root.dataset[attrName] = next;
        btn.setAttribute("aria-pressed", String(next === "on"));
        repositionGutter();
        if (key === "graph") layoutGraph();
      });
    }
  };

  // ---- positioning ----
  function repositionGutter(): void {
    const reader = root.querySelector<HTMLElement>(".reader");
    if (!reader) return;
    const readerRect = reader.getBoundingClientRect();
    const placed: { host: Element; grp: HTMLElement; top: number; hostH: number }[] = [];
    for (const [host, grp] of groupByHost.entries()) {
      const r = host.getBoundingClientRect();
      const y = r.top - readerRect.top + reader.scrollTop;
      grp.style.top = `${y}px`;
      grp.style.setProperty("--host-h", `${r.height}px`);

      const rowEls = Array.from(grp.children).filter((c) =>
        c.classList.contains("gloss-row"),
      ) as HTMLElement[];
      for (const row of rowEls) row.style.display = "";
      const cap = r.height;
      const expanded = grp.classList.contains("is-expanded-all");
      let wouldHide = 0;
      let acc = 0;
      for (const row of rowEls) {
        acc += row.offsetHeight + 1;
        if (acc > cap) wouldHide++;
      }
      if (!expanded) {
        acc = 0;
        for (const row of rowEls) {
          acc += row.offsetHeight + 1;
          if (acc > cap) row.style.display = "none";
        }
      }
      grp.classList.toggle("is-overflow", wouldHide > 0);
      if (wouldHide > 0) grp.setAttribute("data-overflow", String(wouldHide));
      else grp.removeAttribute("data-overflow");

      let moreBtn = grp.querySelector<HTMLButtonElement>(".gloss-more");
      if (wouldHide > 0) {
        if (!moreBtn) {
          moreBtn = doc.createElement("button");
          moreBtn.type = "button";
          moreBtn.className = "gloss-more";
          moreBtn.addEventListener("click", (ev) => {
            ev.stopPropagation();
            const wasOpen = grp.classList.contains("is-expanded-all");
            grp.classList.toggle("is-expanded-all", !wasOpen);
            win.requestAnimationFrame(repositionGutter);
          });
          grp.appendChild(moreBtn);
        }
        moreBtn.textContent = expanded ? "show less" : `+${wouldHide} more`;
      } else if (moreBtn) {
        moreBtn.remove();
        grp.classList.remove("is-expanded-all");
      }

      placed.push({ host, grp, top: y, hostH: r.height });
    }

    placed.sort((a, b) => a.top - b.top);
    const gap = 8;
    let floor = Number.NEGATIVE_INFINITY;
    for (const item of placed) {
      const newTop = Math.max(item.top, floor);
      item.grp.style.top = `${newTop}px`;
      const expanded = item.grp.classList.contains("is-expanded-all");
      const contentH = item.grp.scrollHeight;
      const cap = item.hostH || contentH;
      const visibleH = expanded ? contentH : Math.min(cap, contentH);
      floor = newTop + visibleH + gap;
    }

    const aSvg = arrowsSvg();
    if (aSvg) {
      aSvg.setAttribute("width", String(readerRect.width));
      aSvg.setAttribute("height", String(reader.offsetHeight));
      aSvg.setAttribute("viewBox", `0 0 ${readerRect.width} ${reader.offsetHeight}`);
    }
  }

  // ---- graph view (left gutter) ----
  function layoutGraph(): void {
    const panel = root.querySelector<HTMLElement>(".graph-panel");
    const svg = root.querySelector<SVGElement>(".graph-svg");
    const reader = root.querySelector<HTMLElement>(".reader");
    if (!panel || !svg || !reader) return;
    if (root.dataset.modeGraph !== "on") {
      svg.innerHTML = "";
      panel.classList.remove("narrow");
      return;
    }
    const narrow = isGraphPanelNarrow();
    panel.classList.toggle("narrow", narrow);
    const readerRect = reader.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();

    svg.innerHTML = "";

    const defs = doc.createElementNS("http://www.w3.org/2000/svg", "defs");
    defs.innerHTML = `
      <marker id="g-ah-supports" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#4a6a3e"/></marker>
      <marker id="g-ah-attacks"  viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#8a3434"/></marker>
      <marker id="g-ah-rests"    viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#6a614a"/></marker>
    `;
    svg.appendChild(defs);

    const positions = new Map<string, number>();
    if (narrow) {
      let y = 24;
      const allIds = [
        ...new Set([
          ...Array.from(proseEl.querySelectorAll<HTMLElement>(".ann-claim")).map(
            (a) => a.dataset.id ?? "",
          ),
          ...Array.from(proseEl.querySelectorAll<HTMLElement>(".inference-block")).map(
            (a) => a.dataset.id ?? "",
          ),
        ]),
      ].filter(Boolean);
      for (const id of allIds) {
        positions.set(id, y);
        y += 34;
      }
      svg.setAttribute("width", String(panelRect.width - 32));
      svg.setAttribute("height", String(y + 16));
      svg.setAttribute("viewBox", `0 0 ${panelRect.width - 32} ${y + 16}`);
    } else {
      svg.setAttribute("width", String(panelRect.width));
      svg.setAttribute("height", String(reader.offsetHeight));
      svg.setAttribute("viewBox", `0 0 ${panelRect.width} ${reader.offsetHeight}`);
      for (const ann of Array.from(proseEl.querySelectorAll<HTMLElement>(".ann-claim"))) {
        const id = ann.dataset.id ?? "";
        if (positions.has(id) || !id) continue;
        const r = ann.getBoundingClientRect();
        positions.set(id, r.top - readerRect.top + reader.scrollTop + r.height / 2);
      }
      for (const inf of Array.from(proseEl.querySelectorAll<HTMLElement>(".inference-block"))) {
        const id = inf.dataset.id ?? "";
        if (!id) continue;
        const r = inf.getBoundingClientRect();
        positions.set(id, r.top - readerRect.top + reader.scrollTop + r.height / 2);
      }
    }

    const colX = narrow ? 60 : panelRect.width - 60;
    const nodeRadius = 22;

    const sorted = Array.from(positions.entries()).sort((a, b) => a[1] - b[1]);
    const minGap = narrow ? 32 : 28;
    let cursor = 0;
    const finalPos = new Map<string, number>();
    for (const [id, y] of sorted) {
      const yy = Math.max(y, cursor);
      finalPos.set(id, yy);
      cursor = yy + minGap;
    }

    const pathBetween = (aId: string, bId: string, kind: string): SVGPathElement | null => {
      const ay = finalPos.get(aId);
      const by = finalPos.get(bId);
      if (ay === undefined || by === undefined) return null;
      const minX = colX - nodeRadius - 2;
      const dy = Math.abs(by - ay);
      const arc = Math.min(36, Math.max(14, dy * 0.1));
      const ctrl = Math.max(6, minX - arc);
      const p = doc.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", `M ${minX} ${ay} C ${ctrl} ${ay}, ${ctrl} ${by}, ${minX} ${by}`);
      p.setAttribute("class", `edge ${kind}`);
      p.setAttribute("data-from", aId);
      p.setAttribute("data-to", bId);
      const marker = kind === "rests-on" ? "rests" : kind === "attacks" ? "attacks" : "supports";
      p.setAttribute("marker-end", `url(#g-ah-${marker})`);
      return p;
    };

    for (const [id, c] of Object.entries(state.claims)) {
      for (const s of c.supports) {
        const p = pathBetween(id, s, "supports");
        if (p) svg.appendChild(p);
      }
      for (const s of c.attacks) {
        const p = pathBetween(id, s, "attacks");
        if (p) svg.appendChild(p);
      }
      for (const s of c.restsOn) {
        const p = pathBetween(id, s, "rests-on");
        if (p) svg.appendChild(p);
      }
    }
    for (const inf of Object.values(state.inferences)) {
      for (const f of inf.from) {
        const p = pathBetween(inf.id, f, "supports");
        if (p) svg.appendChild(p);
      }
      if (inf.to) {
        const p = pathBetween(inf.id, inf.to, "supports");
        if (p) svg.appendChild(p);
      }
    }

    for (const [id, y] of finalPos.entries()) {
      const g = doc.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("class", "node");
      g.setAttribute("data-id", id);
      const isInf = Boolean(state.inferences[id]);
      const w = Math.max(36, id.length * 6.5 + 14);
      const rect = doc.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("class", "node-bg");
      rect.setAttribute("x", String(colX - w / 2));
      rect.setAttribute("y", String(y - 11));
      rect.setAttribute("width", String(w));
      rect.setAttribute("height", "22");
      rect.setAttribute("rx", "11");
      if (isInf) rect.setAttribute("stroke-dasharray", "3 2");
      g.appendChild(rect);
      const txt = doc.createElementNS("http://www.w3.org/2000/svg", "text");
      txt.setAttribute("class", "node-label");
      txt.setAttribute("x", String(colX));
      txt.setAttribute("y", String(y));
      txt.textContent = id;
      g.appendChild(txt);
      g.addEventListener("mouseenter", () => highlightGraph(id));
      g.addEventListener("mouseleave", () => unhighlightGraph());
      g.addEventListener("click", () => {
        const tgt = doc.getElementById(`claim-${id}`) ?? doc.getElementById(`inf-${id}`);
        if (tgt) tgt.scrollIntoView({ block: "center", behavior: "smooth" });
      });
      svg.appendChild(g);
    }
  }

  function highlightGraph(id: string): void {
    const svg = root.querySelector<SVGElement>(".graph-svg");
    if (!svg || root.dataset.modeGraph !== "on") return;
    for (const n of Array.from(svg.querySelectorAll("g.node"))) n.classList.add("is-dim");
    for (const e of Array.from(svg.querySelectorAll("path.edge"))) e.classList.add("is-dim");
    const cssEscape =
      typeof CSS !== "undefined" && CSS.escape ? CSS.escape : (s: string) => s.replace(/"/g, '\\"');
    const here = svg.querySelector(`g.node[data-id="${cssEscape(id)}"]`);
    if (here) {
      here.classList.remove("is-dim");
      here.classList.add("is-active");
    }
    const rec = state.claims[id] ?? state.inferences[id];
    if (!rec) return;
    const relList: (string | null)[] = [];
    if ("supports" in rec) relList.push(...rec.supports, ...rec.attacks, ...rec.restsOn, rec.via);
    if ("from" in rec) relList.push(...rec.from, rec.to);
    const rel = new Set(relList.filter((r): r is string => Boolean(r)));
    for (const rid of rel) {
      const rn = svg.querySelector(`g.node[data-id="${cssEscape(rid)}"]`);
      if (rn) {
        rn.classList.remove("is-dim");
        rn.classList.add("is-related");
      }
      const e1 = svg.querySelector(
        `path.edge[data-from="${cssEscape(id)}"][data-to="${cssEscape(rid)}"]`,
      );
      const e2 = svg.querySelector(
        `path.edge[data-from="${cssEscape(rid)}"][data-to="${cssEscape(id)}"]`,
      );
      e1?.classList.remove("is-dim");
      e1?.classList.add("is-active");
      e2?.classList.remove("is-dim");
      e2?.classList.add("is-active");
    }
  }

  function unhighlightGraph(): void {
    const svg = root.querySelector<SVGElement>(".graph-svg");
    if (!svg) return;
    for (const n of Array.from(svg.querySelectorAll("g.node"))) {
      n.classList.remove("is-dim", "is-active");
    }
    for (const e of Array.from(svg.querySelectorAll("path.edge"))) {
      e.classList.remove("is-dim");
    }
  }

  // ---- init ----
  attachHovers();
  setupToolbar();
  win.requestAnimationFrame(() => {
    repositionGutter();
    layoutGraph();
  });
  win.addEventListener("resize", () => {
    repositionGutter();
    layoutGraph();
  });
  const fonts = doc.fonts;
  if (fonts && typeof fonts.ready === "object") {
    void fonts.ready.then(() => {
      repositionGutter();
      layoutGraph();
    });
  }
}
