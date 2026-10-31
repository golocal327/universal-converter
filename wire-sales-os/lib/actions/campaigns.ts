"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getActor } from "@/lib/auth/actor";
import { CAMPAIGN_STATUSES, CHANNELS, WEBSITE_REQUIREMENTS } from "@/lib/domain/constants";
import { sanitizeSearch } from "@/lib/filters/leads";
import { logActivity } from "@/lib/services/activity";
import { fail, ok, type ActionResult } from "@/lib/services/types";

const uuid = z.string().uuid();
const campaignSchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(1, "Name is required").max(160),
  description: z.string().max(2000).nullable().optional(),
  target_sector_id: uuid.nullable().optional(),
  target_location: z.string().trim().max(120).nullable().optional(),
  website_requirement: z.enum(WEBSITE_REQUIREMENTS).default("any"),
  channel: z.enum(CHANNELS).default("email"),
  status: z.enum(CAMPAIGN_STATUSES).default("draft"),
  template_id: uuid.nullable().optional(),
});
export type CampaignInput = z.input<typeof campaignSchema>;

export async function saveCampaign(input: CampaignInput): Promise<ActionResult<{ id: string }>> {
  const parsed = campaignSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields", parsed.error.flatten().fieldErrors as Record<string, string[]>);
  const actor = await getActor();
  const { id, ...c } = parsed.data;
  const row = { ...c, description: c.description ?? null, target_sector_id: c.target_sector_id ?? null, target_location: c.target_location || null, template_id: c.template_id ?? null, ...(c.status === "active" ? { start_date: new Date().toISOString().slice(0, 10) } : {}) };
  const result = id
    ? await actor.db.from("campaigns").update(row).eq("id", id).eq("workspace_id", actor.workspaceId).select("id").single()
    : await actor.db.from("campaigns").insert({ ...row, workspace_id: actor.workspaceId, created_by: actor.userId }).select("id").single();
  if (result.error || !result.data) return fail(result.error?.message ?? "Could not save campaign");
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${result.data.id}`);
  return ok({ id: result.data.id });
}

/** Add every lead matching the campaign's target (sector, location, website requirement) that is not in it yet. */
export async function addMatchingLeads(campaignId: string): Promise<ActionResult<{ added: number }>> {
  if (!uuid.safeParse(campaignId).success) return fail("Invalid campaign");
  const actor = await getActor();
  const { data: c } = await actor.db.from("campaigns").select("id, name, target_sector_id, target_location, website_requirement").eq("id", campaignId).single();
  if (!c) return fail("Campaign not found");
  let q = actor.db.from("lead_overview").select("id, company_id").eq("workspace_id", actor.workspaceId).not("status", "eq", "disqualified").not("contact_status", "eq", "do_not_contact");
  if (c.target_sector_id) q = q.eq("sector_id", c.target_sector_id);
  if (c.target_location) {
    const loc = sanitizeSearch(c.target_location);
    q = q.or(`city.ilike.%${loc}%,province.ilike.%${loc}%`);
  }
  if (c.website_requirement === "missing") q = q.eq("website_state", "missing");
  if (c.website_requirement === "weak") q = q.eq("website_state", "weak");
  if (c.website_requirement === "missing_or_weak") q = q.in("website_state", ["missing", "weak"]);
  const { data: leads, error } = await q.order("score", { ascending: false }).limit(500);
  if (error) return fail(error.message);
  const { data: existing } = await actor.db.from("campaign_leads").select("lead_id").eq("campaign_id", campaignId);
  const inCampaign = new Set((existing ?? []).map((e) => e.lead_id));
  const fresh = (leads ?? []).filter((l) => !inCampaign.has(l.id as string));
  if (fresh.length) {
    await actor.db.from("campaign_leads").insert(fresh.map((l) => ({ workspace_id: actor.workspaceId, campaign_id: campaignId, lead_id: l.id as string })));
    await logActivity(actor, fresh.map((l) => ({ type: "campaign_added" as const, title: `Added to campaign ${c.name}`, companyId: l.company_id, leadId: l.id })));
  }
  revalidatePath(`/campaigns/${campaignId}`);
  return ok({ added: fresh.length });
}

export async function removeLeadFromCampaign(campaignId: string, leadId: string): Promise<ActionResult> {
  if (!uuid.safeParse(campaignId).success || !uuid.safeParse(leadId).success) return fail("Invalid request");
  const actor = await getActor();
  const { error } = await actor.db.from("campaign_leads").delete().eq("campaign_id", campaignId).eq("lead_id", leadId);
  if (error) return fail(error.message);
  revalidatePath(`/campaigns/${campaignId}`);
  return ok(undefined);
}

export async function deleteCampaign(campaignId: string): Promise<ActionResult> {
  if (!uuid.safeParse(campaignId).success) return fail("Invalid campaign");
  const actor = await getActor();
  const { error } = await actor.db.from("campaigns").delete().eq("id", campaignId).eq("workspace_id", actor.workspaceId);
  if (error) return fail(error.message);
  revalidatePath("/campaigns");
  redirect("/campaigns");
}
