import type { ArgMLDocument } from "../ast/document.js";
import type { ReaderOverlayDocument } from "../ast/overlay.js";
import { type PropagationResult, type TakeawayStatus, propagate } from "../propagation/index.js";
import { type LoadedAnyDocument, loadAnyDocument } from "./load.js";
import type { CommandResult } from "./validate.js";

export type PropagateFormat = "text" | "json";

export interface PropagateOptions {
  format?: PropagateFormat;
  prefix?: string;
}

export function runPropagate(
  postPath: string,
  overlayPath: string,
  options: PropagateOptions = {},
): CommandResult {
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

  const postDoc = postLoaded.parse.document;
  if (!postDoc) {
    return {
      stdout: "",
      stderr: `argml: ${postPath}: parse failed; cannot propagate\n`,
      exitCode: 1,
    };
  }
  if (postDoc.kind !== "post") {
    return {
      stdout: "",
      stderr: `argml: ${postPath}: expected <post> document, got <${postDoc.kind}>\n`,
      exitCode: 2,
    };
  }
  const overlayDoc = overlayLoaded.parse.document;
  if (!overlayDoc) {
    return {
      stdout: "",
      stderr: `argml: ${overlayPath}: parse failed; cannot propagate\n`,
      exitCode: 1,
    };
  }
  if (overlayDoc.kind !== "reader-overlay") {
    return {
      stdout: "",
      stderr: `argml: ${overlayPath}: expected <reader-overlay> document, got <${overlayDoc.kind}>\n`,
      exitCode: 2,
    };
  }

  return runPropagateOn(postDoc, overlayDoc, options);
}

export function runPropagateOn(
  post: ArgMLDocument,
  overlay: ReaderOverlayDocument,
  options: PropagateOptions = {},
): CommandResult {
  const format: PropagateFormat = options.format ?? "text";
  const result = propagate(
    post,
    overlay,
    options.prefix !== undefined ? { postPrefix: options.prefix } : {},
  );

  if (format === "json") {
    return { stdout: `${formatJson(post, overlay, result)}\n`, stderr: "", exitCode: 0 };
  }
  return { stdout: `${formatText(post, overlay, result)}\n`, stderr: "", exitCode: 0 };
}

function formatText(
  post: ArgMLDocument,
  overlay: ReaderOverlayDocument,
  result: PropagationResult,
): string {
  const lines: string[] = [];
  lines.push(`Post:    ${post.id}`);
  lines.push(`Reader:  ${overlay.reader}${overlay.updated ? ` (updated ${overlay.updated})` : ""}`);
  lines.push(`Prefix:  ${result.postPrefix ?? "(none — no attitudes matched)"}`);
  lines.push("");

  for (const d of result.diagnostics) {
    lines.push(`note (${d.code}): ${d.message}`);
  }
  if (result.diagnostics.length > 0) lines.push("");

  lines.push("Takeaways:");
  if (result.takeaways.length === 0) {
    lines.push("  (no takeaways declared)");
  } else {
    const rows = result.takeaways.map(formatTakeawayRow);
    lines.push(...renderTable(["ID", "PRIORITY", "STATUS", "REJECTED", "OPEN"], rows));
  }
  return lines.join("\n");
}

function formatTakeawayRow(t: TakeawayStatus): string[] {
  return [
    t.id,
    t.priority ?? "",
    t.status,
    t.rejectedAncestors.join(", "),
    t.openAncestors.join(", "),
  ];
}

function formatJson(
  post: ArgMLDocument,
  overlay: ReaderOverlayDocument,
  result: PropagationResult,
): string {
  const payload = {
    post: post.id,
    reader: overlay.reader,
    updated: overlay.updated,
    postPrefix: result.postPrefix,
    diagnostics: result.diagnostics.map((d) => ({
      code: d.code,
      severity: d.severity,
      message: d.message,
    })),
    takeaways: result.takeaways.map((t) => ({
      id: t.id,
      priority: t.priority,
      status: t.status,
      rejectedAncestors: t.rejectedAncestors,
      openAncestors: t.openAncestors,
      accepted: t.accepted,
    })),
  };
  return JSON.stringify(payload, null, 2);
}

function renderTable(headers: string[], rows: string[][]): string[] {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)));
  const formatRow = (cells: string[]): string =>
    `  ${cells.map((c, i) => (c ?? "").padEnd(widths[i] ?? 0)).join("  ")}`.trimEnd();
  const out: string[] = [];
  out.push(formatRow(headers));
  out.push(formatRow(widths.map((w) => "-".repeat(w))));
  for (const r of rows) out.push(formatRow(r));
  return out;
}
