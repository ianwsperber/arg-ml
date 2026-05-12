import { writeFileSync } from "node:fs";
import { renderHTML } from "../render/html.js";
import { type LoadedDocument, loadDocument } from "./load.js";
import type { CommandResult } from "./validate.js";

export interface RenderOptions {
  output?: string;
}

export function runRender(path: string, options: RenderOptions): CommandResult {
  let loaded: LoadedDocument;
  try {
    loaded = loadDocument(path);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { stdout: "", stderr: `argml: cannot read ${path}: ${msg}\n`, exitCode: 2 };
  }
  if (!loaded.parse.document) {
    const lines = loaded.parse.diagnostics
      .map(
        (d) =>
          `${path}:${d.pos?.line ?? 1}:${d.pos?.column ?? 1}: ${d.severity} ${d.code} ${d.message}`,
      )
      .join("\n");
    return {
      stdout: "",
      stderr: `${lines}\nargml: ${path}: parse failed; cannot render\n`,
      exitCode: 1,
    };
  }

  const html = renderHTML(loaded.parse.document, { source: loaded.source });

  if (options.output) {
    try {
      writeFileSync(options.output, html, "utf8");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        stdout: "",
        stderr: `argml: cannot write ${options.output}: ${msg}\n`,
        exitCode: 2,
      };
    }
    return {
      stdout: `argml: wrote ${options.output} (${html.length} bytes)\n`,
      stderr: "",
      exitCode: 0,
    };
  }
  return { stdout: html, stderr: "", exitCode: 0 };
}
