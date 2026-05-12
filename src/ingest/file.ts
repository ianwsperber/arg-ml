import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import type { IngestResult } from "./types.js";
import { IngestError } from "./types.js";

export async function ingestFile(path: string): Promise<IngestResult> {
  let markdown: string;
  try {
    markdown = await readFile(path, "utf8");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new IngestError(`could not read ${path}: ${msg}`, "INGEST_NOT_FOUND");
  }
  if (markdown.trim().length === 0) {
    throw new IngestError(`${path} is empty`, "INGEST_EMPTY_BODY");
  }
  return {
    markdown,
    source: { kind: "file", path },
    metadata: { title: deriveTitle(markdown, path) },
  };
}

function deriveTitle(md: string, path: string): string {
  const m = /^\s*#\s+(.+?)\s*$/m.exec(md);
  if (m?.[1]) return m[1];
  return basename(path).replace(/\.(md|markdown)$/i, "");
}
