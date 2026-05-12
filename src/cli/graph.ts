import type { ArgMLDocument, AttackType } from "../index.js";
import { type LoadedDocument, loadDocument } from "./load.js";
import type { CommandResult } from "./validate.js";
import { walkDocument } from "./walk.js";

export type GraphFormat = "json" | "dot";

export interface GraphNode {
  id: string;
  kind: "claim" | "assumption" | "inference" | "conflict" | "argument" | "external";
  credence?: string;
  strength?: string;
  defeasible?: boolean;
  /** For claims: speech-act mode (omitted when default `asserted`). */
  mode?: string;
  /** For inferences: compositional pattern (spec §10.2). */
  pattern?: string;
  /** For arguments: dialectical-move mode (spec §6.8.1). */
  argumentMode?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  kind:
    | "supports"
    | "attacks"
    | "rests-on"
    | "via-inference"
    | "via-argument"
    | "from"
    | "to"
    | "same-as";
  attackType?: AttackType;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export function runGraph(path: string, format: GraphFormat): CommandResult {
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
      stderr: `argml: ${path}: parse failed; cannot build graph\n`,
      exitCode: 1,
    };
  }
  return runGraphOn(loaded.parse.document, format);
}

export function runGraphOn(doc: ArgMLDocument, format: GraphFormat): CommandResult {
  const data = buildGraph(doc);
  const out = format === "dot" ? toDot(data) : toCytoscapeJson(data);
  return { stdout: `${out}\n`, stderr: "", exitCode: 0 };
}

export function buildGraph(doc: ArgMLDocument): GraphData {
  const walked = walkDocument(doc);
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const knownIds = new Set<string>();
  const externals = new Set<string>();

  for (const a of walked.assumptions) {
    nodes.push({ id: a.id, kind: "assumption" });
    knownIds.add(a.id);
  }
  for (const c of walked.claims) {
    nodes.push({
      id: c.id,
      kind: "claim",
      ...(c.credence ? { credence: valueString(c.credence) } : {}),
      ...(c.mode !== undefined && c.mode !== "asserted" ? { mode: c.mode } : {}),
    });
    knownIds.add(c.id);
  }
  for (const i of walked.inferences) {
    nodes.push({
      id: i.id,
      kind: "inference",
      ...(i.strength ? { strength: valueString(i.strength) } : {}),
      ...(i.defeasible !== undefined ? { defeasible: i.defeasible } : {}),
      ...(i.pattern !== undefined ? { pattern: i.pattern } : {}),
    });
    knownIds.add(i.id);
  }
  for (const cf of walked.conflicts) {
    nodes.push({ id: cf.id, kind: "conflict" });
    knownIds.add(cf.id);
  }
  for (const ar of walked.arguments) {
    if (ar.id === undefined) continue;
    nodes.push({
      id: ar.id,
      kind: "argument",
      argumentMode: ar.mode,
    });
    knownIds.add(ar.id);
  }

  const noteExternal = (id: string): void => {
    if (knownIds.has(id) || externals.has(id)) return;
    if (id.includes(":")) {
      externals.add(id);
      nodes.push({ id, kind: "external" });
    }
  };

  for (const a of walked.assumptions) {
    for (const r of a.restsOn) {
      noteExternal(r);
      edges.push({ source: a.id, target: r, kind: "rests-on" });
    }
  }
  for (const c of walked.claims) {
    for (const t of c.supports) {
      noteExternal(t);
      edges.push({ source: c.id, target: t, kind: "supports" });
    }
    for (const t of c.attacks) {
      noteExternal(t);
      edges.push({
        source: c.id,
        target: t,
        kind: "attacks",
        ...(c.attackType ? { attackType: c.attackType } : {}),
      });
    }
    for (const r of c.restsOn) {
      noteExternal(r);
      edges.push({ source: c.id, target: r, kind: "rests-on" });
    }
    if (c.via) {
      noteExternal(c.via);
      edges.push({ source: c.id, target: c.via, kind: "via-inference" });
    }
    if (c.sameAs) {
      noteExternal(c.sameAs);
      edges.push({ source: c.id, target: c.sameAs, kind: "same-as" });
    }
  }
  for (const i of walked.inferences) {
    for (const p of i.from) {
      noteExternal(p);
      edges.push({ source: p, target: i.id, kind: "from" });
    }
    noteExternal(i.to);
    edges.push({ source: i.id, target: i.to, kind: "to" });
  }
  for (const cf of walked.conflicts) {
    noteExternal(cf.attacker.idref);
    noteExternal(cf.target.idref);
    edges.push({
      source: cf.attacker.idref,
      target: cf.target.idref,
      kind: "attacks",
      ...(cf.attackType ? { attackType: cf.attackType } : {}),
    });
  }
  for (const ar of walked.arguments) {
    if (ar.id === undefined) continue;
    for (const t of ar.supports) {
      noteExternal(t);
      edges.push({ source: ar.id, target: t, kind: "supports" });
    }
    for (const r of ar.restsOn) {
      noteExternal(r);
      edges.push({ source: ar.id, target: r, kind: "rests-on" });
    }
    if (ar.via) {
      noteExternal(ar.via);
      edges.push({ source: ar.id, target: ar.via, kind: "via-argument" });
    }
  }

  return { nodes, edges };
}

function valueString(
  v: { kind: "bucket"; value: string } | { kind: "numeric"; raw: string },
): string {
  return v.kind === "bucket" ? v.value : v.raw;
}

function toCytoscapeJson(data: GraphData): string {
  const payload = {
    nodes: data.nodes.map((n) => ({ data: { ...n } })),
    edges: data.edges.map((e, idx) => ({
      data: { id: `e${idx}`, ...e },
    })),
  };
  return JSON.stringify(payload, null, 2);
}

function toDot(data: GraphData): string {
  const lines: string[] = ["digraph argml {"];
  lines.push("  rankdir=BT;");
  for (const n of data.nodes) {
    lines.push(`  ${quote(n.id)} [${nodeAttrs(n)}];`);
  }
  for (const e of data.edges) {
    lines.push(`  ${quote(e.source)} -> ${quote(e.target)} [${edgeAttrs(e)}];`);
  }
  lines.push("}");
  return lines.join("\n");
}

function nodeAttrs(n: GraphNode): string {
  const shapes: Record<GraphNode["kind"], string> = {
    claim: "box",
    assumption: "ellipse",
    inference: "diamond",
    conflict: "octagon",
    argument: "parallelogram",
    external: "note",
  };
  const labelParts: string[] = [n.id];
  if (n.mode) labelParts.push(`mode=${n.mode}`);
  if (n.argumentMode) labelParts.push(`mode=${n.argumentMode}`);
  if (n.credence) labelParts.push(`cred=${n.credence}`);
  if (n.strength) labelParts.push(`str=${n.strength}`);
  if (n.pattern) labelParts.push(`pat=${n.pattern}`);
  return `shape=${shapes[n.kind]}, label=${quote(labelParts.join("\\n"))}`;
}

function edgeAttrs(e: GraphEdge): string {
  const parts: string[] = [`label=${quote(e.attackType ? `${e.kind}/${e.attackType}` : e.kind)}`];
  switch (e.kind) {
    case "supports":
      parts.push("color=black");
      break;
    case "attacks":
      parts.push("color=red");
      break;
    case "rests-on":
      parts.push("style=dashed");
      break;
    case "via-inference":
    case "via-argument":
      parts.push("style=dotted");
      break;
    case "same-as":
      parts.push("style=dashed", "color=blue");
      break;
    case "from":
    case "to":
      parts.push("color=gray");
      break;
  }
  return parts.join(", ");
}

function quote(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
