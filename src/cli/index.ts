import { Command } from "commander";
import { runDeps } from "./deps.js";
import { type GraphFormat, runGraph } from "./graph.js";
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

  program
    .command("render")
    .description("Render an ArgML document to a self-contained HTML page.")
    .argument("<file>", "path to .argml.xml file")
    .option("--output <html>", "output HTML file path")
    .action((file: string, options: { output?: string }) => {
      exit(runRender(file, options.output ? { output: options.output } : {}));
    });

  return program;
}

function exit(result: CommandResult): never {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(result.exitCode);
}
