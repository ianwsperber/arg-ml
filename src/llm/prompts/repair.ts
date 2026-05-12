/**
 * Repair pass: given a previously-produced ArgML document and a list of
 * diagnostics (parse, validation, or verbatim), ask the LLM to emit a
 * corrected document. Used by the pipeline when validation or verbatim fails.
 */

export interface RepairInput {
  /** The previous (broken) ArgML document. */
  previous: string;
  /** Diagnostics to address, formatted human-readably. */
  diagnostics: string[];
  /** The original markdown source. Always included so the model can re-anchor
   * on the verbatim text. */
  markdown: string;
}

export function buildRepairUserMessage(input: RepairInput): string {
  return `REPAIR PASS — your previous output had problems. Fix them and return the corrected ArgML document.

DIAGNOSTICS TO ADDRESS:
${input.diagnostics.map((d, i) => `  ${i + 1}. ${d}`).join("\n")}

RULES:
  - Return ONE complete document: <?xml?> through </post>.
  - Preserve everything that was correct. Only change what the diagnostics call out.
  - If a verbatim diagnostic is present, the prose was edited — restore it to match the source exactly.
  - If an ARGMLnnn validation diagnostic is present, fix the structural issue without altering prose.
  - If a PARSEnnn diagnostic is present, the XML is malformed — fix the syntax.

PREVIOUS OUTPUT:
---PREVIOUS---
${input.previous}
---END PREVIOUS---

ORIGINAL MARKDOWN SOURCE (the verbatim ground truth):
---SOURCE---
${input.markdown}
---END SOURCE---`;
}
