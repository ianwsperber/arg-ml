/**
 * `argml convert <file-or-url>` — drive the LLM conversion pipeline and
 * write the resulting ArgML document to disk.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { ingest } from "../ingest/index.js";
import { resolveModel, runPipeline } from "../llm/index.js";
import type { CommandResult } from "./validate.js";

export interface ConvertOptions {
  model?: string | undefined;
  style?: "minimal" | "standard" | "aggressive" | undefined;
  singlePass?: boolean | undefined;
  maxRetries?: number | undefined;
  noCache?: boolean | undefined;
  output?: string | undefined;
  diff?: boolean | undefined;
  allowNetwork?: boolean | undefined;
}

export async function runConvert(
  input: string,
  options: ConvertOptions = {},
): Promise<CommandResult> {
  let ingested: Awaited<ReturnType<typeof ingest>>;
  try {
    ingested = await ingest(input, { allowNetwork: options.allowNetwork === true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { stdout: "", stderr: `argml convert: ${msg}\n`, exitCode: 2 };
  }

  const model = resolveModel(options.model);
  const postId = slugify(ingested.metadata.title ?? basename(input, ".md"));

  let result: Awaited<ReturnType<typeof runPipeline>>;
  try {
    result = await runPipeline({
      markdown: ingested.markdown,
      model,
      style: options.style ?? "standard",
      postId,
      title: ingested.metadata.title,
      author: ingested.metadata.author,
      sourceUrl: ingested.metadata.sourceUrl,
      singlePass: options.singlePass === true,
      maxRetries: options.maxRetries,
      noCache: options.noCache === true,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { stdout: "", stderr: `argml convert: LLM pipeline failed: ${msg}\n`, exitCode: 2 };
  }

  const outPath = resolve(options.output ?? `${postId}.argml.xml`);
  try {
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, result.xml, "utf8");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { stdout: "", stderr: `argml convert: write failed: ${msg}\n`, exitCode: 2 };
  }

  const summary = buildSummary(outPath, result, model);
  return {
    stdout: summary,
    stderr: "",
    exitCode: result.ok ? 0 : 1,
  };
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "post"
  );
}

function buildSummary(
  outPath: string,
  result: Awaited<ReturnType<typeof runPipeline>>,
  model: string,
): string {
  const errors =
    result.parseDiagnostics.filter((d) => d.severity === "error").length +
    result.validationDiagnostics.filter((d) => d.severity === "error").length +
    result.verbatimDiagnostics.length;
  const warnings = result.validationDiagnostics.filter((d) => d.severity === "warning").length;
  const lines: string[] = [];
  lines.push(`Wrote ${outPath}`);
  lines.push(
    `Model: ${model}  attempts: ${result.attempts}  errors: ${errors}  warnings: ${warnings}`,
  );
  lines.push(
    `Cost: $${result.cost.totalUsd.toFixed(4)}  in=${result.cost.inputTokens} out=${result.cost.outputTokens}  cache hits=${result.cost.cacheHits} misses=${result.cost.cacheMisses}`,
  );
  if (errors > 0) {
    lines.push("");
    lines.push("Unresolved diagnostics:");
    for (const d of result.parseDiagnostics) {
      if (d.severity === "error") lines.push(`  PARSE ${d.message}`);
    }
    for (const d of result.validationDiagnostics) {
      if (d.severity === "error") lines.push(`  ${d.code} ${d.message}`);
    }
    for (const d of result.verbatimDiagnostics) {
      lines.push(`  ${d.code} ${d.message}`);
    }
    lines.push("");
    lines.push(`Output written despite errors — review ${outPath} before publishing.`);
  }
  return `${lines.join("\n")}\n`;
}
