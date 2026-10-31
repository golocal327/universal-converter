import { z } from "zod";

/** Workspace settings documents (stored as JSONB in public.settings). */
export const scoringSettingsSchema = z.object({
  targetLocations: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
  hotThreshold: z.number().int().min(1).max(100).default(75),
  warmThreshold: z.number().int().min(1).max(100).default(50),
});

export const brandingSettingsSchema = z.object({
  senderName: z.string().trim().max(80).default(""),
  senderEmail: z.string().trim().max(254).default(""),
  senderPhone: z.string().trim().max(40).default(""),
  companyName: z.string().trim().max(80).default("WIRE"),
  website: z.string().trim().max(200).default(""),
});

export const aiSettingsSchema = z.object({
  provider: z.enum(["auto", "anthropic", "openai"]).default("auto"),
  model: z.string().trim().max(100).default(""),
  language: z.enum(["es", "en"]).default("es"),
});

export const automationSettingsSchema = z.object({
  webhookUrl: z.string().trim().max(500).default(""),
  enabledEvents: z.array(z.string()).default([]),
});

export type ScoringSettings = z.infer<typeof scoringSettingsSchema>;
export type BrandingSettings = z.infer<typeof brandingSettingsSchema>;
export type AiSettings = z.infer<typeof aiSettingsSchema>;
export type AutomationSettings = z.infer<typeof automationSettingsSchema>;

export type WorkspaceSettings = {
  scoring: ScoringSettings;
  branding: BrandingSettings;
  ai: AiSettings;
  automation: AutomationSettings;
};

export function parseSettings(row: { scoring?: unknown; branding?: unknown; ai?: unknown; automation?: unknown } | null): WorkspaceSettings {
  const safe = <T>(schema: z.ZodType<T>, value: unknown): T => {
    const parsed = schema.safeParse(value ?? {});
    return parsed.success ? parsed.data : schema.parse({});
  };
  return {
    scoring: safe(scoringSettingsSchema, row?.scoring),
    branding: safe(brandingSettingsSchema, row?.branding),
    ai: safe(aiSettingsSchema, row?.ai),
    automation: safe(automationSettingsSchema, row?.automation),
  };
}
