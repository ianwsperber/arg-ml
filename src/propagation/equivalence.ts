import type { ArgMLDocument } from "../ast/document.js";
import type { BlockOrInline, ClaimNode } from "../ast/nodes.js";

/** Same-as equivalence classes over local claim ids (spec §6.10, §13.5).
 *
 * Cross-document `same-as` references (`prefix:id`) are not merged here — they
 * would require a resolver. Phase 4.4 is local-only. */
export interface EquivalenceClasses {
  /** Representative id for the class containing `id`. Unknown ids are their
   * own representative. */
  classOf(id: string): string;
  /** All member ids of the class containing `id`. Unknown ids return `{id}`. */
  members(id: string): ReadonlySet<string>;
  /** True iff `a` and `b` are in the same class. */
  equivalent(a: string, b: string): boolean;
}

export function computeEquivalenceClasses(doc: ArgMLDocument): EquivalenceClasses {
  const parent = new Map<string, string>();

  const ensure = (x: string): void => {
    if (!parent.has(x)) parent.set(x, x);
  };

  const find = (x: string): string => {
    let cur = x;
    while (true) {
      const p = parent.get(cur);
      if (p === undefined || p === cur) return cur;
      cur = p;
    }
  };

  const union = (a: string, b: string): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  const claims: ClaimNode[] = [];
  const walk = (n: BlockOrInline): void => {
    switch (n.kind) {
      case "claim":
        claims.push(n);
        for (const c of n.children) walk(c);
        return;
      case "section":
      case "p":
      case "argument":
        for (const c of n.children) walk(c);
        return;
      case "inference":
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

  for (const c of claims) {
    ensure(c.id);
    if (c.sameAs !== undefined && c.sameAs !== "" && !c.sameAs.includes(":")) {
      ensure(c.sameAs);
      union(c.id, c.sameAs);
    }
  }

  // Materialize class membership keyed by root representative.
  const classes = new Map<string, Set<string>>();
  for (const id of parent.keys()) {
    const r = find(id);
    let s = classes.get(r);
    if (!s) {
      s = new Set();
      classes.set(r, s);
    }
    s.add(id);
  }

  return {
    classOf(id) {
      if (!parent.has(id)) return id;
      return find(id);
    },
    members(id) {
      if (!parent.has(id)) return new Set([id]);
      return classes.get(find(id)) ?? new Set([id]);
    },
    equivalent(a, b) {
      const ra = parent.has(a) ? find(a) : a;
      const rb = parent.has(b) ? find(b) : b;
      return ra === rb;
    },
  };
}
