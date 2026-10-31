import "server-only";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type { z } from "zod";
import type { AIObjectResult, AIProvider, AIRequest, AIResult } from "./types";

/** Configurable with OPENAI_MODEL; the default can be changed without code changes. */
export const OPENAI_DEFAULT_MODEL = "gpt-5";

export class OpenAIProvider implements AIProvider {
  readonly id = "openai" as const;
  private client: OpenAI;

  constructor(apiKey: string, readonly model: string = OPENAI_DEFAULT_MODEL) {
    this.client = new OpenAI({ apiKey, timeout: 120_000, maxRetries: 2 });
  }

  private messages(request: AIRequest) {
    return [{ role: "system" as const, content: request.system }, ...request.messages.map((m) => ({ role: m.role, content: m.content }))];
  }

  async generateText(request: AIRequest): Promise<AIResult> {
    const res = await this.client.chat.completions.create({
      model: this.model,
      messages: this.messages(request),
      max_completion_tokens: request.maxTokens ?? 8000,
    });
    return {
      text: res.choices[0]?.message?.content?.trim() ?? "",
      provider: this.id,
      model: res.model,
      inputTokens: res.usage?.prompt_tokens ?? null,
      outputTokens: res.usage?.completion_tokens ?? null,
    };
  }

  async generateObject<T>(request: AIRequest, schema: z.ZodType<T>, name: string): Promise<AIObjectResult<T>> {
    const res = await this.client.chat.completions.parse({
      model: this.model,
      messages: this.messages(request),
      max_completion_tokens: request.maxTokens ?? 8000,
      response_format: zodResponseFormat(schema as never, name),
    });
    const message = res.choices[0]?.message;
    if (message?.refusal) throw new Error(`The AI model declined: ${message.refusal}`);
    if (!message?.parsed) throw new Error("The AI response did not match the expected format");
    return {
      object: message.parsed as T,
      text: message.content ?? "",
      provider: this.id,
      model: res.model,
      inputTokens: res.usage?.prompt_tokens ?? null,
      outputTokens: res.usage?.completion_tokens ?? null,
    };
  }
}
