import "server-only";
import type { z } from "zod";
import { getAIProvider, type AIObjectResult, type AIProvider, type AIRequest, type AIResult } from "@/lib/ai";
import type { Json } from "@/lib/supabase/database.types";
import { loadSettings } from "./settings";
import type { Actor } from "./types";

export type AIRunOptions = { kind: string; companyId?: string | null; leadId?: string | null };
type Logged<R> = R & { generationId: string | null };

async function providerFor(actor: Actor): Promise<AIProvider> {
  const settings = await loadSettings(actor.db, actor.workspaceId);
  return getAIProvider(settings.ai.provider, settings.ai.model || undefined);
}

/** Log every generation (prompt, model, response, tokens, latency, lead) to ai_generations. */
async function logged<R extends AIResult>(
  actor: Actor,
  options: AIRunOptions,
  request: AIRequest,
  schemaName: string | null,
  provider: AIProvider,
  run: () => Promise<R>,
  serialize: (r: R) => string,
): Promise<Logged<R>> {
  const started = Date.now();
  const base = {
    workspace_id: actor.workspaceId,
    user_id: actor.userId,
    company_id: options.companyId ?? null,
    lead_id: options.leadId ?? null,
    kind: options.kind,
    prompt: { system: request.system, messages: request.messages, effort: request.effort ?? null, schema: schemaName } as unknown as Json,
  };
  try {
    const result = await run();
    const { data } = await actor.db
      .from("ai_generations")
      .insert({ ...base, provider: result.provider, model: result.model, response: serialize(result), input_tokens: result.inputTokens, output_tokens: result.outputTokens, latency_ms: Date.now() - started, status: "success" })
      .select("id")
      .single();
    return { ...result, generationId: data?.id ?? null };
  } catch (error) {
    await actor.db.from("ai_generations").insert({
      ...base, provider: provider.id, model: provider.model, latency_ms: Date.now() - started, status: "error", error: String((error as Error).message ?? error).slice(0, 1000),
    });
    throw error;
  }
}

export async function runAIText(actor: Actor, options: AIRunOptions, request: AIRequest): Promise<Logged<AIResult>> {
  const provider = await providerFor(actor);
  return logged(actor, options, request, null, provider, () => provider.generateText(request), (r) => r.text);
}

export async function runAIObject<T>(actor: Actor, options: AIRunOptions, request: AIRequest, schema: z.ZodType<T>, schemaName: string): Promise<Logged<AIObjectResult<T>>> {
  const provider = await providerFor(actor);
  return logged(actor, options, request, schemaName, provider, () => provider.generateObject(request, schema, schemaName), (r) => JSON.stringify(r.object));
}
