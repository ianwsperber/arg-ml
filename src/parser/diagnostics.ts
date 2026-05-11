import type { SourcePosition } from "../ast/position.js";

export type DiagnosticSeverity = "error" | "warning";

export interface ParseDiagnostic {
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  pos?: SourcePosition | undefined;
}
