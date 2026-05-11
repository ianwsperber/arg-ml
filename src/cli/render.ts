import type { CommandResult } from "./validate.js";

export interface RenderOptions {
  output?: string;
}

export function runRender(_path: string, _options: RenderOptions): CommandResult {
  return {
    stdout: "render: not yet implemented (Phase 4)\n",
    stderr: "",
    exitCode: 0,
  };
}
