import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateAny } from "../index.js";
import {
  type AnyDiagnostic,
  countSeverities,
  formatDiagnostic,
  formatSummaryLine,
} from "./format.js";
import { loadAnyDocument } from "./load.js";
import type { CommandResult } from "./validate.js";

/**
 * Resolve the path to the Python helper `apply_manifest.py`.
 *
 * The script lives at <repo-root>/skills/argml-converter/scripts/apply_manifest.py.
 * Both source layout (`src/cli/assemble.ts`) and build output layout
 * (`dist/cli/assemble.js`) are two directories below the repo root, so the
 * relative walk is the same in both cases: `../../skills/...`.
 */
function resolveScriptPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..", "..", "skills", "argml-converter", "scripts", "apply_manifest.py");
}

/**
 * Locate a usable Python interpreter on PATH. Prefer `python3`; fall back to
 * `python` (some minimal images alias the latter only). Returns `null` if
 * neither is invokable.
 */
function findPython(): string | null {
  for (const candidate of ["python3", "python"]) {
    const probe = spawnSync(candidate, ["--version"], { stdio: "ignore" });
    if (probe.status === 0) return candidate;
  }
  return null;
}

export interface AssembleOptions {
  output?: string;
  validate?: boolean;
}

export function runAssemble(
  manifestPath: string,
  markdownPath: string,
  options: AssembleOptions,
): CommandResult {
  const scriptPath = resolveScriptPath();
  if (!existsSync(scriptPath)) {
    return {
      stdout: "",
      stderr: `argml assemble: helper script not found at ${scriptPath}. Ensure the skill is installed.\n`,
      exitCode: 3,
    };
  }

  const python = findPython();
  if (python === null) {
    return {
      stdout: "",
      stderr: "argml assemble: requires python3 (>= 3.9). Install it and retry.\n",
      exitCode: 4,
    };
  }

  // If --output was given, the engine writes directly there. Otherwise we
  // route through a temp file so we can both stream the result to stdout and
  // (optionally) hand the path to the validator.
  const userOutput = options.output;
  let tmpDir: string | null = null;
  let outputPath: string;
  if (userOutput !== undefined) {
    outputPath = userOutput;
  } else {
    tmpDir = mkdtempSync(join(tmpdir(), "argml-assemble-"));
    outputPath = join(tmpDir, "out.argml.xml");
  }

  try {
    const args = [
      scriptPath,
      "--manifest",
      manifestPath,
      "--source",
      markdownPath,
      "--output",
      outputPath,
    ];
    // Inherit stderr so the engine's structured JSON error reports (and any
    // debug noise) reach the user verbatim. Capture stdout — the engine emits
    // nothing on stdout when --output is set, but we capture defensively in
    // case that changes.
    const proc = spawnSync(python, args, {
      stdio: ["ignore", "pipe", "inherit"],
      encoding: "utf8",
    });

    if (proc.error) {
      // Unexpected spawn failure (e.g., EACCES). Surface and exit.
      return {
        stdout: "",
        stderr: `argml assemble: failed to run ${python}: ${proc.error.message}\n`,
        exitCode: 3,
      };
    }

    const engineExit = proc.status ?? 3;
    if (engineExit !== 0) {
      // Mirror the engine's exit code (1 precondition, 2 postcondition, 3 IO).
      // stderr has already been streamed through inherit.
      return { stdout: proc.stdout ?? "", stderr: "", exitCode: engineExit };
    }

    // Engine succeeded. Read the output file so we can either echo it to
    // stdout (no --output) or validate it (--validate).
    let assembledXml: string;
    try {
      assembledXml = readFileSync(outputPath, "utf8");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        stdout: "",
        stderr: `argml assemble: cannot read engine output at ${outputPath}: ${msg}\n`,
        exitCode: 3,
      };
    }

    let validationOut = "";
    let validationExit = 0;
    if (options.validate === true) {
      const loaded = loadAnyDocument(outputPath);
      const parseDiags = loaded.parse.diagnostics;
      const validateDiags = loaded.parse.document ? validateAny(loaded.parse.document) : [];
      const all: AnyDiagnostic[] = [...parseDiags, ...validateDiags];
      const lines = all.map((d) => formatDiagnostic(outputPath, d));
      const { errors, warnings } = countSeverities(all);
      lines.push(formatSummaryLine(errors, warnings));
      validationOut = `${lines.join("\n")}\n`;
      validationExit = errors > 0 ? 1 : 0;
    }

    if (userOutput !== undefined) {
      // Don't echo the document to stdout when the user picked an output path.
      // Emit a short confirmation, then the validation report (if any).
      const note = `argml: wrote ${userOutput} (${assembledXml.length} bytes)\n`;
      return {
        stdout: note + validationOut,
        stderr: "",
        exitCode: validationExit,
      };
    }

    // No --output: stream the assembled document to stdout, then the
    // validation report (if requested).
    return {
      stdout: assembledXml + (validationOut ? validationOut : ""),
      stderr: "",
      exitCode: validationExit,
    };
  } finally {
    if (tmpDir !== null) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  }
}
