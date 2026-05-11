import type { DiagnosticSeverity } from "./diagnostics.js";

export type DiagnosticCode =
  | "ARGML001"
  | "ARGML002"
  | "ARGML003"
  | "ARGML004"
  | "ARGML005"
  | "ARGML006"
  | "ARGML007"
  | "ARGML008"
  | "ARGML009"
  | "ARGML010"
  | "ARGML011"
  | "ARGML012"
  | "ARGML013"
  | "ARGML014"
  | "ARGML015"
  | "ARGML016";

export interface CodeMeta {
  severity: DiagnosticSeverity;
  description: string;
}

export const ARGML_CODES: Record<DiagnosticCode, CodeMeta> = {
  ARGML001: { severity: "error", description: "Duplicate `id` within document." },
  ARGML002: { severity: "error", description: "Unresolved local reference." },
  ARGML003: {
    severity: "error",
    description: "Cross-document reference uses an undeclared `<import prefix=…>`.",
  },
  ARGML004: { severity: "error", description: "`<inference>` has no `from` premises." },
  ARGML005: { severity: "error", description: "Numeric `credence` outside [0, 1]." },
  ARGML006: { severity: "error", description: "Numeric `strength` outside [0, 1]." },
  ARGML007: { severity: "error", description: "Empty `<alias>` text on a term declaration." },
  ARGML008: {
    severity: "warning",
    description:
      "Reference target kind mismatch: `rests-on` / inference `from` must resolve to a `<claim>` or `<assumption>`.",
  },
  ARGML009: {
    severity: "warning",
    description: "`<inference to=…>` target must resolve to a `<claim>`.",
  },
  ARGML010: {
    severity: "warning",
    description: "`<conflict>` `<attacker>` / `<target>` must resolve to a claim or inference.",
  },
  ARGML011: {
    severity: "warning",
    description: '`strength="deductive"` is inconsistent with `defeasible="true"`.',
  },
  ARGML012: {
    severity: "warning",
    description: 'Undercut conflict targets an inference whose `defeasible="false"`.',
  },
  ARGML013: {
    severity: "warning",
    description:
      "Numeric `credence` / `strength` with more than two decimal places (spurious precision per spec §12.2).",
  },
  ARGML014: {
    severity: "warning",
    description: "`<term ref=…>` does not resolve to a declared term.",
  },
  ARGML015: { severity: "warning", description: "`via=…` does not resolve to an `<inference>`." },
  ARGML016: {
    severity: "warning",
    description: "`supports` / `attacks` target must resolve to a `<claim>`.",
  },
};
