import type { ArgMLDocument } from "../index.js";
import { type LoadedDocument, loadDocument } from "./load.js";
import type { CommandResult } from "./validate.js";
import { walkDocument } from "./walk.js";

const CROSS_DOC_RE = /^[A-Za-z_][\w.-]*:[^/]/;

export interface CrossDocRef {
  ref: string;
  prefix: string;
  knownPrefix: boolean;
  source: string;
}

export function runSummary(path: string): CommandResult {
  let loaded: LoadedDocument;
  try {
    loaded = loadDocument(path);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { stdout: "", stderr: `argml: cannot read ${path}: ${msg}\n`, exitCode: 2 };
  }
  if (!loaded.parse.document) {
    return {
      stdout: "",
      stderr: `argml: ${path}: parse failed; cannot summarize\n`,
      exitCode: 1,
    };
  }
  return runSummaryOn(loaded.parse.document);
}

export function runSummaryOn(doc: ArgMLDocument): CommandResult {
  const walked = walkDocument(doc);
  const knownPrefixes = new Set<string>(doc.head.imports?.imports.map((i) => i.prefix) ?? []);
  const refs = collectCrossDocRefs(doc, knownPrefixes);

  const lines: string[] = [];
  lines.push(`Document: ${doc.id}`);
  if (doc.head.metadata.title) lines.push(`Title: ${doc.head.metadata.title}`);
  lines.push("");
  lines.push("Counts:");
  lines.push(`  terms:       ${walked.terms.length}`);
  lines.push(`  assumptions: ${walked.assumptions.length}`);
  lines.push(`  claims:      ${walked.claims.length}`);
  lines.push(`  inferences:  ${walked.inferences.length}`);
  lines.push(`  conflicts:   ${walked.conflicts.length}`);
  lines.push(`  arguments:   ${walked.arguments.length}`);
  lines.push(`  takeaways:   ${walked.takeaways.length}`);
  lines.push(`  generators:  ${walked.generators.length}`);
  lines.push(`  sections:    ${walked.sections}`);
  lines.push(`  paragraphs:  ${walked.paragraphs}`);

  // Distribution of <claim mode=…> values (only non-default entries).
  const modeCounts = new Map<string, number>();
  for (const c of walked.claims) {
    if (c.mode !== undefined && c.mode !== "asserted") {
      modeCounts.set(c.mode, (modeCounts.get(c.mode) ?? 0) + 1);
    }
  }
  if (modeCounts.size > 0) {
    lines.push("");
    lines.push("Claim modes (non-asserted):");
    const sorted = Array.from(modeCounts.entries()).sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    );
    for (const [mode, n] of sorted) lines.push(`  ${mode}: ${n}`);
  }

  // Distribution of <inference pattern=…> values.
  const patternCounts = new Map<string, number>();
  for (const i of walked.inferences) {
    if (i.pattern !== undefined) {
      patternCounts.set(i.pattern, (patternCounts.get(i.pattern) ?? 0) + 1);
    }
  }
  if (patternCounts.size > 0) {
    lines.push("");
    lines.push("Inference patterns:");
    const sorted = Array.from(patternCounts.entries()).sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    );
    for (const [pat, n] of sorted) lines.push(`  ${pat}: ${n}`);
  }

  if (walked.takeaways.length > 0) {
    lines.push("");
    lines.push("Takeaways:");
    for (const t of walked.takeaways) {
      const pri = t.priority ? ` [${t.priority}]` : "";
      lines.push(`  ${t.ref}${pri}`);
    }
  }

  lines.push("");
  lines.push("Imports:");
  if (knownPrefixes.size === 0) {
    lines.push("  (none)");
  } else {
    for (const imp of doc.head.imports?.imports ?? []) {
      lines.push(`  ${imp.prefix} -> ${imp.doc}`);
    }
  }
  lines.push("");
  lines.push("Cross-document references (unresolved at this phase):");
  if (refs.length === 0) {
    lines.push("  (none)");
  } else {
    const unique = dedupeRefs(refs);
    for (const r of unique) {
      const tag = r.knownPrefix ? "declared-prefix" : "UNKNOWN PREFIX";
      lines.push(`  ${r.ref}  [${tag}]  (from ${r.source})`);
    }
  }

  return { stdout: `${lines.join("\n")}\n`, stderr: "", exitCode: 0 };
}

function collectCrossDocRefs(doc: ArgMLDocument, known: Set<string>): CrossDocRef[] {
  const refs: CrossDocRef[] = [];
  const push = (ref: string | undefined, source: string): void => {
    if (!ref) return;
    if (!CROSS_DOC_RE.test(ref)) return;
    if (ref.includes("://")) return;
    const prefix = ref.slice(0, ref.indexOf(":"));
    refs.push({ ref, prefix, knownPrefix: known.has(prefix), source });
  };
  const pushAll = (rs: ReadonlyArray<string>, source: string): void => {
    for (const r of rs) push(r, source);
  };

  for (const t of doc.head.terms?.terms ?? []) {
    push(t.canonical, `term#${t.id}.canonical`);
  }
  for (const a of doc.head.assumptions?.assumptions ?? []) {
    pushAll(a.restsOn, `assumption#${a.id}.rests-on`);
  }

  const walked = walkDocument(doc);
  for (const c of walked.claims) {
    pushAll(c.supports, `claim#${c.id}.supports`);
    pushAll(c.attacks, `claim#${c.id}.attacks`);
    pushAll(c.restsOn, `claim#${c.id}.rests-on`);
    push(c.via, `claim#${c.id}.via`);
    push(c.sameAs, `claim#${c.id}.same-as`);
  }
  for (const i of walked.inferences) {
    pushAll(i.from, `inference#${i.id}.from`);
    push(i.to, `inference#${i.id}.to`);
  }
  for (const cf of walked.conflicts) {
    push(cf.attacker.idref, `conflict#${cf.id}.attacker`);
    push(cf.target.idref, `conflict#${cf.id}.target`);
  }
  for (const ar of walked.arguments) {
    pushAll(ar.supports, `argument#${ar.id ?? "?"}.supports`);
    pushAll(ar.restsOn, `argument#${ar.id ?? "?"}.rests-on`);
    push(ar.via, `argument#${ar.id ?? "?"}.via`);
  }
  for (const tk of walked.takeaways) {
    push(tk.ref, "takeaway.ref");
  }
  for (const tr of walked.termRefs) {
    push(tr.ref, "term-ref");
  }
  for (const ev of walked.evidences) {
    push(ev.ref, "evidence.ref");
  }
  return refs;
}

function dedupeRefs(refs: CrossDocRef[]): CrossDocRef[] {
  const seen = new Map<string, CrossDocRef>();
  for (const r of refs) {
    if (!seen.has(r.ref)) seen.set(r.ref, r);
  }
  return Array.from(seen.values()).sort((a, b) => a.ref.localeCompare(b.ref));
}
