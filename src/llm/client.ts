/**
 * Anthropic SDK wrapper with retry/backoff. Implements only what the
 * conversion pipeline uses: a single completion call with a system prompt and
 * one user message.
 */

import Anthropic from "@anthropic-ai/sdk";

export interface CompletionRequest {
  model: string;
  system: string;
  user: string;
  /** Maximum output tokens. Conversion outputs can be long; default 8192. */
  maxTokens?: number;
  /** Sampling temperature. Default 0.2 for stability. */
  temperature?: number;
}

export interface CompletionResponse {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface ClientOptions {
  apiKey?: string;
  /** Inject a custom SDK instance — primarily for tests. */
  client?: Anthropic;
  /** Max retry attempts on transient errors. Default 3. */
  maxRetries?: number;
}

export class LLMClient {
  private readonly client: Anthropic;
  private readonly maxRetries: number;

  constructor(opts: ClientOptions = {}) {
    if (opts.client) {
      this.client = opts.client;
    } else {
      const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error(
          "ANTHROPIC_API_KEY is not set. Export the env var or pass apiKey explicitly.",
        );
      }
      this.client = new Anthropic({ apiKey });
    }
    this.maxRetries = opts.maxRetries ?? 3;
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const params = {
      model: req.model,
      max_tokens: req.maxTokens ?? 8192,
      temperature: req.temperature ?? 0.2,
      system: req.system,
      messages: [{ role: "user" as const, content: req.user }],
    };
    let attempt = 0;
    let lastError: unknown;
    while (attempt <= this.maxRetries) {
      try {
        const response = await this.client.messages.create(params);
        const text = response.content
          .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("");
        return {
          text,
          model: response.model,
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        };
      } catch (e) {
        lastError = e;
        if (!isRetryable(e) || attempt === this.maxRetries) break;
        const delayMs = 500 * 2 ** attempt + Math.random() * 250;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        attempt++;
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }
}

function isRetryable(e: unknown): boolean {
  if (e instanceof Anthropic.APIError) {
    return e.status === 429 || (typeof e.status === "number" && e.status >= 500);
  }
  return false;
}
