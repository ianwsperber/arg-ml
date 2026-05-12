import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { IngestError, ingest } from "./index.js";

describe("ingest", () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "argml-ingest-"));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("reads a local markdown file and derives a title from the first H1", async () => {
    const path = join(tmp, "post.md");
    writeFileSync(path, "# Hello World\n\nthe body text.\n");
    const r = await ingest(path);
    expect(r.markdown).toContain("# Hello World");
    expect(r.source).toEqual({ kind: "file", path });
    expect(r.metadata.title).toBe("Hello World");
  });

  it("derives a title from the filename when there is no H1", async () => {
    const path = join(tmp, "my-post.md");
    writeFileSync(path, "no heading here, just prose.");
    const r = await ingest(path);
    expect(r.metadata.title).toBe("my-post");
  });

  it("refuses URL input without --allow-network", async () => {
    await expect(ingest("https://example.com/x")).rejects.toMatchObject({
      code: "INGEST_NO_NETWORK",
    });
  });

  it("rejects an empty file", async () => {
    const path = join(tmp, "empty.md");
    writeFileSync(path, "   \n  \n");
    await expect(ingest(path)).rejects.toMatchObject({ code: "INGEST_EMPTY_BODY" });
  });

  it("rejects a missing file", async () => {
    await expect(ingest(join(tmp, "nope.md"))).rejects.toMatchObject({
      code: "INGEST_NOT_FOUND",
    });
  });

  it("dispatches LessWrong URLs to the GraphQL extractor when allowed", async () => {
    const fakeFetch: typeof fetch = async (_url, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { variables: { url: string } };
      expect(body.variables.url).toBe("https://www.lesswrong.com/posts/abc/test");
      return new Response(
        JSON.stringify({
          data: {
            post: {
              result: {
                _id: "abc",
                title: "Test Post",
                slug: "test",
                contents: { markdown: "# Test Post\n\nbody." },
                user: { displayName: "Alice" },
                postedAt: "2026-01-01T00:00:00Z",
              },
            },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const r = await ingest("https://www.lesswrong.com/posts/abc/test", {
      allowNetwork: true,
      fetch: fakeFetch,
    });
    expect(r.markdown).toContain("body.");
    expect(r.metadata.title).toBe("Test Post");
    expect(r.metadata.author).toBe("Alice");
    expect(r.source).toMatchObject({ kind: "url", extractor: "lesswrong-graphql" });
  });

  it("falls back to readability when the LessWrong API errors", async () => {
    const fakeFetch: typeof fetch = async (url) => {
      const u = String(url);
      if (u.includes("graphql")) {
        return new Response("server error", { status: 500 });
      }
      return new Response(
        `<html><head><title>Fallback Title</title></head>
         <body><article><h1>Fallback Title</h1>
         <p>Fallback prose text body content here for readability.</p>
         <p>Second paragraph long enough to be picked up by readability heuristics.</p>
         </article></body></html>`,
        { status: 200, headers: { "content-type": "text/html" } },
      );
    };
    const r = await ingest("https://www.lesswrong.com/posts/abc/test", {
      allowNetwork: true,
      fetch: fakeFetch,
    });
    expect(r.source).toMatchObject({ extractor: "readability" });
    expect(r.markdown.length).toBeGreaterThan(0);
  });
});
