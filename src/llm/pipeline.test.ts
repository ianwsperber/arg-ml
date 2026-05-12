import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ResponseCache } from "./cache.js";
import type { CompletionRequest, CompletionResponse, LLMClient } from "./client.js";
import { runPipeline } from "./pipeline.js";

/** A minimal stub satisfying the LLMClient shape used by the pipeline. */
function stubClient(scripted: Record<string, string>): LLMClient {
  const calls: CompletionRequest[] = [];
  const client = {
    calls,
    async complete(req: CompletionRequest): Promise<CompletionResponse> {
      calls.push(req);
      // Route by the user-message tag prefix.
      let text = scripted.fallback ?? "";
      for (const [tag, body] of Object.entries(scripted)) {
        if (req.user.startsWith(tag)) {
          text = body;
          break;
        }
      }
      return { text, model: req.model, inputTokens: 100, outputTokens: 200 };
    },
  } as unknown as LLMClient;
  return client;
}

describe("runPipeline", () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "argml-pipeline-"));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("assembles head + body, parses + validates + verbatim, succeeds first try", async () => {
    const markdown = "The author argues for physicalism about the mind.";
    const scriptedHead = "<head><metadata><title>Test</title></metadata></head>";
    const scriptedBody = "<body><p>The author argues for physicalism about the mind.</p></body>";
    const client = stubClient({
      "PASS 1": scriptedHead,
      "PASS 2": scriptedBody,
    });
    const cache = new ResponseCache({ dir: join(tmp, "cache") });
    const result = await runPipeline({
      markdown,
      model: "claude-sonnet-4-6",
      style: "minimal",
      postId: "test",
      client,
      cache,
      logUsage: async () => {},
    });
    expect(result.ok).toBe(true);
    expect(result.parseDiagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
    expect(result.validationDiagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
    expect(result.verbatimDiagnostics).toHaveLength(0);
    expect(result.attempts).toBe(1);
    expect(result.xml).toContain("<post");
    expect(result.xml).toContain("physicalism about the mind");
  });

  it("uses the cache on a repeat call", async () => {
    const markdown = "The author argues for physicalism.";
    const head = "<head><metadata><title>Test</title></metadata></head>";
    const body = "<body><p>The author argues for physicalism.</p></body>";
    const calls: string[] = [];
    const client = {
      async complete(req: CompletionRequest): Promise<CompletionResponse> {
        calls.push(req.user.slice(0, 6));
        const text = req.user.startsWith("PASS 1") ? head : body;
        return { text, model: req.model, inputTokens: 10, outputTokens: 20 };
      },
    } as unknown as LLMClient;
    const cache = new ResponseCache({ dir: join(tmp, "cache") });
    const opts = {
      markdown,
      model: "claude-sonnet-4-6",
      style: "minimal" as const,
      postId: "test",
      client,
      cache,
      logUsage: async () => {},
    };
    const r1 = await runPipeline(opts);
    expect(r1.ok).toBe(true);
    expect(r1.cost.cacheHits).toBe(0);
    expect(r1.cost.cacheMisses).toBe(2);
    const r2 = await runPipeline(opts);
    expect(r2.ok).toBe(true);
    expect(r2.cost.cacheHits).toBe(2);
    expect(r2.cost.cacheMisses).toBe(0);
    expect(calls).toHaveLength(2); // second run never called the client
  });

  it("invokes the repair pass when verbatim fails, succeeds on retry", async () => {
    const markdown = "The author argues for physicalism.";
    const head = "<head><metadata><title>Test</title></metadata></head>";
    // First Pass-2 body substitutes "materialism" for "physicalism" — verbatim fails.
    const broken = "<body><p>The author argues for materialism.</p></body>";
    const fixedDoc = `<?xml version="1.0" encoding="UTF-8"?>
<post xmlns="urn:argml:v1" id="test">
${head}
<body><p>The author argues for physicalism.</p></body>
</post>`;
    let pass2Calls = 0;
    const client = {
      async complete(req: CompletionRequest): Promise<CompletionResponse> {
        let text: string;
        if (req.user.startsWith("PASS 1")) text = head;
        else if (req.user.startsWith("PASS 2")) {
          pass2Calls++;
          text = broken;
        } else if (req.user.startsWith("REPAIR")) {
          text = fixedDoc;
        } else text = "";
        return { text, model: req.model, inputTokens: 10, outputTokens: 20 };
      },
    } as unknown as LLMClient;
    const cache = new ResponseCache({ disabled: true });
    const result = await runPipeline({
      markdown,
      model: "claude-sonnet-4-6",
      style: "minimal",
      postId: "test",
      client,
      cache,
      logUsage: async () => {},
    });
    expect(pass2Calls).toBe(1);
    expect(result.attempts).toBe(2);
    expect(result.ok).toBe(true);
  });

  it("returns ok=false after exhausting retries", async () => {
    const markdown = "physicalism.";
    const head = "<head><metadata><title>Test</title></metadata></head>";
    const broken = "<body><p>materialism.</p></body>";
    const brokenDoc = `<?xml version="1.0" encoding="UTF-8"?>
<post xmlns="urn:argml:v1" id="test">${head}${broken}</post>`;
    const client = {
      async complete(req: CompletionRequest): Promise<CompletionResponse> {
        const text = req.user.startsWith("PASS 1")
          ? head
          : req.user.startsWith("PASS 2")
            ? broken
            : brokenDoc;
        return { text, model: req.model, inputTokens: 10, outputTokens: 20 };
      },
    } as unknown as LLMClient;
    const result = await runPipeline({
      markdown,
      model: "claude-sonnet-4-6",
      style: "minimal",
      postId: "test",
      client,
      cache: new ResponseCache({ disabled: true }),
      maxRetries: 2,
      logUsage: async () => {},
    });
    expect(result.ok).toBe(false);
    expect(result.verbatimDiagnostics.length).toBeGreaterThan(0);
    expect(result.attempts).toBe(3);
  });
});
