import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgML, renderHTML, validate } from "../src/index.js";

const here = fileURLToPath(new URL(".", import.meta.url));
const root = resolve(here, "..");
const examplesDir = join(root, "examples");
const outDir = join(examplesDir, "rendered");

function main(): void {
  mkdirSync(outDir, { recursive: true });
  const files = readdirSync(examplesDir).filter((f) => f.endsWith(".argml.xml"));
  if (files.length === 0) {
    process.stdout.write("render-examples: no .argml.xml files in examples/\n");
    return;
  }

  let parseFailures = 0;
  for (const file of files.sort()) {
    const inPath = join(examplesDir, file);
    const source = readFileSync(inPath, "utf8");
    const result = parseArgML(source);
    if (!result.document) {
      process.stderr.write(`✗ ${file}: parse failed (${result.diagnostics.length} diagnostics)\n`);
      parseFailures += 1;
      continue;
    }
    const validateDiags = validate(result.document);
    const errors = validateDiags.filter((d) => d.severity === "error").length;
    const warnings = validateDiags.filter((d) => d.severity === "warning").length;
    const html = renderHTML(result.document, { source });
    const outName = `${basename(file, ".argml.xml")}.html`;
    const outPath = join(outDir, outName);
    writeFileSync(outPath, html, "utf8");
    process.stdout.write(
      `✓ ${file} → ${outName} (${html.length} bytes, ${errors} errors, ${warnings} warnings)\n`,
    );
  }

  if (parseFailures > 0) process.exit(1);
}

main();
