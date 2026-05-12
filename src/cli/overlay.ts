import type { AttitudeNode, ReaderOverlayDocument, SubstitutionNode } from "../index.js";
import { loadAnyDocument } from "./load.js";
import type { CommandResult } from "./validate.js";

export function runOverlayShow(path: string): CommandResult {
  let loaded: ReturnType<typeof loadAnyDocument>;
  try {
    loaded = loadAnyDocument(path);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { stdout: "", stderr: `argml: cannot read ${path}: ${msg}\n`, exitCode: 2 };
  }
  if (!loaded.parse.document) {
    return {
      stdout: "",
      stderr: `argml: ${path}: parse failed; cannot show overlay\n`,
      exitCode: 1,
    };
  }
  if (loaded.parse.document.kind !== "reader-overlay") {
    return {
      stdout: "",
      stderr: `argml: ${path}: not a <reader-overlay> document\n`,
      exitCode: 2,
    };
  }
  return runOverlayShowOn(loaded.parse.document);
}

export function runOverlayShowOn(overlay: ReaderOverlayDocument): CommandResult {
  const lines: string[] = [];
  lines.push(`Reader: ${overlay.reader}${overlay.updated ? ` (updated ${overlay.updated})` : ""}`);
  lines.push("");
  lines.push("Attitudes:");
  if (overlay.attitudes.length === 0) {
    lines.push("  (none)");
  } else {
    const rows = overlay.attitudes.map(formatAttitudeRow);
    lines.push(...renderTable(["TARGET", "KIND", "REJECT", "CREDENCE", "NOTE"], rows));
  }
  lines.push("");
  lines.push("Substitutions:");
  if (overlay.substitutions.length === 0) {
    lines.push("  (none)");
  } else {
    const rows = overlay.substitutions.map(formatSubstitutionRow);
    lines.push(...renderTable(["TARGET", "USE", "NOTE"], rows));
  }
  return { stdout: `${lines.join("\n")}\n`, stderr: "", exitCode: 0 };
}

function formatAttitudeRow(a: AttitudeNode): string[] {
  return [
    a.target,
    a.attitudeKind,
    a.rejectionType ?? "",
    a.credence === undefined
      ? ""
      : a.credence.kind === "numeric"
        ? a.credence.raw
        : a.credence.value,
    noteSnippet(a.note),
  ];
}

function formatSubstitutionRow(s: SubstitutionNode): string[] {
  return [s.target, s.use, noteSnippet(s.note)];
}

function noteSnippet(inline: ReadonlyArray<{ kind: string; text?: string }>): string {
  const parts: string[] = [];
  for (const n of inline) {
    if (n.kind === "text" && typeof n.text === "string") parts.push(n.text);
  }
  const collapsed = parts.join(" ").replace(/\s+/g, " ").trim();
  if (collapsed.length <= 60) return collapsed;
  return `${collapsed.slice(0, 57)}...`;
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
