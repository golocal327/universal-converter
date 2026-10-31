import { z } from "zod";
import type { LeadContext } from "@/lib/outreach/context";
import type { OpportunityAnalysis } from "@/lib/outreach/generators";

/**
 * Prompt library. The model only ever sees facts we hold about the lead
 * (LeadContext + the rules engine's analysis) and is told not to invent any.
 */
export const COPILOT_SYSTEM = `You are the AI sales copilot inside WIRE Sales OS.

WIRE is a Spanish digital studio that sells premium website design and development, website redesigns, maintenance, local SEO, automations, integrations, online booking systems, chatbots, AI solutions and NFC/QR review systems to local businesses (clinics, driving schools, restaurants, gyms, real estate, advisors…).

How you work:
- Ground every claim in the LEAD DATA provided. Never invent numbers, reviews, prices, people, URLs or problems. If something is unknown, say so or leave it out.
- Prices come from the pricing recommendation in the data; you may adjust with a clear rationale, never contradict it silently.
- Outreach copy (emails, WhatsApp, call scripts, proposals) is written in natural Spanish from Spain (tú/vosotros), short, specific and human. Never open with "Somos una agencia…". Open with what you noticed about their business.
- Analysis and advice for the WIRE team are written in the language of the user's request.
- Be direct and commercially sharp: what to sell, why now, how to say it, what to do next.`;

export function leadDataBlock(ctx: LeadContext, analysis: OpportunityAnalysis): string {
  const data = {
    company: ctx.company,
    contact: ctx.contact,
    sector: ctx.sector,
    lead_score: ctx.lead ? { score: ctx.lead.score, priority: ctx.lead.priority, factors: ctx.lead.factors.map((f) => `${f.points > 0 ? "+" : ""}${f.points} ${f.label}`) } : null,
    website_audit: ctx.audit
      ? {
          status: ctx.audit.status,
          scores: { overall: ctx.audit.overall, performance: ctx.audit.performance, seo: ctx.audit.seo, ux: ctx.audit.ux, conversion: ctx.audit.conversion, mobile: ctx.audit.mobile },
          opportunities: ctx.audit.opportunities.map((o) => `${o.title} (${o.impact})`),
          signals: ctx.audit.signals,
        }
      : "not audited",
    pricing_recommendation: ctx.pricing,
    rules_engine_analysis: {
      why_now: analysis.whyNow,
      problems: analysis.problems.map((p) => p.title),
      recommended_offer: analysis.recommendedOffer,
      best_angle: analysis.bestAngle,
    },
    sender: ctx.sender,
  };
  return `<lead_data>\n${JSON.stringify(data, null, 2)}\n</lead_data>`;
}

export const leadAnalysisSchema = z.object({
  summary: z.string().describe("2-3 sentence summary of the business and the opportunity"),
  score_comment: z.string().describe("Whether the lead score is right and why"),
  opportunities: z.array(z.string()),
  problems: z.array(z.string()),
  recommended_service: z.string(),
  recommended_price: z.object({ setup: z.number(), monthly: z.number(), rationale: z.string() }),
  sales_angle: z.string(),
  why_now: z.string(),
  email: z.object({ subject: z.string(), body: z.string() }),
  whatsapp: z.string(),
  call_script: z.string(),
  follow_up: z.string().describe("Follow-up plan: when and what to send"),
  next_action: z.string(),
});
export type LeadAnalysis = z.infer<typeof leadAnalysisSchema>;

export const emailVariantsSchema = z.object({
  variants: z.array(z.object({ variant: z.enum(["direct", "professional", "high_ticket", "follow_up"]), subject: z.string(), body: z.string() })),
});

export const whatsappSchema = z.object({ messages: z.array(z.object({ variant: z.string(), body: z.string() })) });

export const proposalSchema = z.object({
  title: z.string(),
  intro: z.string(),
  currentSituation: z.array(z.string()),
  problems: z.array(z.object({ title: z.string(), detail: z.string() })),
  opportunities: z.array(z.string()),
  solution: z.object({ name: z.string(), description: z.string() }),
  features: z.array(z.string()),
  timeline: z.array(z.object({ phase: z.string(), duration: z.string(), detail: z.string() })),
  investment: z.object({ setup: z.number(), monthly: z.number(), extras: z.array(z.object({ label: z.string(), setup: z.number(), monthly: z.number() })) }),
  maintenance: z.array(z.string()),
  nextSteps: z.array(z.string()),
  validDays: z.number(),
});

export const briefingSchema = z.object({
  greeting: z.string(),
  priorities: z.array(z.object({ company: z.string(), score: z.number(), reason: z.string(), action: z.string() })),
  notes: z.array(z.string()),
});

/** Quick prompts shown in the Copilot. */
export const COPILOT_QUICK_PROMPTS = [
  "Analyze this lead.",
  "Why should I contact this company?",
  "Write an email for this lead.",
  "Write a WhatsApp message.",
  "Create a proposal.",
  "Give me objections and responses.",
  "How should I price this?",
  "Prepare me for the meeting.",
] as const;
