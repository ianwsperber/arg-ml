import type { ReaderOverlayDocument } from "../ast/overlay.js";
import type { SourcePosition } from "../ast/position.js";
import { ARGML_CODES, type DiagnosticCode } from "./codes.js";
import type { Diagnostic } from "./diagnostics.js";

export function validateOverlay(overlay: ReaderOverlayDocument): Diagnostic[] {
  const diags: Diagnostic[] = [];

  const emit = (code: DiagnosticCode, message: string, pos: SourcePosition | undefined): void => {
    diags.push({ code, severity: ARGML_CODES[code].severity, message, pos });
  };

  const importPrefixes = new Set<string>();
  for (const imp of overlay.imports.imports) {
    if (imp.prefix !== "") importPrefixes.add(imp.prefix);
  }

  const checkPrefix = (
    ref: string,
    code: DiagnosticCode,
    pos: SourcePosition | undefined,
    role: string,
  ): void => {
    if (ref === "") return;
    const colon = ref.indexOf(":");
    if (colon < 0) {
      emit(
        "OVERLAY005",
        `${role} ${JSON.stringify(ref)} has no \`prefix:\` segment; overlay references must be cross-document.`,
        pos,
      );
      return;
    }
    const prefix = ref.slice(0, colon);
    if (!importPrefixes.has(prefix)) {
      emit(
        code,
        `${role} ${JSON.stringify(ref)} uses an undeclared import prefix ${JSON.stringify(prefix)}.`,
        pos,
      );
    }
  };

  const attitudeSeen = new Set<string>();
  for (const a of overlay.attitudes) {
    if (a.target !== "") {
      if (attitudeSeen.has(a.target)) {
        emit(
          "OVERLAY001",
          `Duplicate <attitude target=${JSON.stringify(a.target)}>; one attitude per target.`,
          a.pos,
        );
      } else {
        attitudeSeen.add(a.target);
      }
    }
    checkPrefix(a.target, "OVERLAY004", a.pos, "attitude target");

    if (a.attitudeKind === "reject" && a.rejectionType === undefined) {
      emit(
        "OVERLAY002",
        `<attitude target=${JSON.stringify(a.target)} kind="reject"> requires \`rejection-type\`.`,
        a.pos,
      );
    }
    if (a.attitudeKind !== "reject" && a.rejectionType !== undefined) {
      emit(
        "OVERLAY003",
        `<attitude target=${JSON.stringify(a.target)} kind="${a.attitudeKind}"> SHOULD NOT carry \`rejection-type\`.`,
        a.pos,
      );
    }

    if (a.credence?.kind === "numeric") {
      const v = a.credence.value;
      if (!(v >= 0 && v <= 1)) {
        emit("OVERLAY008", `credence=${a.credence.raw} is outside [0, 1].`, a.pos);
      } else if (hasSpuriousPrecision(a.credence.raw)) {
        emit(
          "OVERLAY008",
          `Numeric credence=${a.credence.raw} has more than two decimal places.`,
          a.pos,
        );
      }
    }
  }

  const substitutionTargets = new Map<string, number>();
  for (const s of overlay.substitutions) {
    checkPrefix(s.target, "OVERLAY006", s.pos, "substitution target");
    checkPrefix(s.use, "OVERLAY006", s.pos, "substitution use");
    if (s.target !== "") {
      substitutionTargets.set(s.target, (substitutionTargets.get(s.target) ?? 0) + 1);
    }
  }
  for (const [target, n] of substitutionTargets) {
    if (n > 1) {
      // Re-emit at each occurrence past the first so positions are useful.
      let seen = 0;
      for (const s of overlay.substitutions) {
        if (s.target !== target) continue;
        seen += 1;
        if (seen > 1) {
          emit("OVERLAY007", `Duplicate <substitution target=${JSON.stringify(target)}>.`, s.pos);
        }
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

function hasSpuriousPrecision(raw: string): boolean {
  const dot = raw.indexOf(".");
  if (dot < 0) return false;
  const frac = raw
    .slice(dot + 1)
    .replace(/[^0-9]/g, "")
    .replace(/0+$/, "");
  return frac.length > 2;
}
