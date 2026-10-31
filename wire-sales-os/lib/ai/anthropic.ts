import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { AIRefusalError, type AIObjectResult, type AIProvider, type AIRequest, type AIResult } from "./types";

export const ANTHROPIC_DEFAULT_MODEL = "claude-opus-5-5";
// Server-side fallback: if a safety classifier declines, the API re-runs the
// request on Anthropic's recommended fallback model inside the same call.
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export class AnthropicProvider implements AIProvider {
  readonly id = "anthropic" as const;
  private client: Anthropic;

  constructor(apiKey: string, readonly model: string = ANTHROPIC_DEFAULT_MODEL) {
    this.client = new Anthropic({ apiKey, timeout: 120_000, maxRetries: 2 });
  }

  private params(request: AIRequest) {
    return {
      model: this.model,
      max_tokens: request.maxTokens ?? 8000,
      system: request.system,
      messages: request.messages,
      // Thinking is adaptive by default on current models; effort sets the depth.
      output_config: { effort: request.effort ?? "medium" },
      betas: [FALLBACK_BETA],
      fallbacks: "default" as const,
    };
  }

  async generateText(request: AIRequest): Promise<AIResult> {
    const response = await this.client.beta.messages.create(this.params(request));
    if (response.stop_reason === "refusal") throw new AIRefusalError(response.stop_details?.category ?? null);
    const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
    return { text, provider: this.id, model: response.model, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens };
  }

  async generateObject<T>(request: AIRequest, schema: z.ZodType<T>): Promise<AIObjectResult<T>> {
    const base = this.params(request);
    const response = await this.client.beta.messages.parse({
      ...base,
      output_config: { ...base.output_config, format: betaZodOutputFormat(schema) },
    });
    if (response.stop_reason === "refusal") throw new AIRefusalError(response.stop_details?.category ?? null);
    if (!response.parsed_output) throw new Error("The AI response did not match the expected format");
    const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n");
    return {
      object: response.parsed_output as T,
      text,
      provider: this.id,
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  }
}
