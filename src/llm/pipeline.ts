/**
 * Conversion pipeline. Orchestrates ingest → Pass 1 → Pass 2 → parse →
 * validate → verbatim → repair loop, returning a final ArgML document plus
 * diagnostics, cost summary, and provenance.
 */

import { type Diagnostic, parseArgML, validate } from "../index.js";
import type { ParseDiagnostic } from "../parser/diagnostics.js";
import { type VerbatimDiagnostic, verbatimCheck } from "../verbatim/index.js";
import { ResponseCache } from "./cache.js";
import { LLMClient } from "./client.js";
import { buildPass1UserMessage } from "./prompts/pass1.js";
import { buildPass2UserMessage } from "./prompts/pass2.js";
import { buildRepairUserMessage } from "./prompts/repair.js";
import { buildSinglePassUserMessage } from "./prompts/singlepass.js";
import { SYSTEM_PROMPT } from "./prompts/system.js";
import { estimateCost, logUsage } from "./usage.js";

export interface PipelineInput {
  markdown: string;
  model: string;
  style: "minimal" | "standard" | "aggressive";
  postId: string;
  title?: string | undefined;
  author?: string | undefined;
  sourceUrl?: string | undefined;
  /** When true, skip Pass 1 and use a single prompt. */
  singlePass?: boolean | undefined;
  /** Max repair attempts after Pass 2 fails. Default 2. */
  maxRetries?: number | undefined;
  /** Disable response cache. */
  noCache?: boolean | undefined;
  /** Custom client (for tests). */
  client?: LLMClient | undefined;
  /** Custom cache (for tests). */
  cache?: ResponseCache | undefined;
  /** Custom usage logger (for tests; default writes to ~/.argml/usage.jsonl). */
  logUsage?: typeof logUsage | undefined;
}

export interface PipelineResult {
  /** The final ArgML XML string. */
  xml: string;
  parseDiagnostics: ParseDiagnostic[];
  validationDiagnostics: Diagnostic[];
  verbatimDiagnostics: VerbatimDiagnostic[];
  /** True iff parse and verbatim succeeded and validation has no errors. */
  ok: boolean;
  cost: {
    totalUsd: number;
    inputTokens: number;
    outputTokens: number;
    cacheHits: number;
    cacheMisses: number;
  };
  attempts: number;
}

export async function runPipeline(input: PipelineInput): Promise<PipelineResult> {
  const client = input.client ?? new LLMClient();
  const cache = input.cache ?? new ResponseCache({ disabled: input.noCache === true });
  const logger = input.logUsage ?? logUsage;
  const cost = { totalUsd: 0, inputTokens: 0, outputTokens: 0, cacheHits: 0, cacheMisses: 0 };

  const call = async (tag: string, user: string): Promise<string> => {
    const keyInput = { tag, model: input.model, system: SYSTEM_PROMPT, user };
    const cached = await cache.get(keyInput);
    if (cached) {
      cost.cacheHits++;
      await logger({
        timestamp: new Date().toISOString(),
        model: input.model,
        step: tag,
        inputTokens: cached.inputTokens,
        outputTokens: cached.outputTokens,
        cachedHit: true,
        costUsd: 0,
        postId: input.postId,
      });
      return cached.text;
    }
    const response = await client.complete({
      model: input.model,
      system: SYSTEM_PROMPT,
      user,
    });
    await cache.put(keyInput, response);
    const dollars = estimateCost(input.model, response.inputTokens, response.outputTokens);
    cost.cacheMisses++;
    cost.totalUsd += dollars;
    cost.inputTokens += response.inputTokens;
    cost.outputTokens += response.outputTokens;
    await logger({
      timestamp: new Date().toISOString(),
      model: input.model,
      step: tag,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      cachedHit: false,
      costUsd: dollars,
      postId: input.postId,
    });
    return response.text;
  };

  let xml: string;
  if (input.singlePass) {
    const user = buildSinglePassUserMessage({
      markdown: input.markdown,
      style: input.style,
      postId: input.postId,
      title: input.title,
      author: input.author,
      sourceUrl: input.sourceUrl,
    });
    const raw = await call("single-pass", user);
    xml = extractXml(raw);
  } else {
    const headUser = buildPass1UserMessage({
      markdown: input.markdown,
      style: input.style,
      title: input.title,
      author: input.author,
      sourceUrl: input.sourceUrl,
    });
    const rawHead = await call("pass1", headUser);
    const head = extractElement(rawHead, "head");

    const bodyUser = buildPass2UserMessage({
      markdown: input.markdown,
      head,
      style: input.style,
      postId: input.postId,
    });
    const rawBody = await call("pass2", bodyUser);
    const body = extractElement(rawBody, "body");
    xml = assembleDocument(input.postId, head, body);
  }

  let result = evaluate(xml, input.markdown);
  let attempts = 1;
  const maxRetries = input.maxRetries ?? 2;
  while (!result.ok && attempts <= maxRetries) {
    const diagnostics = formatDiagnostics(result);
    const repairUser = buildRepairUserMessage({
      previous: xml,
      diagnostics,
      markdown: input.markdown,
    });
    const repairRaw = await call(`repair-${attempts}`, repairUser);
    xml = extractXml(repairRaw);
    result = evaluate(xml, input.markdown);
    attempts++;
  }

  return {
    xml,
    parseDiagnostics: result.parseDiagnostics,
    validationDiagnostics: result.validationDiagnostics,
    verbatimDiagnostics: result.verbatimDiagnostics,
    ok: result.ok,
    cost,
    attempts,
  };
}

interface EvaluationResult {
  ok: boolean;
  parseDiagnostics: ParseDiagnostic[];
  validationDiagnostics: Diagnostic[];
  verbatimDiagnostics: VerbatimDiagnostic[];
}

function evaluate(xml: string, source: string): EvaluationResult {
  const parsed = parseArgML(xml);
  if (!parsed.document) {
    return {
      ok: false,
      parseDiagnostics: parsed.diagnostics,
      validationDiagnostics: [],
      verbatimDiagnostics: [],
    };
  }
  const validation = validate(parsed.document);
  const verbatim = verbatimCheck(source, parsed.document);
  const hasParseErrors = parsed.diagnostics.some((d) => d.severity === "error");
  const hasValidationErrors = validation.some((d) => d.severity === "error");
  return {
    ok: !hasParseErrors && !hasValidationErrors && verbatim.ok,
    parseDiagnostics: parsed.diagnostics,
    validationDiagnostics: validation,
    verbatimDiagnostics: verbatim.diagnostics,
  };
}

function formatDiagnostics(r: EvaluationResult): string[] {
  const out: string[] = [];
  for (const d of r.parseDiagnostics) {
    if (d.severity === "error") out.push(`PARSE: ${d.message}`);
  }
  for (const d of r.validationDiagnostics) {
    if (d.severity === "error") out.push(`${d.code}: ${d.message}`);
  }
  for (const d of r.verbatimDiagnostics) {
    out.push(`${d.code}: ${d.message}`);
  }
  return out;
}

/** Pull a complete <head>...</head> or <body>...</body> from the LLM's output.
 * The LLM occasionally wraps the response in code fences or adds a preamble;
 * extract the element we asked for. */
function extractElement(text: string, name: "head" | "body"): string {
  const re = new RegExp(`<${name}(?:\\s[^>]*)?>[\\s\\S]*?</${name}>`);
  const m = re.exec(text);
  if (!m) {
    throw new Error(`LLM response did not contain a <${name}>...</${name}> element`);
  }
  return m[0];
}

function extractXml(text: string): string {
  // Strip code-fence wrappers if present.
  const fenced = /```(?:xml)?\s*\n?([\s\S]*?)```/i.exec(text);
  if (fenced?.[1]) return fenced[1].trim();
  // Otherwise, take from the first XML declaration or <post> through the
  // matching </post>.
  const decl = text.indexOf("<?xml");
  const postOpen = text.indexOf("<post");
  const start = decl >= 0 ? decl : postOpen;
  if (start < 0) return text.trim();
  const endIdx = text.lastIndexOf("</post>");
  if (endIdx < 0) return text.slice(start).trim();
  return text.slice(start, endIdx + "</post>".length).trim();
}

function assembleDocument(postId: string, head: string, body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<post xmlns="urn:argml:v1" id="${postId}">
${head}
${body}
</post>
`;
}
