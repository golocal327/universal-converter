import "server-only";
import { AnthropicProvider } from "./anthropic";
import { OpenAIProvider } from "./openai";
import { AINotConfiguredError, type AIProvider } from "./types";

export type ProviderPreference = "auto" | "anthropic" | "openai";

export function availableProviders() {
  return { anthropic: Boolean(process.env.ANTHROPIC_API_KEY), openai: Boolean(process.env.OPENAI_API_KEY) };
}

export function isAIConfigured() {
  const a = availableProviders();
  return a.anthropic || a.openai;
}

/**
 * Resolve the provider: workspace preference → AI_PROVIDER env → whichever key exists
 * (Anthropic first). Model overrides: workspace setting, then ANTHROPIC_MODEL / OPENAI_MODEL.
 */
export function getAIProvider(preference: ProviderPreference = "auto", modelOverride?: string): AIProvider {
  const available = availableProviders();
  const envPref = (process.env.AI_PROVIDER as ProviderPreference | undefined) ?? "auto";
  const pref = preference !== "auto" ? preference : envPref;
  const pick = pref === "openai" && available.openai ? "openai" : pref === "anthropic" && available.anthropic ? "anthropic" : available.anthropic ? "anthropic" : available.openai ? "openai" : null;
  if (pick === "anthropic") return new AnthropicProvider(process.env.ANTHROPIC_API_KEY as string, modelOverride || process.env.ANTHROPIC_MODEL || undefined);
  if (pick === "openai") return new OpenAIProvider(process.env.OPENAI_API_KEY as string, modelOverride || process.env.OPENAI_MODEL || undefined);
  throw new AINotConfiguredError();
}

export * from "./types";
