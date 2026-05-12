import { type Diagnostic, type ParseDiagnostic, validateAny } from "../index.js";
import {
  type AnyDiagnostic,
  countSeverities,
  formatDiagnostic,
  formatSummaryLine,
} from "./format.js";
import { type LoadedAnyDocument, loadAnyDocument } from "./load.js";

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export function runValidate(path: string): CommandResult {
  let loaded: LoadedAnyDocument;
  try {
    loaded = loadAnyDocument(path);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { stdout: "", stderr: `argml: cannot read ${path}: ${msg}\n`, exitCode: 2 };
  }
  return runValidateOn(path, loaded);
}

export function runValidateOn(path: string, loaded: LoadedAnyDocument): CommandResult {
  const parseDiags: ParseDiagnostic[] = loaded.parse.diagnostics;
  const validateDiags: Diagnostic[] = loaded.parse.document
    ? validateAny(loaded.parse.document)
    : [];
  const all: AnyDiagnostic[] = [...parseDiags, ...validateDiags];

  const lines = all.map((d) => formatDiagnostic(path, d));
  const { errors, warnings } = countSeverities(all);
  lines.push(formatSummaryLine(errors, warnings));

  return {
    stdout: `${lines.join("\n")}\n`,
    stderr: "",
    exitCode: errors > 0 ? 1 : 0,
  };
}
