/** Bumped whenever any prompt changes. Part of the cache key so prompt edits
 * invalidate cached outputs. */
export const PROMPT_VERSION = "2026-05-12.0";

/** Default model. Override via --model on the CLI. */
export const DEFAULT_MODEL = "claude-opus-4-7";
export const SONNET_MODEL = "claude-sonnet-4-6";
export const OPUS_MODEL = "claude-opus-4-7";

export function resolveModel(alias: string | undefined): string {
  if (!alias) return DEFAULT_MODEL;
  if (alias === "sonnet") return SONNET_MODEL;
  if (alias === "opus") return OPUS_MODEL;
  return alias;
}
