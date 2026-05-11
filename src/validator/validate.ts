import type { ArgMLDocument } from "../ast/document.js";
import type { BlockOrInline, HeadingNode, InlineNode } from "../ast/nodes.js";
import type { SourcePosition } from "../ast/position.js";
import { ARGML_CODES, type DiagnosticCode } from "./codes.js";
import type { Diagnostic } from "./diagnostics.js";

type SymbolKind = "claim" | "inference" | "conflict" | "term-decl" | "assumption" | "section";

interface SymbolEntry {
  kind: SymbolKind;
  pos?: SourcePosition | undefined;
  /** For inferences: whether this inference is defeasible (default true). */
  defeasible?: boolean;
}

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

  // ----- Pass 2: per-node semantic checks.

  for (const t of doc.head.terms?.terms ?? []) {
    for (const al of t.aliases) {
      if (al.text.trim() === "") {
        emit("ARGML007", `Empty <alias> on term ${JSON.stringify(t.id)}.`, al.pos);
      }
    }
  }

  for (const a of doc.head.assumptions?.assumptions ?? []) {
    for (const r of a.restsOn) {
      checkRef(r, ["assumption", "claim"], "ARGML008", a.pos);
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
        break;
      }
      case "inference": {
        if (node.from.length === 0) {
          emit("ARGML004", `<inference id=${JSON.stringify(node.id)}> has no premises.`, node.pos);
        }
        for (const f of node.from) checkRef(f, ["claim", "assumption"], "ARGML008", node.pos);
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
        break;
      }
      case "term-ref":
        checkRef(node.ref, ["term-decl"], "ARGML014", node.pos, "ARGML014");
        break;
      // sections, p, headings, text, evidence, note: nothing further
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
  const frac = raw.slice(dot + 1);
  return frac.replace(/[^0-9]/g, "").length > 2;
}
