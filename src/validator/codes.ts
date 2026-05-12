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
  | "ARGML016"
  | "ARGML017"
  | "ARGML018"
  | "ARGML019"
  | "ARGML020"
  | "ARGML021"
  | "ARGML022"
  | "ARGML023"
  | "ARGML024"
  | "ARGML025"
  | "ARGML026"
  | "ARGML027"
  | "ARGML028"
  | "ARGML029"
  | "ARGML030"
  | "OVERLAY001"
  | "OVERLAY002"
  | "OVERLAY003"
  | "OVERLAY004"
  | "OVERLAY005"
  | "OVERLAY006"
  | "OVERLAY007"
  | "OVERLAY008";

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
  ARGML017: {
    severity: "warning",
    description: "Unknown `mode` value on `<claim>` (spec §6.7 lists the recommended vocabulary).",
  },
  ARGML018: {
    severity: "error",
    description: '`mode="restated"` requires a `same-as` attribute (spec §6.10).',
  },
  ARGML019: {
    severity: "warning",
    description:
      '`mode="reductio-target"` SHOULD be paired with `defeasible="false"` on the licensing inference.',
  },
  ARGML020: {
    severity: "warning",
    description: '`mode="attributed"` SHOULD carry `attributed-to` (spec §6.9).',
  },
  ARGML021: {
    severity: "error",
    description:
      "`<argument>` may not carry `attacks` or `attack-type` — refutation belongs on `<claim>` (spec §6.8.3).",
  },
  ARGML022: {
    severity: "warning",
    description:
      "Unknown `pattern` value on `<inference>` (spec §10.2 lists the recommended vocabulary).",
  },
  ARGML023: {
    severity: "error",
    description:
      "`<takeaway ref=…>` must resolve to a local `<claim>` (cross-doc refs disallowed).",
  },
  ARGML024: {
    severity: "warning",
    description: "Duplicate `<takeaway>` for the same claim with the same priority.",
  },
  ARGML025: {
    severity: "error",
    description: "`provenance=…` references a generator id that is not declared in `<provenance>`.",
  },
  ARGML026: {
    severity: "warning",
    description:
      "`same-as=…` reference does not resolve (local id missing or undeclared cross-doc prefix).",
  },
  ARGML027: {
    severity: "warning",
    description: "`same-as` cycle detected within the document.",
  },
  ARGML028: {
    severity: "warning",
    description: "`<argument supports=…>` target must resolve to a `<claim>`.",
  },
  ARGML029: {
    severity: "warning",
    description:
      '`<inference from=…>` references an `<argument>`; allowed only for `pattern="argument-by-cases"`.',
  },
  ARGML030: {
    severity: "warning",
    description:
      "Unknown `mode` value on `<argument>` (spec §6.8.1 lists the recommended vocabulary).",
  },
  OVERLAY001: {
    severity: "error",
    description: "Duplicate `<attitude>` targeting the same id.",
  },
  OVERLAY002: {
    severity: "error",
    description: '`<attitude kind="reject">` requires `rejection-type`.',
  },
  OVERLAY003: {
    severity: "warning",
    description: '`<attitude kind="accept">` (or `"open"`) should not carry `rejection-type`.',
  },
  OVERLAY004: {
    severity: "error",
    description: "`target` uses an undeclared `<import prefix=…>`.",
  },
  OVERLAY005: {
    severity: "warning",
    description:
      "`target` has no `prefix:` segment; overlay references should be cross-document (spec §13.3).",
  },
  OVERLAY006: {
    severity: "error",
    description: "`<substitution>` `target` or `use` uses an undeclared import prefix.",
  },
  OVERLAY007: {
    severity: "warning",
    description: "Same `target` is substituted more than once.",
  },
  OVERLAY008: {
    severity: "warning",
    description:
      "Numeric `credence` outside [0, 1] or with more than two decimal places (mirrors ARGML005/013).",
  },
};
