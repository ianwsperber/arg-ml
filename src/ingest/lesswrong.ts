/**
 * LessWrong post ingestion via the public LW2 GraphQL endpoint.
 *
 * LessWrong stores posts as markdown internally and exposes them via a
 * GraphQL `post(input: { selector: { url: ... } })` query. Going through the
 * API instead of scraping HTML gives us:
 *   - Verbatim markdown body (footnotes, math, code fences intact).
 *   - Title, author, posted date as structured fields.
 *   - No platform chrome to filter out.
 *
 * The endpoint URL and query are pinned. If LW changes the schema we fall
 * through to the readability extractor instead of silently producing broken
 * output.
 */

import type { IngestResult } from "./types.js";
import { IngestError } from "./types.js";

const ENDPOINT = "https://www.lesswrong.com/graphql";

const QUERY = `query PostByUrl($url: String!) {
  post(input: { selector: { url: $url } }) {
    result {
      _id
      title
      slug
      contents { markdown }
      user { displayName }
      postedAt
    }
  }
}`;

interface LWResponse {
  data?: {
    post?: {
      result?: {
        _id?: string;
        title?: string;
        slug?: string;
        contents?: { markdown?: string };
        user?: { displayName?: string };
        postedAt?: string;
      } | null;
    };
  };
  errors?: { message: string }[];
}

export async function ingestLessWrong(url: string, fetchImpl: typeof fetch): Promise<IngestResult> {
  const u = new URL(url);
  let res: Response;
  try {
    res = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ query: QUERY, variables: { url } }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new IngestError(`LessWrong GraphQL fetch failed: ${msg}`, "INGEST_FETCH_FAILED");
  }
  if (!res.ok) {
    throw new IngestError(`LessWrong GraphQL responded ${res.status}`, "INGEST_LESSWRONG_API");
  }
  const body = (await res.json()) as LWResponse;
  if (body.errors && body.errors.length > 0) {
    throw new IngestError(
      `LessWrong GraphQL errors: ${body.errors.map((e) => e.message).join("; ")}`,
      "INGEST_LESSWRONG_API",
    );
  }
  const post = body.data?.post?.result;
  if (!post) {
    throw new IngestError(`LessWrong post not found for ${url}`, "INGEST_NOT_FOUND");
  }
  const markdown = post.contents?.markdown ?? "";
  if (markdown.trim().length === 0) {
    throw new IngestError("LessWrong post has empty markdown body", "INGEST_EMPTY_BODY");
  }
  return {
    markdown,
    source: { kind: "url", url, host: u.host, extractor: "lesswrong-graphql" },
    metadata: {
      title: post.title,
      author: post.user?.displayName,
      postedAt: post.postedAt,
      sourceUrl: url,
    },
  };
}
