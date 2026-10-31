import type { z } from "zod";

/**
 * Provider-agnostic AI contract. Every feature (copilot, email rewrite,
 * proposals, briefing) talks to this interface, never to a vendor SDK, so
 * providers can be swapped (Anthropic, OpenAI, others) without touching callers.
 */
export type AIMessage = { role: "user" | "assistant"; content: string };

export type AIRequest = {
  system: string;
  messages: AIMessage[];
  maxTokens?: number;
  /** Reasoning depth hint; providers map it to their own controls. */
  effort?: "low" | "medium" | "high";
};

export type AIUsage = { inputTokens: number | null; outputTokens: number | null };

export type AIResult = AIUsage & { text: string; provider: string; model: string };

export type AIObjectResult<T> = AIResult & { object: T };

export interface AIProvider {
  readonly id: "anthropic" | "openai";
  readonly model: string;
  generateText(request: AIRequest): Promise<AIResult>;
  generateObject<T>(request: AIRequest, schema: z.ZodType<T>, name: string): Promise<AIObjectResult<T>>;
}

export class AINotConfiguredError extends Error {
  constructor() {
    super("No AI provider is configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.");
    this.name = "AINotConfiguredError";
  }
}

/** The model declined (safety classifiers) even after server-side fallbacks. */
export class AIRefusalError extends Error {
  constructor(public category: string | null) {
    super(`The AI model declined this request${category ? ` (${category})` : ""}.`);
    this.name = "AIRefusalError";
  }
}
