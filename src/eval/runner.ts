/**
 * Eval runner. Discovers gold fixtures under <gold-dir>/<slug>/{source.md,
 * expected.argml.xml}, runs the conversion pipeline (or replays a cached
 * conversion), computes supervised + unsupervised metrics, writes a JSON
 * report.
 */

import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { type ParseResult, parseArgML, validate } from "../index.js";
import { runPipeline } from "../llm/index.js";
import { verbatimCheck } from "../verbatim/index.js";
import { headEditDistance } from "./metrics/edit-distance.js";
import { type F1Result, bodySpanF1 } from "./metrics/span-f1.js";
import {
  type ConservatismMetrics,
  type CoverageMetrics,
  type StructuralCounts,
  conservatism,
  coverage,
  structuralCounts,
} from "./metrics/unsupervised.js";

export interface GoldEntry {
  slug: string;
  sourcePath: string;
  expectedPath: string;
  source: string;
  expected: ParseResult;
}

export interface EvalEntryResult {
  slug: string;
  validatorPass: boolean;
  verbatimPass: boolean;
  headEditDistance: number;
  bodySpan: F1Result;
  conservatism: ConservatismMetrics;
  coverage: CoverageMetrics;
  counts: StructuralCounts;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  cacheHits: number;
  cacheMisses: number;
  attempts: number;
}

export interface EvalReport {
  promptVersion: string;
  model: string;
  ranAt: string;
  entries: EvalEntryResult[];
  totals: {
    costUsd: number;
    inputTokens: number;
    outputTokens: number;
  };
}

export interface RunEvalOptions {
  goldDir: string;
  model: string;
  outPath?: string | undefined;
  filter?: string | undefined;
}

export async function discoverGold(dir: string): Promise<GoldEntry[]> {
  const root = resolve(dir);
  const entries: GoldEntry[] = [];
  let names: string[];
  try {
    names = await readdir(root);
  } catch {
    return [];
  }
  for (const name of names) {
    const sub = join(root, name);
    let s: Awaited<ReturnType<typeof stat>>;
    try {
      s = await stat(sub);
    } catch {
      continue;
    }
    if (!s.isDirectory()) continue;
    const sourcePath = join(sub, "source.md");
    const expectedPath = join(sub, "expected.argml.xml");
    try {
      const source = await readFile(sourcePath, "utf8");
      const expectedRaw = await readFile(expectedPath, "utf8");
      const expected = parseArgML(expectedRaw);
      if (expected.document) {
        entries.push({ slug: name, sourcePath, expectedPath, source, expected });
      }
    } catch {
      // skip incomplete entries
    }
  }
  return entries;
}

export async function runEval(options: RunEvalOptions): Promise<EvalReport> {
  const entries = await discoverGold(options.goldDir);
  const filtered = options.filter
    ? entries.filter((e) => globMatch(e.slug, options.filter as string))
    : entries;

  const results: EvalEntryResult[] = [];
  for (const entry of filtered) {
    const goldDoc = entry.expected.document;
    if (!goldDoc) continue;
    const pipeline = await runPipeline({
      markdown: entry.source,
      model: options.model,
      style: "standard",
      postId: entry.slug,
    });
    const actualParsed = parseArgML(pipeline.xml);
    const actualDoc = actualParsed.document ?? null;
    const validatorPass =
      actualDoc !== null &&
      validate(actualDoc).every((d) => d.severity !== "error") &&
      actualParsed.diagnostics.every((d) => d.severity !== "error");
    const verbatim = actualDoc ? verbatimCheck(entry.source, actualDoc) : { ok: false };
    const editDist = actualDoc ? headEditDistance(actualDoc, goldDoc) : 1;
    const spanF1: F1Result = actualDoc
      ? bodySpanF1(actualDoc, goldDoc)
      : { precision: 0, recall: 0, f1: 0, matched: 0, predicted: 0, expected: 0 };
    results.push({
      slug: entry.slug,
      validatorPass,
      verbatimPass: verbatim.ok,
      headEditDistance: editDist,
      bodySpan: spanF1,
      conservatism: actualDoc
        ? conservatism(actualDoc, entry.source)
        : { termsPer1kWords: 0, claimsPer1kWords: 0, inferencesPer1kWords: 0 },
      coverage: actualDoc
        ? coverage(actualDoc, entry.source)
        : { claimsWithCredence: 0, inferencesWithStrength: 0, credenceSignalCoverage: 0 },
      counts: actualDoc
        ? structuralCounts(actualDoc)
        : {
            terms: 0,
            claims: 0,
            inferences: 0,
            conflicts: 0,
            assumptions: 0,
            arguments: 0,
            takeaways: 0,
          },
      costUsd: pipeline.cost.totalUsd,
      inputTokens: pipeline.cost.inputTokens,
      outputTokens: pipeline.cost.outputTokens,
      cacheHits: pipeline.cost.cacheHits,
      cacheMisses: pipeline.cost.cacheMisses,
      attempts: pipeline.attempts,
    });
  }

  const totals = results.reduce(
    (acc, r) => ({
      costUsd: acc.costUsd + r.costUsd,
      inputTokens: acc.inputTokens + r.inputTokens,
      outputTokens: acc.outputTokens + r.outputTokens,
    }),
    { costUsd: 0, inputTokens: 0, outputTokens: 0 },
  );

  const report: EvalReport = {
    promptVersion: (await import("../llm/version.js")).PROMPT_VERSION,
    model: options.model,
    ranAt: new Date().toISOString(),
    entries: results,
    totals,
  };

  if (options.outPath) {
    await writeFile(options.outPath, JSON.stringify(report, null, 2), "utf8");
  }
  return report;
}

export function renderEvalTable(report: EvalReport): string {
  const headers = [
    "slug",
    "valid",
    "verbatim",
    "head-edit",
    "span-F1",
    "P",
    "R",
    "terms/1k",
    "claims/1k",
    "cost($)",
  ];
  const rows: string[][] = [headers];
  for (const e of report.entries) {
    rows.push([
      e.slug,
      e.validatorPass ? "✓" : "✗",
      e.verbatimPass ? "✓" : "✗",
      e.headEditDistance.toFixed(3),
      e.bodySpan.f1.toFixed(3),
      e.bodySpan.precision.toFixed(3),
      e.bodySpan.recall.toFixed(3),
      e.conservatism.termsPer1kWords.toFixed(2),
      e.conservatism.claimsPer1kWords.toFixed(2),
      e.costUsd.toFixed(4),
    ]);
  }
  const widths = headers.map((_, i) => Math.max(...rows.map((r) => (r[i] ?? "").length)));
  return rows
    .map((r) => r.map((cell, i) => (cell ?? "").padEnd(widths[i] ?? 0)).join("  "))
    .join("\n");
}

function globMatch(slug: string, pattern: string): boolean {
  const re = new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`);
  return re.test(slug);
}
