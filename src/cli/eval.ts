/**
 * `argml eval` — run the conversion pipeline against the gold corpus,
 * write a JSON report, print a comparison table.
 */

import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { renderEvalTable, runEval } from "../eval/index.js";
import { resolveModel } from "../llm/index.js";
import type { CommandResult } from "./validate.js";

export interface EvalOptions {
  goldDir?: string | undefined;
  model?: string | undefined;
  out?: string | undefined;
  filter?: string | undefined;
}

export async function runEvalCommand(options: EvalOptions = {}): Promise<CommandResult> {
  const goldDir = resolve(options.goldDir ?? "eval/gold");
  const model = resolveModel(options.model);
  const outPath = options.out ? resolve(options.out) : resolve(`eval/results/${timestamp()}.json`);
  try {
    await mkdir(dirname(outPath), { recursive: true });
  } catch {
    /* ignore */
  }
  let report: Awaited<ReturnType<typeof runEval>>;
  try {
    report = await runEval({
      goldDir,
      model,
      outPath,
      ...(options.filter ? { filter: options.filter } : {}),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { stdout: "", stderr: `argml eval: ${msg}\n`, exitCode: 2 };
  }
  const lines: string[] = [];
  lines.push(`prompt-version: ${report.promptVersion}  model: ${report.model}`);
  lines.push(`ran-at: ${report.ranAt}`);
  lines.push("");
  lines.push(renderEvalTable(report));
  lines.push("");
  lines.push(
    `Total: $${report.totals.costUsd.toFixed(4)}  in=${report.totals.inputTokens} out=${report.totals.outputTokens}`,
  );
  lines.push(`Wrote ${outPath}`);
  const allPass = report.entries.every((e) => e.validatorPass && e.verbatimPass);
  return {
    stdout: `${lines.join("\n")}\n`,
    stderr: "",
    exitCode: allPass ? 0 : 1,
  };
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}
