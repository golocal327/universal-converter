"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActor, withinRateLimit } from "@/lib/auth/actor";
import { CONTACT_STATUSES } from "@/lib/domain/constants";
import { leadFiltersSchema } from "@/lib/filters/leads";
import type { Json } from "@/lib/supabase/database.types";
import { logActivity } from "@/lib/services/activity";
import { auditCompanyWebsite } from "@/lib/services/audits";
import { emitEvent } from "@/lib/services/events";
import { ingestLeads } from "@/lib/services/ingest";
import { ensureDealForLead } from "@/lib/services/pipeline";
import { rescoreCompanies } from "@/lib/services/scoring";
import { fail, ok, type ActionResult } from "@/lib/services/types";

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal("")).transform((v) => v || undefined);

export const createLeadSchema = z.object({
  company_name: z.string().trim().min(1, "Company name is required").max(200),
  sector: optionalText(120),
  city: optionalText(120),
  province: optionalText(120),
  address: optionalText(300),
  phone: optionalText(40),
  email: optionalText(254).refine((v) => !v || z.string().email().safeParse(v).success, "Invalid email"),
  website: optionalText(500),
  instagram: optionalText(200),
  facebook: optionalText(300),
  linkedin: optionalText(300),
  google_maps_url: optionalText(1000),
  rating: z.coerce.number().min(0).max(5).optional().or(z.literal("").transform(() => undefined)),
  reviews: z.coerce.number().int().min(0).optional().or(z.literal("").transform(() => undefined)),
  employees: z.coerce.number().int().min(0).optional().or(z.literal("").transform(() => undefined)),
  description: optionalText(4000),
  contact_name: optionalText(160),
  contact_role: optionalText(120),
  contact_email: optionalText(254),
  contact_phone: optionalText(40),
  notes: optionalText(4000),
  audit_now: z.boolean().optional(),
});
export type CreateLeadInput = z.input<typeof createLeadSchema>;

export async function createLead(input: CreateLeadInput): Promise<ActionResult<{ companyId: string; audited: boolean }>> {
  const parsed = createLeadSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields", parsed.error.flatten().fieldErrors as Record<string, string[]>);
  const actor = await getActor();
  const { audit_now, ...raw } = parsed.data;
  const summary = await ingestLeads(actor, [raw], { source: "manual" });
  const row = summary.rows[0];
  if (row.status === "invalid") return fail(row.errors.join(", "));
  if (row.status === "duplicate") return fail(`Duplicate: ${row.reason.toLowerCase()} matches an existing company (${row.matchId}).`);
  if (row.status !== "created") return fail("Lead was not created");

  let audited = false;
  if (audit_now && raw.website && (await withinRateLimit(actor, "audit", 30, 3600))) {
    try {
      await auditCompanyWebsite(actor, row.companyId);
      audited = true;
    } catch (e) {
      console.error("[createLead] audit failed", e);
    }
  }
  revalidatePath("/leads");
  return ok({ companyId: row.companyId, audited });
}

const idsSchema = z.array(z.string().uuid()).min(1).max(500);

const bulkSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("rescore"), ids: idsSchema }),
  z.object({ action: z.literal("qualify"), ids: idsSchema }),
  z.object({ action: z.literal("disqualify"), ids: idsSchema, reason: z.string().trim().max(300).optional() }),
  z.object({ action: z.literal("delete"), ids: idsSchema }),
  z.object({ action: z.literal("add_to_campaign"), ids: idsSchema, campaignId: z.string().uuid() }),
  z.object({ action: z.literal("audit"), ids: idsSchema.max(10, "Audit up to 10 leads at a time") }),
  z.object({ action: z.literal("contact_status"), ids: idsSchema, value: z.enum(CONTACT_STATUSES) }),
]);
export type BulkLeadInput = z.input<typeof bulkSchema>;

/** Bulk operations from the lead table. `ids` are lead ids. */
export async function bulkLeadAction(input: BulkLeadInput): Promise<ActionResult<{ affected: number; message: string }>> {
  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid request");
  const actor = await getActor();
  const p = parsed.data;
  const { data: leads } = await actor.db.from("leads").select("id, company_id").eq("workspace_id", actor.workspaceId).in("id", p.ids);
  const rows = leads ?? [];
  if (!rows.length) return fail("No leads found");

  switch (p.action) {
    case "rescore": {
      await rescoreCompanies(actor, rows.map((r) => r.company_id), { silent: rows.length > 5 });
      break;
    }
    case "qualify": {
      for (const r of rows) await ensureDealForLead(actor, r.id, { stageKey: "qualified" });
      break;
    }
    case "disqualify": {
      await actor.db.from("leads").update({ status: "disqualified", disqualified_reason: p.reason ?? null }).in("id", rows.map((r) => r.id));
      await logActivity(actor, rows.map((r) => ({ type: "lead_disqualified" as const, title: `Lead disqualified${p.reason ? ` — ${p.reason}` : ""}`, companyId: r.company_id, leadId: r.id })));
      break;
    }
    case "delete": {
      if (!actor.isAdmin) return fail("Only admins can delete leads");
      // Deleting the company cascades to the lead, contacts, deals, tasks and timeline.
      const { error } = await actor.db.from("companies").delete().in("id", rows.map((r) => r.company_id));
      if (error) return fail(error.message);
      break;
    }
    case "add_to_campaign": {
      const { data: campaign } = await actor.db.from("campaigns").select("id, name").eq("id", p.campaignId).single();
      if (!campaign) return fail("Campaign not found");
      await actor.db.from("campaign_leads").upsert(
        rows.map((r) => ({ workspace_id: actor.workspaceId, campaign_id: campaign.id, lead_id: r.id })),
        { onConflict: "campaign_id,lead_id", ignoreDuplicates: true },
      );
      await logActivity(actor, rows.map((r) => ({ type: "campaign_added" as const, title: `Added to campaign ${campaign.name}`, companyId: r.company_id, leadId: r.id })));
      break;
    }
    case "audit": {
      if (!(await withinRateLimit(actor, "audit", 30, 3600))) return fail("Audit limit reached (30 per hour). Try again later.");
      const { data: companies } = await actor.db.from("companies").select("id, website").in("id", rows.map((r) => r.company_id)).not("website", "is", null);
      for (const c of companies ?? []) {
        try {
          await auditCompanyWebsite(actor, c.id);
        } catch (e) {
          console.error("[bulk audit]", e);
        }
      }
      revalidatePath("/leads");
      return ok({ affected: companies?.length ?? 0, message: `Audited ${companies?.length ?? 0} website(s)` });
    }
    case "contact_status": {
      await actor.db.from("leads").update({ contact_status: p.value }).in("id", rows.map((r) => r.id));
      break;
    }
  }
  revalidatePath("/leads");
  revalidatePath("/pipeline");
  const verbs: Record<string, string> = {
    rescore: "Rescored", qualify: "Moved to pipeline", disqualify: "Disqualified", delete: "Deleted", add_to_campaign: "Added to campaign", contact_status: "Updated",
  };
  return ok({ affected: rows.length, message: `${verbs[p.action]} ${rows.length} lead(s)` });
}

const updateLeadSchema = z.object({
  leadId: z.string().uuid(),
  status: z.enum(["new", "qualified", "disqualified", "converted"]).optional(),
  contact_status: z.enum(CONTACT_STATUSES).optional(),
  next_follow_up_at: z.string().datetime({ offset: true }).nullable().optional(),
  notes: z.string().max(10_000).nullable().optional(),
  disqualified_reason: z.string().max(300).nullable().optional(),
});

export async function updateLead(input: z.input<typeof updateLeadSchema>): Promise<ActionResult> {
  const parsed = updateLeadSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid lead update");
  const actor = await getActor();
  const { leadId, ...patch } = parsed.data;
  const { data: lead, error } = await actor.db.from("leads").update(patch).eq("id", leadId).eq("workspace_id", actor.workspaceId).select("id, company_id, status").single();
  if (error || !lead) return fail(error?.message ?? "Lead not found");
  if (patch.status === "qualified") {
    await logActivity(actor, { type: "lead_qualified", title: "Lead qualified", companyId: lead.company_id, leadId });
    await emitEvent(actor, "lead.qualified", { type: "lead", id: leadId }, { company_id: lead.company_id });
  }
  revalidatePath(`/companies/${lead.company_id}`);
  return ok(undefined);
}

export async function qualifyLead(leadId: string): Promise<ActionResult<{ dealId: string }>> {
  if (!z.string().uuid().safeParse(leadId).success) return fail("Invalid lead");
  const actor = await getActor();
  try {
    const { dealId } = await ensureDealForLead(actor, leadId, { stageKey: "qualified" });
    revalidatePath("/pipeline");
    revalidatePath("/leads");
    return ok({ dealId });
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function rescoreCompany(companyId: string): Promise<ActionResult<{ score: number }>> {
  if (!z.string().uuid().safeParse(companyId).success) return fail("Invalid company");
  const actor = await getActor();
  const results = await rescoreCompanies(actor, [companyId]);
  const r = results.get(companyId);
  if (!r) return fail("This company has no lead to score");
  revalidatePath(`/companies/${companyId}`);
  return ok({ score: r.score });
}

const saveFilterSchema = z.object({
  name: z.string().trim().min(1).max(80),
  filters: leadFiltersSchema.omit({ page: true }),
  isShared: z.boolean().default(true),
});

export async function saveLeadFilter(input: z.input<typeof saveFilterSchema>): Promise<ActionResult<{ id: string }>> {
  const parsed = saveFilterSchema.safeParse(input);
  if (!parsed.success) return fail("Give the filter a name");
  const actor = await getActor();
  const { data, error } = await actor.db
    .from("saved_filters")
    .insert({ workspace_id: actor.workspaceId, user_id: actor.userId as string, entity: "leads", name: parsed.data.name, filters: parsed.data.filters as Json, is_shared: parsed.data.isShared })
    .select("id")
    .single();
  if (error || !data) return fail(error?.message ?? "Could not save");
  revalidatePath("/leads");
  return ok({ id: data.id });
}

export async function deleteSavedFilter(id: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(id).success) return fail("Invalid filter");
  const actor = await getActor();
  const { error } = await actor.db.from("saved_filters").delete().eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/leads");
  return ok(undefined);
}
