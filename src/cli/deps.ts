import type { ArgMLDocument, AssumptionNode, ClaimNode, InferenceNode } from "../index.js";
import { type LoadedDocument, loadDocument } from "./load.js";
import type { CommandResult } from "./validate.js";
import { walkDocument } from "./walk.js";

type AnyNode = ClaimNode | AssumptionNode | InferenceNode;

interface NodeIndex {
  byId: Map<string, AnyNode>;
  supportedBy: Map<string, string[]>;
  inferencesByTo: Map<string, InferenceNode[]>;
}

export function runDeps(path: string, target: string): CommandResult {
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
      stderr: `argml: ${path}: parse failed; cannot compute dependencies\n`,
      exitCode: 1,
    };
  }
  return runDepsOn(loaded.parse.document, target);
}

export function runDepsOn(doc: ArgMLDocument, target: string): CommandResult {
  const index = buildIndex(doc);
  const root = index.byId.get(target);
  if (!root) {
    return {
      stdout: "",
      stderr: `argml: target id '${target}' not found in document\n`,
      exitCode: 2,
    };
  }

  const lines: string[] = [];
  lines.push(`Target: ${describe(root)}`);
  lines.push("");
  lines.push("Rests on:");
  renderTree(target, (id) => restsOnChildren(id, index), index, lines);
  lines.push("");
  lines.push("Supports (downstream conclusions):");
  renderTree(target, (id) => supportsChildren(id, index), index, lines);
  lines.push("");
  lines.push("Supported by (upstream premises):");
  renderTree(target, (id) => supportedByChildren(id, index), index, lines);

  return { stdout: `${lines.join("\n")}\n`, stderr: "", exitCode: 0 };
}

function buildIndex(doc: ArgMLDocument): NodeIndex {
  const walked = walkDocument(doc);
  const byId = new Map<string, AnyNode>();
  for (const c of walked.claims) byId.set(c.id, c);
  for (const a of walked.assumptions) byId.set(a.id, a);
  for (const i of walked.inferences) byId.set(i.id, i);

  const supportedBy = new Map<string, string[]>();
  for (const c of walked.claims) {
    for (const t of c.supports) {
      const list = supportedBy.get(t) ?? [];
      list.push(c.id);
      supportedBy.set(t, list);
    }
  }
  const inferencesByTo = new Map<string, InferenceNode[]>();
  for (const i of walked.inferences) {
    const list = inferencesByTo.get(i.to) ?? [];
    list.push(i);
    inferencesByTo.set(i.to, list);
  }
  return { byId, supportedBy, inferencesByTo };
}

function restsOnChildren(id: string, index: NodeIndex): string[] {
  const node = index.byId.get(id);
  if (!node) return [];
  if (node.kind === "claim" || node.kind === "assumption") return node.restsOn;
  return [];
}

function supportsChildren(id: string, index: NodeIndex): string[] {
  const node = index.byId.get(id);
  if (!node) return [];
  if (node.kind === "claim") return node.supports;
  return [];
}

function supportedByChildren(id: string, index: NodeIndex): string[] {
  const direct = index.supportedBy.get(id) ?? [];
  const viaInf = index.inferencesByTo.get(id) ?? [];
  const out: string[] = [...direct];
  for (const inf of viaInf) {
    // Treat the inference as an intermediate node whose premises are its `from`.
    out.push(inf.id);
  }
  return out;
}

function renderTree(
  rootId: string,
  childrenOf: (id: string) => string[],
  index: NodeIndex,
  lines: string[],
): void {
  const kids = childrenOf(rootId);
  if (kids.length === 0) {
    lines.push("  (none)");
    return;
  }
  const visited = new Set<string>([rootId]);
  for (let i = 0; i < kids.length; i += 1) {
    const last = i === kids.length - 1;
    renderChild(kids[i] as string, "  ", last, childrenOf, index, lines, visited);
  }
}

function renderChild(
  id: string,
  prefix: string,
  isLast: boolean,
  childrenOf: (id: string) => string[],
  index: NodeIndex,
  lines: string[],
  visited: Set<string>,
): void {
  const connector = isLast ? "└── " : "├── ";
  const node = index.byId.get(id);
  if (!node) {
    // Either a cross-doc reference or an unresolved id.
    const tag = id.includes(":") ? "external" : "unresolved";
    lines.push(`${prefix}${connector}${id} [${tag}]`);
    return;
  }
  if (visited.has(id)) {
    lines.push(`${prefix}${connector}${describe(node)} [cycle]`);
    return;
  }
  lines.push(`${prefix}${connector}${describe(node)}`);
  const nextVisited = new Set(visited);
  nextVisited.add(id);
  const kids = childrenOf(id);
  const nextPrefix = prefix + (isLast ? "    " : "│   ");
  for (let i = 0; i < kids.length; i += 1) {
    const last = i === kids.length - 1;
    renderChild(kids[i] as string, nextPrefix, last, childrenOf, index, lines, nextVisited);
  }
}

function describe(node: AnyNode): string {
  switch (node.kind) {
    case "claim": {
      const cred = node.credence ? ` credence=${formatValue(node.credence)}` : "";
      return `claim ${node.id}${cred}`;
    }
    case "assumption":
      return `assumption ${node.id}`;
    case "inference": {
      const str = node.strength ? ` strength=${formatValue(node.strength)}` : "";
      const def = node.defeasible === false ? " strict" : "";
      return `inference ${node.id}${def}${str}`;
    }
  }
}

function formatValue(
  v: { kind: "bucket"; value: string } | { kind: "numeric"; raw: string },
): string {
  return v.kind === "bucket" ? v.value : v.raw;
}
