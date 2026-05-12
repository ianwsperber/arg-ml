#!/usr/bin/env tsx
/**
 * `pnpm eval` entry point. Thin wrapper over `argml eval` so iteration on
 * the prompts feels like a script, not a CLI invocation.
 */

import { resolve } from "node:path";
import { runEvalCommand } from "../src/cli/eval.js";

const args = process.argv.slice(2);
const flags: Record<string, string | true> = {};
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a?.startsWith("--")) {
    const key = a.slice(2);
    const next = args[i + 1];
    if (next && !next.startsWith("--")) {
      flags[key] = next;
      i++;
    } else flags[key] = true;
  }
}

const result = await runEvalCommand({
  goldDir: typeof flags["gold-dir"] === "string" ? flags["gold-dir"] : resolve("eval/gold"),
  model: typeof flags.model === "string" ? flags.model : "opus",
  out: typeof flags.out === "string" ? flags.out : undefined,
  filter: typeof flags.filter === "string" ? flags.filter : undefined,
});
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(result.exitCode);
