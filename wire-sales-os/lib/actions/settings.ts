"use server";
import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActor } from "@/lib/auth/actor";
import { SERVICE_CATEGORIES, VALUE_TIERS } from "@/lib/domain/constants";
import { EVENT_TYPES } from "@/lib/events/types";
import { signPayload } from "@/lib/events/sign";
import { slugify } from "@/lib/lead-pipeline/normalize";
import { aiSettingsSchema, automationSettingsSchema, brandingSettingsSchema, scoringSettingsSchema } from "@/lib/settings/schema";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { rescoreCompanies } from "@/lib/services/scoring";
import { fail, ok, type ActionResult } from "@/lib/services/types";

const uuid = z.string().uuid();

async function requireAdmin() {
  const actor = await getActor();
  if (!actor.isAdmin) throw new Error("Only workspace owners and admins can change settings");
  return actor;
}

function guard<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  return fn().catch((e: Error) => fail(e.message));
}

const workspaceSchema = z.object({ name: z.string().trim().min(1).max(120), branding: brandingSettingsSchema });

export async function updateWorkspaceSettings(input: z.input<typeof workspaceSchema>) {
  return guard(async () => {
    const parsed = workspaceSchema.safeParse(input);
    if (!parsed.success) return fail("Invalid settings");
    const actor = await requireAdmin();
    await actor.db.from("workspaces").update({ name: parsed.data.name }).eq("id", actor.workspaceId);
    await actor.db.from("settings").update({ branding: parsed.data.branding as Json }).eq("workspace_id", actor.workspaceId);
    revalidatePath("/", "layout");
    return ok(undefined);
  });
}

const sectorSchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(1).max(80),
  value_tier: z.enum(VALUE_TIERS),
  avg_ticket: z.number().min(0).max(1_000_000).nullable().optional(),
  booking_relevant: z.boolean(),
  whatsapp_relevant: z.boolean(),
  score_weights: z.object({ website: z.number().min(0).max(3), google: z.number().min(0).max(3), social: z.number().min(0).max(3), business: z.number().min(0).max(3) }),
  setup_price_min: z.number().min(0).max(1_000_000).nullable().optional(),
  setup_price_max: z.number().min(0).max(1_000_000).nullable().optional(),
  monthly_price: z.number().min(0).max(100_000).nullable().optional(),
  common_problems: z.array(z.string().trim().min(1).max(300)).max(20),
  sales_arguments: z.array(z.string().trim().min(1).max(300)).max(20),
  keywords: z.array(z.string().trim().min(1).max(60)).max(20),
  service_ids: z.array(uuid).max(20),
});
export type SectorInput = z.input<typeof sectorSchema>;

export async function saveSector(input: SectorInput) {
  return guard(async () => {
    const parsed = sectorSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid sector");
    const actor = await requireAdmin();
    const { id, service_ids, ...s } = parsed.data;
    const row = { ...s, slug: slugify(s.name), score_weights: s.score_weights as Json };
    const res = id
      ? await actor.db.from("sectors").update(row).eq("id", id).eq("workspace_id", actor.workspaceId).select("id").single()
      : await actor.db.from("sectors").insert({ ...row, workspace_id: actor.workspaceId }).select("id").single();
    if (res.error || !res.data) return fail(res.error?.message ?? "Could not save sector");
    await actor.db.from("sector_services").delete().eq("sector_id", res.data.id);
    if (service_ids.length) await actor.db.from("sector_services").insert(service_ids.map((sid) => ({ workspace_id: actor.workspaceId, sector_id: res.data.id, service_id: sid })));
    revalidatePath("/settings");
    return ok({ id: res.data.id });
  });
}

export async function deleteSector(id: string) {
  return guard(async () => {
    if (!uuid.safeParse(id).success) return fail("Invalid sector");
    const actor = await requireAdmin();
    const { error } = await actor.db.from("sectors").delete().eq("id", id).eq("workspace_id", actor.workspaceId);
    if (error) return fail(error.message);
    revalidatePath("/settings");
    return ok(undefined);
  });
}

const serviceSchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(1).max(80),
  category: z.enum(SERVICE_CATEGORIES),
  description: z.string().max(500).nullable().optional(),
  setup_price: z.number().min(0).max(1_000_000),
  monthly_price: z.number().min(0).max(100_000),
  is_active: z.boolean(),
});

export async function saveService(input: z.input<typeof serviceSchema>) {
  return guard(async () => {
    const parsed = serviceSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid service");
    const actor = await requireAdmin();
    const { id, ...s } = parsed.data;
    const res = id
      ? await actor.db.from("services").update(s).eq("id", id).eq("workspace_id", actor.workspaceId).select("id").single()
      : await actor.db.from("services").insert({ ...s, slug: slugify(s.name), workspace_id: actor.workspaceId }).select("id").single();
    if (res.error || !res.data) return fail(res.error?.message ?? "Could not save service");
    revalidatePath("/settings");
    return ok({ id: res.data.id });
  });
}

const ruleSchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(1).max(120),
  priority: z.number().int().min(0).max(10_000),
  conditions: z.object({
    business_potential: z.array(z.enum(["high", "medium", "low"])).optional(),
    website_quality: z.array(z.enum(["none", "low", "medium", "high"])).optional(),
    sector_tier: z.array(z.enum(VALUE_TIERS)).optional(),
  }),
  package_name: z.string().trim().min(1).max(120),
  service_id: uuid.nullable().optional(),
  setup_price: z.number().min(0).max(1_000_000),
  monthly_price: z.number().min(0).max(100_000),
  is_active: z.boolean(),
});
export type PricingRuleInput = z.input<typeof ruleSchema>;

export async function savePricingRule(input: PricingRuleInput) {
  return guard(async () => {
    const parsed = ruleSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid rule");
    const actor = await requireAdmin();
    const { id, ...r } = parsed.data;
    const row = { ...r, conditions: r.conditions as Json, service_id: r.service_id ?? null };
    const res = id
      ? await actor.db.from("pricing_rules").update(row).eq("id", id).eq("workspace_id", actor.workspaceId).select("id").single()
      : await actor.db.from("pricing_rules").insert({ ...row, workspace_id: actor.workspaceId }).select("id").single();
    if (res.error || !res.data) return fail(res.error?.message ?? "Could not save rule");
    revalidatePath("/settings");
    return ok({ id: res.data.id });
  });
}

export async function deletePricingRule(id: string) {
  return guard(async () => {
    if (!uuid.safeParse(id).success) return fail("Invalid rule");
    const actor = await requireAdmin();
    await actor.db.from("pricing_rules").delete().eq("id", id).eq("workspace_id", actor.workspaceId);
    revalidatePath("/settings");
    return ok(undefined);
  });
}

export async function updateScoringSettings(input: z.input<typeof scoringSettingsSchema>) {
  return guard(async () => {
    const parsed = scoringSettingsSchema.safeParse(input);
    if (!parsed.success || parsed.data.warmThreshold >= parsed.data.hotThreshold) return fail("Warm threshold must be below the hot threshold");
    const actor = await requireAdmin();
    await actor.db.from("settings").update({ scoring: parsed.data as Json }).eq("workspace_id", actor.workspaceId);
    revalidatePath("/settings");
    return ok(undefined);
  });
}

/** Recompute every lead's score (after changing weights, thresholds or target areas). */
export async function rescoreAllLeads() {
  return guard(async () => {
    const actor = await requireAdmin();
    const ids: string[] = [];
    for (let from = 0; ; from += 1000) {
      const { data } = await actor.db.from("leads").select("company_id").eq("workspace_id", actor.workspaceId).range(from, from + 999);
      ids.push(...(data ?? []).map((d) => d.company_id));
      if (!data || data.length < 1000) break;
    }
    await rescoreCompanies(actor, ids, { silent: true });
    revalidatePath("/", "layout");
    return ok({ count: ids.length });
  });
}

export async function updateAISettings(input: z.input<typeof aiSettingsSchema>) {
  return guard(async () => {
    const parsed = aiSettingsSchema.safeParse(input);
    if (!parsed.success) return fail("Invalid AI settings");
    const actor = await requireAdmin();
    await actor.db.from("settings").update({ ai: parsed.data as Json }).eq("workspace_id", actor.workspaceId);
    revalidatePath("/settings");
    return ok(undefined);
  });
}

export async function updateAutomationSettings(input: z.input<typeof automationSettingsSchema>) {
  return guard(async () => {
    const parsed = automationSettingsSchema.safeParse(input);
    if (!parsed.success) return fail("Invalid automation settings");
    if (parsed.data.webhookUrl && !/^https:\/\/[^\s]+$/.test(parsed.data.webhookUrl)) return fail("The webhook URL must start with https://");
    if (parsed.data.enabledEvents.some((e) => !(EVENT_TYPES as readonly string[]).includes(e))) return fail("Unknown event type");
    const actor = await requireAdmin();
    await actor.db.from("settings").update({ automation: parsed.data as Json }).eq("workspace_id", actor.workspaceId);
    revalidatePath("/settings");
    return ok(undefined);
  });
}

/** Generate a new webhook signing secret. Returned once; stored server-side only. */
export async function rotateWebhookSecret() {
  return guard(async () => {
    const actor = await requireAdmin();
    if (!isAdminConfigured()) return fail("SUPABASE_SERVICE_ROLE_KEY is required to store secrets");
    const secret = `whsec_${randomBytes(24).toString("base64url")}`;
    const { error } = await createAdminClient().from("workspace_secrets").upsert({ workspace_id: actor.workspaceId, webhook_secret: secret });
    if (error) return fail(error.message);
    return ok({ secret });
  });
}

export async function sendTestWebhook() {
  return guard(async () => {
    const actor = await requireAdmin();
    const { data } = await actor.db.from("settings").select("automation").eq("workspace_id", actor.workspaceId).single();
    const url = automationSettingsSchema.parse(data?.automation ?? {}).webhookUrl;
    if (!url) return fail("Set a webhook URL first");
    const secret = isAdminConfigured()
      ? (await createAdminClient().from("workspace_secrets").select("webhook_secret").eq("workspace_id", actor.workspaceId).maybeSingle()).data?.webhook_secret
      : null;
    const body = JSON.stringify({ id: crypto.randomUUID(), type: "ping", created_at: new Date().toISOString(), workspace_id: actor.workspaceId, data: { message: "WIRE Sales OS test event" } });
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Wire-Event": "ping", ...(secret ? { "X-Wire-Signature": signPayload(secret, body) } : {}) },
        body,
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      return res.ok ? ok({ status: res.status }) : fail(`Webhook answered HTTP ${res.status}`);
    } catch (e) {
      return fail(`Webhook unreachable: ${(e as Error).message}`);
    }
  });
}

export async function createApiKey(name: string) {
  return guard(async () => {
    const parsed = z.string().trim().min(1).max(80).safeParse(name);
    if (!parsed.success) return fail("Name the key");
    const actor = await requireAdmin();
    const key = `wire_${randomBytes(24).toString("base64url")}`;
    const { error } = await actor.db.from("api_keys").insert({
      workspace_id: actor.workspaceId, name: parsed.data, prefix: key.slice(0, 12), key_hash: createHash("sha256").update(key).digest("hex"), created_by: actor.userId,
    });
    if (error) return fail(error.message);
    revalidatePath("/settings");
    return ok({ key });
  });
}

export async function revokeApiKey(id: string) {
  return guard(async () => {
    if (!uuid.safeParse(id).success) return fail("Invalid key");
    const actor = await requireAdmin();
    await actor.db.from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", id).eq("workspace_id", actor.workspaceId);
    revalidatePath("/settings");
    return ok(undefined);
  });
}
