import type { ArgMLDocument } from "../ast/document.js";
import type { ParsedDocument } from "../ast/index.js";
import type { ReaderOverlayDocument } from "../ast/overlay.js";
import { buildDocument } from "./builder.js";
import type { ParseDiagnostic } from "./diagnostics.js";
import { buildOverlay } from "./overlay-builder.js";
import { LineMap } from "./positions.js";
import { type RawNode, createParser, isRawNode, tagName, validateXml } from "./xml.js";

export interface ParseResult {
  document: ArgMLDocument | null;
  diagnostics: ParseDiagnostic[];
}

export interface OverlayParseResult {
  document: ReaderOverlayDocument | null;
  diagnostics: ParseDiagnostic[];
}

export interface AnyParseResult {
  document: ParsedDocument | null;
  diagnostics: ParseDiagnostic[];
}

/** Root-dispatching parser (spec §4, §13). Returns either an `<post>` or a
 * `<reader-overlay>` document depending on the root element name. */
export function parse(xml: string): AnyParseResult {
  const { roots, lineMap, error } = parseRoots(xml);
  if (error) return { document: null, diagnostics: [error] };
  if (!roots) return { document: null, diagnostics: [] };

  const root = roots.find((n) => tagName(n) !== null);
  const name = root ? tagName(root) : null;
  if (root && name === "reader-overlay") {
    return buildOverlay(root, lineMap);
  }
  // Default: treat as a post document so 0.1 callers continue to work.
  return buildDocument(roots, lineMap);
}

/** Parse an ArgML `<post>` document. Errors when the root is `<reader-overlay>`. */
export function parseArgML(xml: string): ParseResult {
  const { roots, lineMap, error } = parseRoots(xml);
  if (error) return { document: null, diagnostics: [error] };
  if (!roots) return { document: null, diagnostics: [] };
  const root = roots.find((n) => tagName(n) !== null);
  const name = root ? tagName(root) : null;
  if (name === "reader-overlay") {
    return {
      document: null,
      diagnostics: [
        {
          code: "PARSE003",
          severity: "error",
          message:
            "Document root is <reader-overlay>; use parseReaderOverlay or parse for overlay documents.",
        },
      ],
    };
  }
  return buildDocument(roots, lineMap);
}

/** Parse a `<reader-overlay>` document (spec §13). Errors when the root is `<post>`. */
export function parseReaderOverlay(xml: string): OverlayParseResult {
  const { roots, lineMap, error } = parseRoots(xml);
  if (error) return { document: null, diagnostics: [error] };
  if (!roots) return { document: null, diagnostics: [] };
  const root = roots.find((n) => tagName(n) !== null);
  const name = root ? tagName(root) : null;
  if (!root || name !== "reader-overlay") {
    return {
      document: null,
      diagnostics: [
        {
          code: "PARSE003",
          severity: "error",
          message: `Document root is not <reader-overlay> (got ${name === null ? "no element" : `<${name}>`}).`,
        },
      ],
    };
  }
  return buildOverlay(root, lineMap);
}

interface RootsResult {
  roots?: RawNode[];
  lineMap: LineMap;
  error?: ParseDiagnostic;
}

function parseRoots(xml: string): RootsResult {
  const lineMap = new LineMap(xml);

  const wellFormed = validateXml(xml);
  if (wellFormed !== null) {
    return {
      lineMap,
      error: {
        code: "PARSE001",
        severity: "error",
        message: `Malformed XML: ${wellFormed.message}`,
        pos: lineMap.positionAt(offsetFor(xml, wellFormed.line, wellFormed.column)),
      },
    };
  }

  const parser = createParser();
  let raw: unknown;
  try {
    raw = parser.parse(xml);
  } catch (err) {
    return {
      lineMap,
      error: {
        code: "PARSE001",
        severity: "error",
        message: `XML parse failure: ${err instanceof Error ? err.message : String(err)}`,
      },
    };
  }

  if (!Array.isArray(raw)) {
    return {
      lineMap,
      error: {
        code: "PARSE001",
        severity: "error",
        message: "Unexpected parser output (not an array).",
      },
    };
  }

  return { roots: raw.filter(isRawNode), lineMap };
}

function offsetFor(xml: string, line: number, column: number): number {
  let offset = 0;
  let l = 1;
  while (l < line && offset < xml.length) {
    if (xml.charCodeAt(offset) === 10) l += 1;
    offset += 1;
  }
  return offset + Math.max(0, column - 1);
}
