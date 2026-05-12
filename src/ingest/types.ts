export interface IngestSourceFile {
  kind: "file";
  path: string;
}

export interface IngestSourceURL {
  kind: "url";
  url: string;
  host: string;
  /** Which extractor produced this result. */
  extractor: "lesswrong-graphql" | "readability";
}

export type IngestSource = IngestSourceFile | IngestSourceURL;

export interface IngestMetadata {
  title?: string | undefined;
  author?: string | undefined;
  /** ISO 8601 date string when known. */
  postedAt?: string | undefined;
  /** Original-source URL — for `<metadata><source>` on the produced ArgML. */
  sourceUrl?: string | undefined;
}

export interface IngestResult {
  /** The markdown body that will become the ArgML body. Verbatim from the
   * upstream — never paraphrased or re-rendered. */
  markdown: string;
  source: IngestSource;
  metadata: IngestMetadata;
}

export interface IngestOptions {
  /** Required to enable URL ingestion. File paths do not require this flag. */
  allowNetwork?: boolean;
  /** Custom fetch (for tests). Defaults to globalThis.fetch. */
  fetch?: typeof fetch;
}

export class IngestError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "INGEST_NO_NETWORK"
      | "INGEST_NOT_FOUND"
      | "INGEST_BAD_URL"
      | "INGEST_FETCH_FAILED"
      | "INGEST_EMPTY_BODY"
      | "INGEST_LESSWRONG_API",
  ) {
    super(message);
    this.name = "IngestError";
  }
}
