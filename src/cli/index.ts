import { Command } from "commander";
import { runConvert } from "./convert.js";
import { runDeps } from "./deps.js";
import { runEvalCommand } from "./eval.js";
import { type GraphFormat, runGraph } from "./graph.js";
import { runOverlayShow } from "./overlay.js";
import { runRender } from "./render.js";
import { runSummary } from "./summary.js";
import type { CommandResult } from "./validate.js";
import { runValidate } from "./validate.js";

export function buildProgram(): Command {
  const program = new Command();
  program
    .name("argml")
    .description("Reference CLI for ArgML — validate, inspect, and export argument structure.")
    .version("0.0.0");

  program
    .command("validate")
    .description("Parse and validate an ArgML document; print diagnostics.")
    .argument("<file>", "path to .argml.xml file")
    .action((file: string) => {
      exit(runValidate(file));
    });

  program
    .command("summary")
    .description("Print a structural summary of an ArgML document.")
    .argument("<file>", "path to .argml.xml file")
    .action((file: string) => {
      exit(runSummary(file));
    });

  program
    .command("deps")
    .description("Print the transitive dependency tree for a target id.")
    .argument("<file>", "path to .argml.xml file")
    .requiredOption("--target <id>", "claim/assumption/inference id to inspect")
    .action((file: string, options: { target: string }) => {
      exit(runDeps(file, options.target));
    });

  program
    .command("graph")
    .description("Emit the argument graph as JSON or DOT.")
    .argument("<file>", "path to .argml.xml file")
    .option("--format <format>", "output format: json or dot", "json")
    .action((file: string, options: { format: string }) => {
      const format = options.format.toLowerCase();
      if (format !== "json" && format !== "dot") {
        process.stderr.write(`argml: --format must be 'json' or 'dot' (got '${options.format}')\n`);
        process.exit(2);
      }
      exit(runGraph(file, format as GraphFormat));
    });

  const overlay = program.command("overlay").description("Reader-overlay subcommands.");
  overlay
    .command("show")
    .description("Pretty-print a reader-overlay's attitudes and substitutions.")
    .argument("<file>", "path to .overlay.xml file")
    .action((file: string) => {
      exit(runOverlayShow(file));
    });

  program
    .command("render")
    .description("Render an ArgML document to a self-contained HTML page.")
    .argument("<file>", "path to .argml.xml file")
    .option("--output <html>", "output HTML file path")
    .action((file: string, options: { output?: string }) => {
      exit(runRender(file, options.output ? { output: options.output } : {}));
    });

  program
    .command("convert")
    .description("Convert a Markdown file or URL to ArgML via the LLM pipeline.")
    .argument("<file-or-url>", "path to .md file or https?:// URL")
    .option("--model <alias>", "model alias: opus|sonnet, or a literal model id", "opus")
    .option("--style <style>", "marking density: minimal|standard|aggressive", "standard")
    .option("--single-pass", "skip Pass 1; use a combined prompt (fast iteration)")
    .option("--max-retries <n>", "max repair attempts after a failed pass", (v) => Number(v), 2)
    .option("--no-cache", "bypass the ~/.argml/llm-cache response cache")
    .option("--output <path>", "output .argml.xml file")
    .option("--diff", "print a markdown-vs-ArgML side-by-side diff (TODO)")
    .option("--allow-network", "permit URL ingestion (required for http(s) inputs)")
    .action(
      async (
        input: string,
        options: {
          model?: string;
          style?: "minimal" | "standard" | "aggressive";
          singlePass?: boolean;
          maxRetries?: number;
          cache?: boolean;
          output?: string;
          diff?: boolean;
          allowNetwork?: boolean;
        },
      ) => {
        const result = await runConvert(input, {
          model: options.model,
          style: options.style,
          singlePass: options.singlePass,
          maxRetries: options.maxRetries,
          noCache: options.cache === false,
          output: options.output,
          diff: options.diff,
          allowNetwork: options.allowNetwork === true,
        });
        exit(result);
      },
    );

  program
    .command("eval")
    .description("Run the conversion pipeline against eval/gold/ and report metrics.")
    .option("--gold-dir <dir>", "directory of gold fixtures", "eval/gold")
    .option("--model <alias>", "model alias", "opus")
    .option("--out <path>", "where to write the JSON report")
    .option("--filter <glob>", "only run slugs matching this glob")
    .action(
      async (options: { goldDir?: string; model?: string; out?: string; filter?: string }) => {
        const result = await runEvalCommand({
          goldDir: options.goldDir,
          model: options.model,
          out: options.out,
          filter: options.filter,
        });
        exit(result);
      },
    );

  return program;
}

function exit(result: CommandResult): never {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(result.exitCode);
}
