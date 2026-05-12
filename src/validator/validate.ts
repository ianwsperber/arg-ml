import type { ArgMLDocument } from "../ast/document.js";
import {
  ARGUMENT_MODES,
  type BlockOrInline,
  CLAIM_MODES,
  type HeadingNode,
  INFERENCE_PATTERNS,
  type InlineNode,
} from "../ast/nodes.js";
import type { SourcePosition } from "../ast/position.js";
import { ARGML_CODES, type DiagnosticCode } from "./codes.js";
import type { Diagnostic } from "./diagnostics.js";

type SymbolKind =
  | "claim"
  | "inference"
  | "conflict"
  | "term-decl"
  | "assumption"
  | "section"
  | "argument"
  | "generator";

interface SymbolEntry {
  kind: SymbolKind;
  pos?: SourcePosition | undefined;
  /** For inferences: whether this inference is defeasible (default true). */
  defeasible?: boolean;
}

const KNOWN_CLAIM_MODES = new Set<string>(CLAIM_MODES);
const KNOWN_ARGUMENT_MODES = new Set<string>(ARGUMENT_MODES);
const KNOWN_PATTERNS = new Set<string>(INFERENCE_PATTERNS);

export function validate(doc: ArgMLDocument): Diagnostic[] {
  const diags: Diagnostic[] = [];
  const symbols = new Map<string, SymbolEntry>();
  const importPrefixes = new Set<string>();

  for (const imp of doc.head.imports?.imports ?? []) {
    if (imp.prefix !== "") importPrefixes.add(imp.prefix);
  }

  const emit = (code: DiagnosticCode, message: string, pos: SourcePosition | undefined): void => {
    diags.push({ code, severity: ARGML_CODES[code].severity, message, pos });
  };

  const addSymbol = (
    id: string,
    kind: SymbolKind,
    pos: SourcePosition | undefined,
    extra?: Partial<SymbolEntry>,
  ): void => {
    if (id === "") return;
    if (symbols.has(id)) {
      emit("ARGML001", `Duplicate id ${JSON.stringify(id)}.`, pos);
      return;
    }
    const entry: SymbolEntry = { kind, pos };
    if (extra?.defeasible !== undefined) entry.defeasible = extra.defeasible;
    symbols.set(id, entry);
  };

  // ----- Pass 1: build symbol table by walking the AST.

  for (const g of doc.head.provenance?.generators ?? []) {
    addSymbol(g.id, "generator", g.pos);
  }
  for (const t of doc.head.terms?.terms ?? []) {
    addSymbol(t.id, "term-decl", t.pos);
  }
  for (const a of doc.head.assumptions?.assumptions ?? []) {
    addSymbol(a.id, "assumption", a.pos);
  }

  type CollectableNode = BlockOrInline | HeadingNode;
  const allNodes: CollectableNode[] = [];

  const collect = (n: CollectableNode): void => {
    allNodes.push(n);
    switch (n.kind) {
      case "section":
        if (n.heading) collect(n.heading);
        for (const c of n.children) collect(c);
        break;
      case "p":
        for (const c of n.children) collect(c);
        break;
      case "argument":
        if (n.id !== undefined) addSymbol(n.id, "argument", n.pos);
        for (const c of n.children) collect(c);
        break;
      case "heading":
        for (const c of n.children) collect(c);
        break;
      case "claim":
        addSymbol(n.id, "claim", n.pos);
        for (const c of n.children) collect(c);
        break;
      case "inference":
        addSymbol(n.id, "inference", n.pos, { defeasible: n.defeasible !== false });
        for (const c of n.warrant) collect(c);
        break;
      case "conflict":
        addSymbol(n.id, "conflict", n.pos);
        if (n.response) {
          for (const c of n.response.children) collect(c);
        }
        break;
      case "term-ref":
        for (const c of n.children) collect(c);
        break;
      case "text":
      case "evidence":
      case "note":
        break;
    }
  };

  for (const c of doc.body.children) collect(c);

  // Register section ids after body walk so they can collide with claim/etc.
  registerSectionIds(doc.body.children, addSymbol);

  // ----- Reference resolution helper.

  const checkRef = (
    ref: string,
    expected: SymbolKind[],
    mismatchCode: DiagnosticCode,
    pos: SourcePosition | undefined,
    unresolvedCode: DiagnosticCode = "ARGML002",
  ): void => {
    if (ref === "") return;
    const colon = ref.indexOf(":");
    if (colon >= 0) {
      const prefix = ref.slice(0, colon);
      if (!importPrefixes.has(prefix)) {
        emit(
          "ARGML003",
          `Reference ${JSON.stringify(ref)} uses an undeclared import prefix ${JSON.stringify(prefix)}.`,
          pos,
        );
      }
      return;
    }
    const sym = symbols.get(ref);
    if (!sym) {
      emit(unresolvedCode, `Reference ${JSON.stringify(ref)} does not resolve.`, pos);
      return;
    }
    if (!expected.includes(sym.kind)) {
      emit(
        mismatchCode,
        `Reference ${JSON.stringify(ref)} resolves to <${sym.kind}>; expected ${expected
          .map((k) => `<${k}>`)
          .join(" or ")}.`,
        pos,
      );
    }
  };

  const checkEvidenceRef = (ref: string, pos: SourcePosition | undefined): void => {
    if (ref === "") return;
    // URL form (e.g. "https://example.org/x") — not subject to local resolution.
    if (ref.includes("://")) return;
    const colon = ref.indexOf(":");
    if (colon >= 0) {
      const prefix = ref.slice(0, colon);
      if (!importPrefixes.has(prefix)) {
        emit(
          "ARGML003",
          `Evidence reference ${JSON.stringify(ref)} uses an undeclared import prefix ${JSON.stringify(prefix)}.`,
          pos,
        );
      }
      return;
    }
    if (!symbols.has(ref)) {
      emit("ARGML002", `Evidence reference ${JSON.stringify(ref)} does not resolve.`, pos);
    }
  };

  /** Verify every id in `provenance` resolves to a `<generator>` declaration. */
  const checkProvenance = (
    provenance: readonly string[],
    pos: SourcePosition | undefined,
  ): void => {
    for (const id of provenance) {
      const sym = symbols.get(id);
      if (!sym) {
        emit(
          "ARGML025",
          `provenance id ${JSON.stringify(id)} is not declared in <provenance>.`,
          pos,
        );
      } else if (sym.kind !== "generator") {
        emit(
          "ARGML025",
          `provenance id ${JSON.stringify(id)} resolves to <${sym.kind}>; expected <generator>.`,
          pos,
        );
      }
    }
  };

  /** Resolve `same-as` against the local symbol table; tolerate prefix:id. */
  const checkSameAs = (ref: string, pos: SourcePosition | undefined): void => {
    if (ref === "") return;
    const colon = ref.indexOf(":");
    if (colon >= 0) {
      const prefix = ref.slice(0, colon);
      if (!importPrefixes.has(prefix)) {
        emit(
          "ARGML026",
          `same-as ${JSON.stringify(ref)} uses an undeclared import prefix ${JSON.stringify(prefix)}.`,
          pos,
        );
      }
      return;
    }
    const sym = symbols.get(ref);
    if (!sym) {
      emit("ARGML026", `same-as ${JSON.stringify(ref)} does not resolve.`, pos);
    } else if (sym.kind !== "claim") {
      emit(
        "ARGML026",
        `same-as ${JSON.stringify(ref)} resolves to <${sym.kind}>; expected <claim>.`,
        pos,
      );
    }
  };

  // ----- Pass 2: per-node semantic checks.

  for (const t of doc.head.terms?.terms ?? []) {
    for (const al of t.aliases) {
      if (al.text.trim() === "") {
        emit("ARGML007", `Empty <alias> on term ${JSON.stringify(t.id)}.`, al.pos);
      }
    }
    checkProvenance(t.provenance, t.pos);
  }

  for (const a of doc.head.assumptions?.assumptions ?? []) {
    for (const r of a.restsOn) {
      checkRef(r, ["assumption", "claim"], "ARGML008", a.pos);
    }
    checkProvenance(a.provenance, a.pos);
  }

  // Takeaways: ref must resolve to a local claim; track duplicates by (claim, priority).
  const takeawaySeen = new Set<string>();
  for (const t of doc.head.takeaways?.takeaways ?? []) {
    if (t.ref !== "") {
      if (t.ref.includes(":")) {
        emit(
          "ARGML023",
          `<takeaway ref=${JSON.stringify(t.ref)}> uses a cross-document reference; takeaways must point at a local <claim>.`,
          t.pos,
        );
      } else {
        const sym = symbols.get(t.ref);
        if (!sym) {
          emit(
            "ARGML023",
            `<takeaway ref=${JSON.stringify(t.ref)}> does not resolve to any declared id.`,
            t.pos,
          );
        } else if (sym.kind !== "claim") {
          emit(
            "ARGML023",
            `<takeaway ref=${JSON.stringify(t.ref)}> resolves to <${sym.kind}>; expected <claim>.`,
            t.pos,
          );
        }
      }
    }
    const key = `${t.ref} ${t.priority ?? ""}`;
    if (t.ref !== "" && takeawaySeen.has(key)) {
      emit(
        "ARGML024",
        `Duplicate <takeaway> for ${JSON.stringify(t.ref)} with priority ${JSON.stringify(t.priority ?? "")}.`,
        t.pos,
      );
    } else if (t.ref !== "") {
      takeawaySeen.add(key);
    }
    checkProvenance(t.provenance, t.pos);
  }

  // For ARGML019: the spec says reductio-target SHOULD be paired with
  // defeasible="false" on the licensing inference (the inference whose `to`
  // points at the reductio-target). Build that index up-front.
  const inferenceByTo = new Map<string, { id: string; defeasible: boolean }>();
  for (const node of allNodes) {
    if (node.kind === "inference" && node.to !== "" && !node.to.includes(":")) {
      inferenceByTo.set(node.to, { id: node.id, defeasible: node.defeasible !== false });
    }
  }

  // For ARGML027: detect same-as cycles within the document. Build the directed
  // graph of `claimId -> sameAs target` (local refs only) and look for cycles.
  const sameAsEdges = new Map<string, string>();
  for (const node of allNodes) {
    if (node.kind === "claim" && node.sameAs !== undefined) {
      if (!node.sameAs.includes(":")) {
        sameAsEdges.set(node.id, node.sameAs);
      }
    }
  }

  for (const node of allNodes) {
    switch (node.kind) {
      case "claim": {
        for (const s of node.supports) checkRef(s, ["claim"], "ARGML016", node.pos);
        for (const a of node.attacks) checkRef(a, ["claim"], "ARGML016", node.pos);
        for (const r of node.restsOn) checkRef(r, ["assumption", "claim"], "ARGML008", node.pos);
        if (node.via !== undefined) checkRef(node.via, ["inference"], "ARGML015", node.pos);
        if (node.credence?.kind === "numeric") {
          const v = node.credence.value;
          if (!(v >= 0 && v <= 1)) {
            emit("ARGML005", `credence=${node.credence.raw} is outside [0, 1].`, node.pos);
          }
          if (hasSpuriousPrecision(node.credence.raw)) {
            emit(
              "ARGML013",
              `Numeric credence=${node.credence.raw} has more than two decimal places.`,
              node.pos,
            );
          }
        }
        if (node.mode !== undefined && !KNOWN_CLAIM_MODES.has(node.mode)) {
          emit(
            "ARGML017",
            `Unknown claim mode ${JSON.stringify(node.mode)} on <claim id=${JSON.stringify(node.id)}>.`,
            node.pos,
          );
        }
        if (node.mode === "restated" && node.sameAs === undefined) {
          emit(
            "ARGML018",
            `<claim id=${JSON.stringify(node.id)} mode="restated"> requires a \`same-as\` attribute.`,
            node.pos,
          );
        }
        if (node.mode === "attributed" && node.attributedTo === undefined) {
          emit(
            "ARGML020",
            `<claim id=${JSON.stringify(node.id)} mode="attributed"> SHOULD carry \`attributed-to\`.`,
            node.pos,
          );
        }
        if (node.mode === "reductio-target") {
          const inf = inferenceByTo.get(node.id);
          if (inf?.defeasible) {
            emit(
              "ARGML019",
              `<claim id=${JSON.stringify(node.id)} mode="reductio-target"> is licensed by <inference id=${JSON.stringify(inf.id)}> whose defeasible !== "false".`,
              node.pos,
            );
          }
        }
        if (node.sameAs !== undefined) checkSameAs(node.sameAs, node.pos);
        checkProvenance(node.provenance, node.pos);
        break;
      }
      case "inference": {
        if (node.from.length === 0) {
          emit("ARGML004", `<inference id=${JSON.stringify(node.id)}> has no premises.`, node.pos);
        }
        for (const f of node.from) {
          // 0.2: `from` may now reference an `<argument>` when the pattern is
          // `argument-by-cases`. We accept arguments here and emit a warning
          // (ARGML029) if the pattern doesn't justify it; we keep the broader
          // ARGML008 check for the kind of target.
          checkRef(f, ["claim", "assumption", "argument"], "ARGML008", node.pos);
          if (!f.includes(":")) {
            const sym = symbols.get(f);
            if (sym?.kind === "argument" && node.pattern !== "argument-by-cases") {
              emit(
                "ARGML029",
                `<inference id=${JSON.stringify(node.id)} from=${JSON.stringify(f)}> references an <argument>; allowed only for pattern="argument-by-cases".`,
                node.pos,
              );
            }
          }
        }
        checkRef(node.to, ["claim"], "ARGML009", node.pos);
        if (node.strength?.kind === "numeric") {
          const v = node.strength.value;
          if (!(v >= 0 && v <= 1)) {
            emit("ARGML006", `strength=${node.strength.raw} is outside [0, 1].`, node.pos);
          }
          if (hasSpuriousPrecision(node.strength.raw)) {
            emit(
              "ARGML013",
              `Numeric strength=${node.strength.raw} has more than two decimal places.`,
              node.pos,
            );
          }
        }
        if (
          node.strength?.kind === "bucket" &&
          node.strength.value === "deductive" &&
          node.defeasible !== false
        ) {
          emit(
            "ARGML011",
            '`strength="deductive"` is inconsistent with `defeasible="true"` (default).',
            node.pos,
          );
        }
        if (node.pattern !== undefined && !KNOWN_PATTERNS.has(node.pattern)) {
          emit(
            "ARGML022",
            `Unknown inference pattern ${JSON.stringify(node.pattern)} on <inference id=${JSON.stringify(node.id)}>.`,
            node.pos,
          );
        }
        checkProvenance(node.provenance, node.pos);
        break;
      }
      case "conflict": {
        const attackerPos = node.attacker.pos ?? node.pos;
        const targetPos = node.target.pos ?? node.pos;
        if (node.attacker.idref !== "") {
          checkRef(node.attacker.idref, ["claim", "inference"], "ARGML010", attackerPos);
        }
        if (node.target.idref !== "") {
          checkRef(node.target.idref, ["claim", "inference"], "ARGML010", targetPos);
          if (node.attackType === "undercut" && node.target.idref.indexOf(":") < 0) {
            const sym = symbols.get(node.target.idref);
            if (sym && sym.kind === "inference" && sym.defeasible === false) {
              emit(
                "ARGML012",
                `Undercut conflict targets <inference id=${JSON.stringify(node.target.idref)}> whose defeasible="false".`,
                node.pos,
              );
            }
          }
        }
        checkProvenance(node.provenance, node.pos);
        break;
      }
      case "argument": {
        if (node.mode !== "" && !KNOWN_ARGUMENT_MODES.has(node.mode)) {
          emit(
            "ARGML030",
            `Unknown argument mode ${JSON.stringify(node.mode)} on <argument${node.id !== undefined ? ` id=${JSON.stringify(node.id)}` : ""}>.`,
            node.pos,
          );
        }
        for (const s of node.supports) checkRef(s, ["claim"], "ARGML028", node.pos);
        for (const r of node.restsOn) checkRef(r, ["assumption", "claim"], "ARGML008", node.pos);
        if (node.via !== undefined) checkRef(node.via, ["inference"], "ARGML015", node.pos);
        checkProvenance(node.provenance, node.pos);
        break;
      }
      case "term-ref":
        checkRef(node.ref, ["term-decl"], "ARGML014", node.pos, "ARGML014");
        break;
      case "evidence":
        checkEvidenceRef(node.ref, node.pos);
        break;
      // sections, p, headings, text, note: nothing further
    }
  }

  // Same-as cycle detection (ARGML027). DFS from each starting node; flag any
  // back-edge that closes a cycle.
  if (sameAsEdges.size > 0) {
    const reportedCycle = new Set<string>();
    for (const [start] of sameAsEdges) {
      const path: string[] = [];
      const onPath = new Set<string>();
      let cursor: string | undefined = start;
      while (cursor !== undefined) {
        if (onPath.has(cursor)) {
          // Cycle found; emit once per starting node of the cycle.
          const cycleKey = [...path.slice(path.indexOf(cursor)), cursor].sort().join(",");
          if (!reportedCycle.has(cycleKey)) {
            reportedCycle.add(cycleKey);
            const sym = symbols.get(start);
            emit(
              "ARGML027",
              `same-as cycle detected starting at <claim id=${JSON.stringify(start)}>: ${[...path, cursor].join(" -> ")}.`,
              sym?.pos,
            );
          }
          break;
        }
        path.push(cursor);
        onPath.add(cursor);
        const next: string | undefined = sameAsEdges.get(cursor);
        cursor = next;
      }
    }
  }

  diags.sort((a, b) => {
    const al = a.pos?.line ?? Number.POSITIVE_INFINITY;
    const bl = b.pos?.line ?? Number.POSITIVE_INFINITY;
    if (al !== bl) return al - bl;
    const ac = a.pos?.column ?? 0;
    const bc = b.pos?.column ?? 0;
    if (ac !== bc) return ac - bc;
    return a.code.localeCompare(b.code);
  });
  return diags;
}

function registerSectionIds(
  nodes: ReadonlyArray<BlockOrInline | InlineNode>,
  add: (id: string, kind: SymbolKind, pos: SourcePosition | undefined) => void,
): void {
  for (const n of nodes) {
    if (n.kind === "section") {
      if (n.id !== undefined) add(n.id, "section", n.pos);
      registerSectionIds(n.children, add);
    } else if (n.kind === "p" || n.kind === "claim" || n.kind === "term-ref") {
      registerSectionIds(n.children, add);
    } else if (n.kind === "argument") {
      registerSectionIds(n.children, add);
    } else if (n.kind === "inference") {
      registerSectionIds(n.warrant, add);
    } else if (n.kind === "conflict" && n.response) {
      registerSectionIds(n.response.children, add);
    }
  }
}

function hasSpuriousPrecision(raw: string): boolean {
  const dot = raw.indexOf(".");
  if (dot < 0) return false;
  // Count significant fractional digits — trailing zeros aren't real precision.
  const frac = raw
    .slice(dot + 1)
    .replace(/[^0-9]/g, "")
    .replace(/0+$/, "");
  return frac.length > 2;
}
