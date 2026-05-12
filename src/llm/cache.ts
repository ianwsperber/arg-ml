/**
 * Disk cache for LLM responses. Key derived from (prompt-version, model,
 * system, user). Identical re-runs return the cached output, which makes
 * eval iteration cheap.
 *
 * Layout: ~/.argml/llm-cache/<sha256-hex>.json
 *
 * Cache entries are durable across runs. Bumping PROMPT_VERSION naturally
 * invalidates all cached entries because PROMPT_VERSION participates in the
 * key.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { CompletionResponse } from "./client.js";
import { PROMPT_VERSION } from "./version.js";

export interface CacheKeyInput {
  model: string;
  system: string;
  user: string;
  /** Extra discriminator. Use when the pipeline step matters (pass1 vs pass2). */
  tag: string;
}

export interface CachedEntry extends CompletionResponse {
  cachedAt: string;
  promptVersion: string;
}

export interface CacheOptions {
  /** Override the default ~/.argml/llm-cache location. */
  dir?: string;
  /** Disable read+write. */
  disabled?: boolean;
}

const DEFAULT_DIR = join(homedir(), ".argml", "llm-cache");

export class ResponseCache {
  private readonly dir: string;
  private readonly disabled: boolean;

  constructor(opts: CacheOptions = {}) {
    this.dir = opts.dir ?? DEFAULT_DIR;
    this.disabled = opts.disabled === true;
  }

  key(input: CacheKeyInput): string {
    const h = createHash("sha256");
    h.update(PROMPT_VERSION);
    h.update("\0");
    h.update(input.tag);
    h.update("\0");
    h.update(input.model);
    h.update("\0");
    h.update(input.system);
    h.update("\0");
    h.update(input.user);
    return h.digest("hex");
  }

  async get(input: CacheKeyInput): Promise<CachedEntry | null> {
    if (this.disabled) return null;
    const path = this.pathFor(input);
    try {
      const raw = await readFile(path, "utf8");
      return JSON.parse(raw) as CachedEntry;
    } catch {
      return null;
    }
  }

  async put(input: CacheKeyInput, response: CompletionResponse): Promise<void> {
    if (this.disabled) return;
    const path = this.pathFor(input);
    await mkdir(dirname(path), { recursive: true });
    const entry: CachedEntry = {
      ...response,
      cachedAt: new Date().toISOString(),
      promptVersion: PROMPT_VERSION,
    };
    await writeFile(path, JSON.stringify(entry, null, 2), "utf8");
  }

  private pathFor(input: CacheKeyInput): string {
    return join(this.dir, `${this.key(input)}.json`);
  }
}
