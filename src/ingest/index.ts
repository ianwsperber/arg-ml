/**
 * Top-level ingest dispatcher. Decides file vs URL, routes to a host-specific
 * extractor when one exists, falls back to readability for unknown hosts.
 */

import { ingestFile } from "./file.js";
import { ingestLessWrong } from "./lesswrong.js";
import { ingestReadability } from "./readability.js";
import type { IngestOptions, IngestResult } from "./types.js";
import { IngestError } from "./types.js";

const URL_PATTERN = /^https?:\/\//i;
const LW_HOST_PATTERN = /(^|\.)lesswrong\.com$/i;

export async function ingest(input: string, options: IngestOptions = {}): Promise<IngestResult> {
  if (URL_PATTERN.test(input)) {
    if (!options.allowNetwork) {
      throw new IngestError(
        `URL ingestion requires --allow-network: ${input}`,
        "INGEST_NO_NETWORK",
      );
    }
    return ingestUrl(input, options);
  }
  return ingestFile(input);
}

async function ingestUrl(url: string, options: IngestOptions): Promise<IngestResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new IngestError(`malformed URL: ${url}`, "INGEST_BAD_URL");
  }
  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (LW_HOST_PATTERN.test(parsed.host)) {
    try {
      return await ingestLessWrong(url, fetchImpl);
    } catch (e) {
      // If LW's API breaks, fall through to readability so the CLI still
      // makes a best-effort. Surface this in the source.extractor so the
      // caller can log the fallback.
      if (e instanceof IngestError && e.code === "INGEST_LESSWRONG_API") {
        return ingestReadability(url, fetchImpl);
      }
      throw e;
    }
  }
  return ingestReadability(url, fetchImpl);
}

export type { IngestResult, IngestSource, IngestMetadata, IngestOptions } from "./types.js";
export { IngestError } from "./types.js";
