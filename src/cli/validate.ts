import { type Diagnostic, type ParseDiagnostic, propagate, validateAny } from "../index.js";
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

/** Validate a post + overlay pair: each independently, plus cross-document
 * resolution of overlay `prefix:id` targets against the post's symbol table. */
export function runValidatePair(postPath: string, overlayPath: string): CommandResult {
  let postLoaded: LoadedAnyDocument;
  let overlayLoaded: LoadedAnyDocument;
  try {
    postLoaded = loadAnyDocument(postPath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { stdout: "", stderr: `argml: cannot read ${postPath}: ${msg}\n`, exitCode: 2 };
  }
  try {
    overlayLoaded = loadAnyDocument(overlayPath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { stdout: "", stderr: `argml: cannot read ${overlayPath}: ${msg}\n`, exitCode: 2 };
  }

  const postBlock = runValidateOn(postPath, postLoaded);
  const overlayBlock = runValidateOn(overlayPath, overlayLoaded);

  const lines: string[] = [];
  lines.push(`# ${postPath}`);
  lines.push(postBlock.stdout.trimEnd());
  lines.push("");
  lines.push(`# ${overlayPath}`);
  lines.push(overlayBlock.stdout.trimEnd());

  // Cross-document: report overlay targets that don't resolve in the post.
  const postDoc = postLoaded.parse.document;
  const overlayDoc = overlayLoaded.parse.document;
  let crossErrors = 0;
  let crossWarnings = 0;
  if (postDoc?.kind === "post" && overlayDoc?.kind === "reader-overlay") {
    const result = propagate(postDoc, overlayDoc);
    lines.push("");
    lines.push(`# ${postPath} ↔ ${overlayPath}`);
    if (result.diagnostics.length === 0) {
      lines.push("ok — all overlay targets resolve in the post.");
    } else {
      for (const d of result.diagnostics) {
        lines.push(`${overlayPath}: ${d.severity}: ${d.code}: ${d.message}`);
        if (d.severity === "error") crossErrors += 1;
        else crossWarnings += 1;
      }
      lines.push(formatSummaryLine(crossErrors, crossWarnings));
    }
  }

  const exitCode = Math.max(postBlock.exitCode, overlayBlock.exitCode, crossErrors > 0 ? 1 : 0);
  return { stdout: `${lines.join("\n")}\n`, stderr: "", exitCode };
}
