import { readFileSync } from "node:fs";
import { type ParseResult, parseArgML } from "../index.js";

export interface LoadedDocument {
  path: string;
  source: string;
  parse: ParseResult;
}

export function loadDocument(path: string): LoadedDocument {
  const source = readFileSync(path, "utf8");
  const parse = parseArgML(source);
  return { path, source, parse };
}
