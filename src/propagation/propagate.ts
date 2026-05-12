import type { ArgMLDocument } from "../ast/document.js";
import type { AttackType, AttitudeKind } from "../ast/index.js";
import type { ReaderOverlayDocument } from "../ast/overlay.js";
import type { SourcePosition } from "../ast/position.js";
import { type EquivalenceClasses, computeEquivalenceClasses } from "./equivalence.js";
import { type PropagationGraph, buildPropagationGraph } from "./graph.js";

export type PropagationStatus = "endorsed" | "supported" | "provisional" | "blocked";

export type PropagationDiagnosticCode = "PROP001" | "PROP002" | "PROP003" | "PROP004";

export interface PropagationDiagnostic {
  code: PropagationDiagnosticCode;
  severity: "error" | "warning";
  message: string;
  pos?: SourcePosition;
}

export interface NodeStatus {
  id: string;
  status: PropagationStatus;
  /** Ids of rejected ancestors that contribute blocking weight to `status`. */
  rejectedAncestors: string[];
  /** Ids of `kind="open"` ancestors. */
  openAncestors: string[];
  /** True iff this node (or a same-as class member) is itself `accept`ed. */
  accepted: boolean;
}

export interface TakeawayStatus extends NodeStatus {
  priority?: string;
}

export interface PropagationResult {
  takeaways: TakeawayStatus[];
  nodes: Map<string, NodeStatus>;
  /** The import prefix in the overlay that maps to the post (matched by post id
   * appearing in the import's `doc` URL). Undefined when no unique match. */
  postPrefix: string | undefined;
  diagnostics: PropagationDiagnostic[];
}

export interface PropagationOptions {
  /** Override the auto-detected import prefix that maps to the post. */
  postPrefix?: string;
}

interface ResolvedAttitude {
  kind: AttitudeKind;
  rejectionType: AttackType | undefined;
  /** The local id (post-side) that the attitude targeted. */
  localTarget: string;
  pos?: SourcePosition;
}

const NON_BLOCKING_CLAIM_MODES: ReadonlySet<string> = new Set([
  "anticipated-objection",
  "attributed",
  "reductio-target",
  "conceded",
]);

/** Local propagation engine (spec §13.5).
 *
 * Operates on a single post and a single reader-overlay loaded from disk.
 * Cross-document propagation (overlays spanning multiple imported posts) is a
 * Phase 7 concern; here only attitudes whose import prefix maps to the given
 * post are considered. */
export function propagate(
  post: ArgMLDocument,
  overlay: ReaderOverlayDocument,
  opts: PropagationOptions = {},
): PropagationResult {
  const eq = computeEquivalenceClasses(post);
  const graph = buildPropagationGraph(post, eq);
  const diagnostics: PropagationDiagnostic[] = [];

  const postPrefix = opts.postPrefix ?? identifyPostPrefix(post, overlay, diagnostics);

  const attitudesByMember = new Map<string, ResolvedAttitude>();
  if (postPrefix !== undefined) {
    for (const a of overlay.attitudes) {
      const colon = a.target.indexOf(":");
      if (colon < 0) continue;
      const prefix = a.target.slice(0, colon);
      const localId = a.target.slice(colon + 1);
      if (prefix !== postPrefix) continue;
      if (!graph.nodes.has(localId)) {
        diagnostics.push({
          code: "PROP003",
          severity: "warning",
          message: `attitude target "${a.target}" does not resolve to any id in post "${post.id}".`,
          ...(a.pos ? { pos: a.pos } : {}),
        });
        continue;
      }
      attitudesByMember.set(localId, {
        kind: a.attitudeKind,
        rejectionType: a.rejectionType,
        localTarget: localId,
        ...(a.pos ? { pos: a.pos } : {}),
      });
    }
  }

  const lookupAttitude = (id: string): ResolvedAttitude | undefined => {
    for (const m of eq.members(id)) {
      const att = attitudesByMember.get(m);
      if (att) return att;
    }
    return undefined;
  };

  const takeaways = post.head.takeaways?.takeaways ?? [];
  const nodeStatuses = new Map<string, NodeStatus>();
  const takeawayStatuses: TakeawayStatus[] = [];

  for (const t of takeaways) {
    if (t.ref === "" || t.ref.includes(":")) continue;
    if (!graph.nodes.has(t.ref)) continue;
    const status = computeStatus(t.ref, graph, eq, lookupAttitude);
    const ts: TakeawayStatus = {
      ...status,
      ...(t.priority !== undefined ? { priority: t.priority } : {}),
    };
    takeawayStatuses.push(ts);
    nodeStatuses.set(t.ref, status);
  }

  return {
    takeaways: takeawayStatuses,
    nodes: nodeStatuses,
    postPrefix,
    diagnostics,
  };
}

function computeStatus(
  targetId: string,
  graph: PropagationGraph,
  eq: EquivalenceClasses,
  lookupAttitude: (id: string) => ResolvedAttitude | undefined,
): NodeStatus {
  const reached = reverseReachable(targetId, graph);
  const rejectedAncestors: string[] = [];
  const openAncestors: string[] = [];
  let accepted = false;

  for (const id of reached) {
    const node = graph.nodes.get(id);
    if (!node) continue;
    const att = lookupAttitude(id);
    if (!att) continue;

    if (att.kind === "accept") {
      if (eq.equivalent(id, targetId)) accepted = true;
      continue;
    }

    if (att.kind === "open") {
      openAncestors.push(id);
      continue;
    }

    // att.kind === "reject"
    if (node.kind === "claim") {
      const mode = node.mode ?? "asserted";
      if (!NON_BLOCKING_CLAIM_MODES.has(mode)) {
        rejectedAncestors.push(id);
      }
      continue;
    }
    if (node.kind === "inference" || node.kind === "assumption") {
      rejectedAncestors.push(id);
      continue;
    }
    if (node.kind === "argument") {
      // §13.5: argument rejection breaks the supports edge to its target. It
      // blocks a takeaway T only if the argument directly supports T (or a
      // same-as equivalent) AND T has no remaining path of support.
      const supportsTakeaway = node.argumentSupports?.some((s) => eq.equivalent(s, targetId));
      if (supportsTakeaway && !hasAlternatePath(targetId, id, graph)) {
        rejectedAncestors.push(id);
      }
    }
  }

  let status: PropagationStatus;
  if (rejectedAncestors.length > 0) status = "blocked";
  else if (accepted && openAncestors.length === 0) status = "endorsed";
  else if (openAncestors.length > 0) status = "provisional";
  else status = "supported";

  return { id: targetId, status, rejectedAncestors, openAncestors, accepted };
}

function reverseReachable(start: string, graph: PropagationGraph): Set<string> {
  const visited = new Set<string>();
  const queue = [start];
  while (queue.length > 0) {
    const cur = queue.shift() as string;
    if (visited.has(cur)) continue;
    visited.add(cur);
    for (const a of graph.ancestorsOf(cur)) {
      if (!visited.has(a)) queue.push(a);
    }
  }
  return visited;
}

/** Returns true iff `target` has at least one ancestor chain leading to a leaf
 * (a node with no ancestors) without traversing `excluded`. */
function hasAlternatePath(target: string, excluded: string, graph: PropagationGraph): boolean {
  const visited = new Set<string>([excluded]);
  const queue = [target];
  let foundLeaf = false;
  while (queue.length > 0) {
    const cur = queue.shift() as string;
    if (visited.has(cur)) continue;
    visited.add(cur);
    const ancs = [...graph.ancestorsOf(cur)].filter((a) => a !== excluded);
    if (ancs.length === 0) {
      if (cur !== target) foundLeaf = true;
      continue;
    }
    for (const a of ancs) queue.push(a);
  }
  return foundLeaf;
}

/** Match an import's `doc` URL against the post id. The matching is segment-
 * aware: the post id must appear as a `/`-delimited path segment or as the
 * fragment / final identifier of the URL. This avoids false positives where
 * the post id is a substring of an unrelated token. */
function docMatchesPostId(doc: string, postId: string): boolean {
  if (postId === "" || doc === "") return false;
  // Strip query/fragment and split on `/`.
  const stripped = doc.split(/[?#]/)[0] ?? doc;
  const segments = stripped.split("/").filter((s) => s !== "");
  return segments.includes(postId);
}

function identifyPostPrefix(
  post: ArgMLDocument,
  overlay: ReaderOverlayDocument,
  diagnostics: PropagationDiagnostic[],
): string | undefined {
  if (post.id === "") {
    diagnostics.push({
      code: "PROP001",
      severity: "warning",
      message: "post has no id; cannot match overlay import prefix.",
    });
    return undefined;
  }
  const candidates: string[] = [];
  for (const imp of overlay.imports.imports) {
    if (imp.prefix === "" || imp.doc === "") continue;
    if (docMatchesPostId(imp.doc, post.id)) candidates.push(imp.prefix);
  }
  if (candidates.length === 1) return candidates[0];
  if (candidates.length === 0) {
    diagnostics.push({
      code: "PROP001",
      severity: "warning",
      message: `overlay has no <import doc=...> matching post id "${post.id}"; no attitudes resolve locally.`,
    });
    return undefined;
  }
  diagnostics.push({
    code: "PROP002",
    severity: "warning",
    message: `overlay has multiple imports matching post id "${post.id}": ${candidates
      .map((c) => `"${c}"`)
      .join(", ")}. Using the first; pass an explicit prefix to disambiguate.`,
  });
  return candidates[0];
}
