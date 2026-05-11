import type { Diagnostic, ParseDiagnostic } from "../index.js";

export type AnyDiagnostic = Diagnostic | ParseDiagnostic;

export function formatDiagnostic(path: string, diag: AnyDiagnostic): string {
  const loc = diag.pos ? `${path}:${diag.pos.line}:${diag.pos.column}` : path;
  return `${loc}: ${diag.severity} ${diag.code} ${diag.message}`;
}

export function countSeverities(diags: ReadonlyArray<AnyDiagnostic>): {
  errors: number;
  warnings: number;
} {
  let errors = 0;
  let warnings = 0;
  for (const d of diags) {
    if (d.severity === "error") errors += 1;
    else if (d.severity === "warning") warnings += 1;
  }
  return { errors, warnings };
}

export function formatSummaryLine(errors: number, warnings: number): string {
  return `${errors} ${errors === 1 ? "error" : "errors"}, ${warnings} ${
    warnings === 1 ? "warning" : "warnings"
  }`;
}
