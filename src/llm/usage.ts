/**
 * Per-call usage log. Appends a JSON line to ~/.argml/usage.jsonl for cost
 * tracking and post-hoc analysis. Cost is estimated from a small price table;
 * the table can drift but the recorded token counts are authoritative.
 */

import { appendFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

interface PriceEntry {
  inputPerMillion: number;
  outputPerMillion: number;
}

// USD per million tokens. Update when pricing changes.
const PRICES: Record<string, PriceEntry> = {
  "claude-opus-4-7": { inputPerMillion: 15.0, outputPerMillion: 75.0 },
  "claude-sonnet-4-6": { inputPerMillion: 3.0, outputPerMillion: 15.0 },
  "claude-haiku-4-5": { inputPerMillion: 1.0, outputPerMillion: 5.0 },
};

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const price = PRICES[model] ?? findByPrefix(model);
  if (!price) return 0;
  return (
    (inputTokens / 1_000_000) * price.inputPerMillion +
    (outputTokens / 1_000_000) * price.outputPerMillion
  );
}

function findByPrefix(model: string): PriceEntry | undefined {
  for (const key of Object.keys(PRICES)) {
    if (model.startsWith(key)) return PRICES[key];
  }
  return undefined;
}

export interface UsageEntry {
  timestamp: string;
  model: string;
  step: string;
  inputTokens: number;
  outputTokens: number;
  cachedHit: boolean;
  costUsd: number;
  postId?: string;
}

const DEFAULT_PATH = join(homedir(), ".argml", "usage.jsonl");

export async function logUsage(entry: UsageEntry, path: string = DEFAULT_PATH): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(entry)}\n`, "utf8");
}
