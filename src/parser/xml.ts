import { XMLParser, XMLValidator } from "fast-xml-parser";

export interface XmlValidationError {
  code: string;
  message: string;
  line: number;
  column: number;
}

export function validateXml(xml: string): XmlValidationError | null {
  const result = XMLValidator.validate(xml);
  if (result === true) return null;
  return {
    code: result.err.code,
    message: result.err.msg,
    line: result.err.line,
    column: result.err.col,
  };
}

export const META_SYMBOL = XMLParser.getMetaDataSymbol() as unknown as symbol;

export function createParser(): XMLParser {
  return new XMLParser({
    preserveOrder: true,
    ignoreAttributes: false,
    attributeNamePrefix: "",
    attributesGroupName: ":@",
    trimValues: false,
    parseTagValue: false,
    parseAttributeValue: false,
    processEntities: true,
    captureMetaData: true,
    ignoreDeclaration: true,
    ignorePiTags: true,
  });
}

export interface XmlMeta {
  startIndex?: number;
}

export type AttrMap = Record<string, string>;

/**
 * One entry of fast-xml-parser's `preserveOrder` output: an object with
 * exactly one tag-name key whose value is the array of children, plus an
 * optional `:@` key for attributes, plus a meta symbol.
 *
 * Text nodes use the key `#text` with a string value.
 */
export interface RawNode {
  [key: string]: unknown;
}

export function isRawNode(value: unknown): value is RawNode {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function tagName(node: RawNode): string | null {
  for (const key of Object.keys(node)) {
    if (key === ":@" || key === "#text") continue;
    return key;
  }
  return null;
}

export function tagChildren(node: RawNode, name: string): RawNode[] {
  const v = node[name];
  if (Array.isArray(v)) {
    return v.filter(isRawNode);
  }
  return [];
}

export function tagAttrs(node: RawNode): AttrMap {
  const raw = node[":@"];
  if (!isRawNode(raw)) return {};
  const out: AttrMap = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string") out[k] = v;
    else if (typeof v === "number" || typeof v === "boolean") out[k] = String(v);
  }
  return out;
}

export function metaOf(node: RawNode): XmlMeta | undefined {
  const m = (node as Record<symbol, unknown>)[META_SYMBOL];
  if (typeof m === "object" && m !== null && "startIndex" in m) {
    const idx = (m as { startIndex?: unknown }).startIndex;
    if (typeof idx === "number") return { startIndex: idx };
  }
  return undefined;
}

export function textValue(node: RawNode): string | null {
  const v = node["#text"];
  return typeof v === "string" ? v : null;
}
