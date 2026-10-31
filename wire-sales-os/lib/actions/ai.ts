"use server";
import { z } from "zod";
import { AINotConfiguredError, AIRefusalError, isAIConfigured } from "@/lib/ai";
import { briefingSchema, COPILOT_SYSTEM, emailVariantsSchema, leadAnalysisSchema, leadDataBlock, whatsappSchema, type LeadAnalysis } from "@/lib/ai/prompts";
import { getActor, withinRateLimit } from "@/lib/auth/actor";
import { getCommandCenter } from "@/lib/data/command-center";
import { analyzeOpportunity } from "@/lib/outreach/generators";
import { logActivity } from "@/lib/services/activity";
import { runAIObject, runAIText } from "@/lib/services/ai";
import { emitEvent } from "@/lib/services/events";
import { buildLeadContext } from "@/lib/services/lead-context";
import { fail, ok, type ActionResult } from "@/lib/services/types";

const AI_LIMIT = 60; // generations per user per hour

function aiError(error: unknown): ActionResult<never> {
  if (error instanceof AINotConfiguredError) return fail("AI is not configured. Add ANTHROPIC_API_KEY or OPENAI_API_KEY to enable it.");
  if (error instanceof AIRefusalError) return fail(error.message);
  console.error("[ai]", error);
  return fail(`AI request failed: ${(error as Error).message}`);
}

const historySchema = z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(20_000) })).max(30);

const askSchema = z.object({
  companyId: z.string().uuid().nullable().optional(),
  prompt: z.string().trim().min(1).max(4000),
  history: historySchema.default([]),
});

export type CopilotReply =
  | { mode: "analysis"; analysis: LeadAnalysis; model: string; generationId: string | null }
  | { mode: "text"; text: string; model: string; generationId: string | null };

/** AI Copilot: free-form questions, optionally grounded in one company's data. */
export async function copilotAsk(input: z.input<typeof askSchema>): Promise<ActionResult<CopilotReply>> {
  const parsed = askSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid request");
  if (!isAIConfigured()) return fail("AI is not configured. Add ANTHROPIC_API_KEY or OPENAI_API_KEY to enable the Copilot.");
  const actor = await getActor();
  if (!(await withinRateLimit(actor, "ai", AI_LIMIT, 3600))) return fail("AI limit reached (60 requests per hour). Try again later.");

  const { companyId, prompt, history } = parsed.data;
  let system = COPILOT_SYSTEM;
  let leadId: string | null = null;
  if (companyId) {
    const ctx = await buildLeadContext(actor, companyId);
    if (!ctx) return fail("Company not found");
    leadId = ctx.lead?.id ?? null;
    system = `${COPILOT_SYSTEM}\n\nThe user is working on this lead:\n${leadDataBlock(ctx, analyzeOpportunity(ctx))}`;
  }

  try {
    const isAnalysis = Boolean(companyId) && /^analy[sz]e this lead/i.test(prompt) && history.length === 0;
    if (isAnalysis) {
      const result = await runAIObject(
        actor,
        { kind: "lead_analysis", companyId, leadId },
        { system, messages: [{ role: "user", content: "Analyze this lead completely for WIRE: summary, score assessment, opportunities, problems, recommended service and price, sales angle, why now, a first email, a WhatsApp message, a call script, a follow-up plan and the next action." }], effort: "medium", maxTokens: 12000 },
        leadAnalysisSchema,
        "lead_analysis",
      );
      if (companyId) await logActivity(actor, { type: "ai_analysis", title: "AI analysis generated", companyId, leadId, metadata: { generation_id: result.generationId } });
      return ok({ mode: "analysis", analysis: result.object, model: result.model, generationId: result.generationId });
    }
    const result = await runAIText(actor, { kind: companyId ? "copilot_lead" : "copilot", companyId, leadId }, {
      system,
      messages: [...history, { role: "user", content: prompt }],
      effort: "medium",
      maxTokens: 8000,
    });
    return ok({ mode: "text", text: result.text, model: result.model, generationId: result.generationId });
  } catch (error) {
    return aiError(error);
  }
}

const companySchema = z.string().uuid();

/** AI-written email variants (direct, professional, high-ticket, follow-up). */
export async function aiGenerateEmails(companyId: string): Promise<ActionResult<{ variants: { variant: string; subject: string; body: string }[]; generationId: string | null }>> {
  if (!companySchema.safeParse(companyId).success) return fail("Invalid company");
  if (!isAIConfigured()) return fail("AI is not configured. The rules-based emails above are generated from the same data.");
  const actor = await getActor();
  if (!(await withinRateLimit(actor, "ai", AI_LIMIT, 3600))) return fail("AI limit reached (60 requests per hour).");
  const ctx = await buildLeadContext(actor, companyId);
  if (!ctx) return fail("Company not found");
  try {
    const result = await runAIObject(
      actor,
      { kind: "email_generation", companyId, leadId: ctx.lead?.id ?? null },
      {
        system: `${COPILOT_SYSTEM}\n\n${leadDataBlock(ctx, analyzeOpportunity(ctx))}`,
        messages: [{ role: "user", content: "Write four cold emails in Spanish for this lead: variant direct (very short, 3-5 lines), professional (more corporate), high_ticket (positions a complete premium solution with the investment) and follow_up (short follow-up). Start from what you noticed about the business, use the real data, sign as the sender. No placeholders." }],
        effort: "medium",
        maxTokens: 8000,
      },
      emailVariantsSchema,
      "email_variants",
    );
    await logActivity(actor, { type: "email_generated", title: "Emails generated with AI", companyId, leadId: ctx.lead?.id ?? null, metadata: { generation_id: result.generationId } });
    await emitEvent(actor, "email.generated", { type: "company", id: companyId }, { generated_by: "ai", variants: result.object.variants.length });
    return ok({ variants: result.object.variants, generationId: result.generationId });
  } catch (error) {
    return aiError(error);
  }
}

export async function aiGenerateWhatsApp(companyId: string): Promise<ActionResult<{ messages: { variant: string; body: string }[]; generationId: string | null }>> {
  if (!companySchema.safeParse(companyId).success) return fail("Invalid company");
  if (!isAIConfigured()) return fail("AI is not configured.");
  const actor = await getActor();
  if (!(await withinRateLimit(actor, "ai", AI_LIMIT, 3600))) return fail("AI limit reached (60 requests per hour).");
  const ctx = await buildLeadContext(actor, companyId);
  if (!ctx) return fail("Company not found");
  try {
    const result = await runAIObject(
      actor,
      { kind: "whatsapp_generation", companyId, leadId: ctx.lead?.id ?? null },
      {
        system: `${COPILOT_SYSTEM}\n\n${leadDataBlock(ctx, analyzeOpportunity(ctx))}`,
        messages: [{ role: "user", content: "Write three short WhatsApp messages in Spanish (max 4 lines each): an opener, a value-first message, and a follow-up. Personal, specific to this business, ending with a simple question." }],
        effort: "low",
        maxTokens: 4000,
      },
      whatsappSchema,
      "whatsapp_messages",
    );
    await logActivity(actor, { type: "whatsapp_generated", title: "WhatsApp messages generated with AI", companyId, leadId: ctx.lead?.id ?? null });
    return ok({ messages: result.object.messages, generationId: result.generationId });
  } catch (error) {
    return aiError(error);
  }
}

/** Daily briefing rewritten by AI from the same Command Center data (never invents leads). */
export async function aiDailyBriefing(): Promise<ActionResult<{ greeting: string; priorities: { company: string; score: number; reason: string; action: string }[]; notes: string[] }>> {
  if (!isAIConfigured()) return fail("AI is not configured.");
  const actor = await getActor();
  if (!(await withinRateLimit(actor, "ai", AI_LIMIT, 3600))) return fail("AI limit reached (60 requests per hour).");
  const cc = await getCommandCenter(actor);
  try {
    const result = await runAIObject(
      actor,
      { kind: "daily_briefing" },
      {
        system: `${COPILOT_SYSTEM}\n\nToday's data:\n<command_center>\n${JSON.stringify({ attention: cc.attention, top_leads: cc.topLeads, sellable: cc.sellable, performance: cc.performance })}\n</command_center>`,
        messages: [{ role: "user", content: "Write my daily sales briefing in English: a one-line greeting, the 3-5 leads I should prioritize today (only from top_leads, with score, a concrete reason and the action), and 2-4 short notes on follow-ups, meetings, pipeline and what to improve this week based on performance." }],
        effort: "low",
        maxTokens: 4000,
      },
      briefingSchema,
      "daily_briefing",
    );
    return ok(result.object);
  } catch (error) {
    return aiError(error);
  }
}
