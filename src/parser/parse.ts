import type { ArgMLDocument } from "../ast/document.js";
import { buildDocument } from "./builder.js";
import type { ParseDiagnostic } from "./diagnostics.js";
import { LineMap } from "./positions.js";
import { type RawNode, createParser, isRawNode, validateXml } from "./xml.js";

export interface ParseResult {
  document: ArgMLDocument | null;
  diagnostics: ParseDiagnostic[];
}

export function parseArgML(xml: string): ParseResult {
  const lineMap = new LineMap(xml);

  const wellFormed = validateXml(xml);
  if (wellFormed !== null) {
    return {
      document: null,
      diagnostics: [
        {
          code: "PARSE001",
          severity: "error",
          message: `Malformed XML: ${wellFormed.message}`,
          pos: lineMap.positionAt(offsetFor(xml, wellFormed.line, wellFormed.column)),
        },
      ],
    };
  }

  const parser = createParser();
  let raw: unknown;
  try {
    raw = parser.parse(xml);
  } catch (err) {
    return {
      document: null,
      diagnostics: [
        {
          code: "PARSE001",
          severity: "error",
          message: `XML parse failure: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
    };
  }

  if (!Array.isArray(raw)) {
    return {
      document: null,
      diagnostics: [
        {
          code: "PARSE001",
          severity: "error",
          message: "Unexpected parser output (not an array).",
        },
      ],
    };
  }

  const roots: RawNode[] = raw.filter(isRawNode);
  return buildDocument(roots, lineMap);
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
