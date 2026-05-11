import type { SourcePosition } from "../ast/position.js";

export class LineMap {
  private readonly starts: number[];

  constructor(source: string) {
    const starts = [0];
    for (let i = 0; i < source.length; i++) {
      if (source.charCodeAt(i) === 10 /* \n */) {
        starts.push(i + 1);
      }
    }
    this.starts = starts;
  }

  positionAt(offset: number): SourcePosition {
    if (offset < 0) return { offset: 0, line: 1, column: 1 };
    // Binary search for the largest line-start <= offset.
    let lo = 0;
    let hi = this.starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      const v = this.starts[mid];
      if (v !== undefined && v <= offset) lo = mid;
      else hi = mid - 1;
    }
    const lineStart = this.starts[lo] ?? 0;
    return { offset, line: lo + 1, column: offset - lineStart + 1 };
  }
}
