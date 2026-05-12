import type { ArgMLDocument } from "../ast/document.js";
import type {
  ArgumentNode,
  AssumptionNode,
  BlockOrInline,
  ClaimNode,
  InferenceNode,
} from "../ast/nodes.js";
import type { EquivalenceClasses } from "./equivalence.js";

export type PropagationNodeKind = "claim" | "inference" | "argument" | "assumption";

export interface PropagationNode {
  id: string;
  kind: PropagationNodeKind;
  /** For claims and arguments: the `mode` (claims default to `"asserted"`). */
  mode?: string;
  /** For arguments: a copy of `supports`, used to check whether an argument's
   * rejection directly targets a takeaway (§13.5). */
  argumentSupports?: readonly string[];
}

export interface PropagationGraph {
  nodes: Map<string, PropagationNode>;
  /** Direct premise (ancestor) ids feeding into `id`, with same-as classes
   * merged: an ancestor of any class member is an ancestor of every member. */
  ancestorsOf(id: string): ReadonlySet<string>;
}

/** Build the propagation graph (spec §13.5).
 *
 * Edges (premise → consequent):
 * - `<claim X supports=Y>` ⇒ X → Y
 * - `<argument A supports=Y>` ⇒ A → Y
 * - `<inference I from="…" to=Y>` ⇒ each `from` item → I and I → Y
 * - `rests-on` on a claim or argument ⇒ each item → that claim/argument
 *
 * `via=I` is treated as a reference annotation, not as a graph edge: the
 * licensing edge is `inference.to`, which already encodes the consequent. If
 * the spec example's `via` and the referenced inference's `to` diverge, the
 * inference's `to` is authoritative for propagation.
 *
 * Cross-document references (`prefix:id`) and unresolved ids are dropped from
 * the graph — they reappear as gaps that propagation can't traverse, which is
 * the correct local behaviour for Phase 4.4. */
export function buildPropagationGraph(
  doc: ArgMLDocument,
  eq: EquivalenceClasses,
): PropagationGraph {
  const allClaims: ClaimNode[] = [];
  const allInferences: InferenceNode[] = [];
  const allArguments: ArgumentNode[] = [];

  const walk = (n: BlockOrInline): void => {
    switch (n.kind) {
      case "section":
        for (const c of n.children) walk(c);
        return;
      case "p":
        for (const c of n.children) walk(c);
        return;
      case "argument":
        if (n.id !== undefined) allArguments.push(n);
        for (const c of n.children) walk(c);
        return;
      case "claim":
        allClaims.push(n);
        for (const c of n.children) walk(c);
        return;
      case "inference":
        allInferences.push(n);
        for (const c of n.warrant) walk(c);
        return;
      case "conflict":
        if (n.response) for (const c of n.response.children) walk(c);
        return;
      case "term-ref":
        for (const c of n.children) walk(c);
        return;
      default:
        return;
    }
  };
  for (const c of doc.body.children) walk(c);

  const assumptions: AssumptionNode[] = doc.head.assumptions?.assumptions ?? [];

  const nodes = new Map<string, PropagationNode>();
  for (const a of assumptions) {
    nodes.set(a.id, { id: a.id, kind: "assumption" });
  }
  for (const c of allClaims) {
    nodes.set(c.id, { id: c.id, kind: "claim", mode: c.mode ?? "asserted" });
  }
  for (const i of allInferences) {
    nodes.set(i.id, { id: i.id, kind: "inference" });
  }
  for (const a of allArguments) {
    if (a.id === undefined) continue;
    nodes.set(a.id, {
      id: a.id,
      kind: "argument",
      mode: a.mode,
      argumentSupports: [...a.supports],
    });
  }

  const directAncestors = new Map<string, Set<string>>();
  const addEdge = (consequent: string, premise: string): void => {
    if (consequent === "" || premise === "") return;
    if (consequent.includes(":") || premise.includes(":")) return;
    if (!nodes.has(consequent) || !nodes.has(premise)) return;
    let s = directAncestors.get(consequent);
    if (!s) {
      s = new Set();
      directAncestors.set(consequent, s);
    }
    s.add(premise);
  };

  for (const c of allClaims) {
    for (const r of c.restsOn) addEdge(c.id, r);
    for (const target of c.supports) addEdge(target, c.id);
  }
  for (const a of allArguments) {
    if (a.id === undefined) continue;
    for (const target of a.supports) addEdge(target, a.id);
    for (const r of a.restsOn) addEdge(a.id, r);
  }
  for (const i of allInferences) {
    for (const f of i.from) addEdge(i.id, f);
    if (i.to !== "") addEdge(i.to, i.id);
  }

  // Merge ancestors across same-as classes: an ancestor of any class member
  // is an ancestor of every class member. (§13.5: "a single attitude
  // propagates to all co-referenced nodes".)
  const merged = new Map<string, Set<string>>();
  for (const id of nodes.keys()) {
    const cls = eq.members(id);
    const u = new Set<string>();
    for (const m of cls) {
      const s = directAncestors.get(m);
      if (s) for (const a of s) u.add(a);
    }
    if (u.size > 0) merged.set(id, u);
  }

  const empty: ReadonlySet<string> = new Set();
  return {
    nodes,
    ancestorsOf(id) {
      return merged.get(id) ?? empty;
    },
  };
}
