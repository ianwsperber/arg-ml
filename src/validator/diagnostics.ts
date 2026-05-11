import type { SourcePosition } from "../ast/position.js";
import type { DiagnosticSeverity } from "../parser/diagnostics.js";

export type { DiagnosticSeverity };

export interface Diagnostic {
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  pos?: SourcePosition | undefined;
}
