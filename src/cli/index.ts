import { Command } from "commander";
import { runDeps } from "./deps.js";
import { type GraphFormat, runGraph } from "./graph.js";
import { runOverlayShow } from "./overlay.js";
import { type PropagateFormat, runPropagate } from "./propagate.js";
import { runRender } from "./render.js";
import { runSummary } from "./summary.js";
import type { CommandResult } from "./validate.js";
import { runValidate, runValidatePair } from "./validate.js";

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
    .option("--overlay <overlay>", "validate the post together with a reader-overlay")
    .action((file: string, options: { overlay?: string }) => {
      if (options.overlay !== undefined) {
        exit(runValidatePair(file, options.overlay));
      } else {
        exit(runValidate(file));
      }
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
    .command("propagate")
    .description("Compute spec §13.5 propagation status for a post against a reader-overlay.")
    .argument("<post>", "path to .argml.xml file")
    .requiredOption("--overlay <overlay>", "path to .overlay.xml file")
    .option("--format <format>", "output format: text or json", "text")
    .option("--prefix <prefix>", "override the import prefix in the overlay that maps to the post")
    .action((postFile: string, options: { overlay: string; format: string; prefix?: string }) => {
      const format = options.format.toLowerCase();
      if (format !== "text" && format !== "json") {
        process.stderr.write(
          `argml: --format must be 'text' or 'json' (got '${options.format}')\n`,
        );
        process.exit(2);
      }
      exit(
        runPropagate(postFile, options.overlay, {
          format: format as PropagateFormat,
          ...(options.prefix !== undefined ? { prefix: options.prefix } : {}),
        }),
      );
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
