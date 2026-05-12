import { readFileSync } from "node:fs";
import type { AnyParseResult, ParseResult } from "../index.js";
import { parse, parseArgML } from "../index.js";

export interface LoadedDocument {
  path: string;
  source: string;
  parse: ParseResult;
}

/** Strict load: only accepts `<post>` documents. */
export function loadDocument(path: string): LoadedDocument {
  const source = readFileSync(path, "utf8");
  const parseResult = parseArgML(source);
  return { path, source, parse: parseResult };
}

export interface LoadedAnyDocument {
  path: string;
  source: string;
  parse: AnyParseResult;
}

/** Dispatching load: accepts either `<post>` or `<reader-overlay>`. */
export function loadAnyDocument(path: string): LoadedAnyDocument {
  const source = readFileSync(path, "utf8");
  const parseResult = parse(source);
  return { path, source, parse: parseResult };
}
