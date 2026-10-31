import "server-only";
import type { StageKey } from "@/lib/domain/constants";
import { logActivity } from "./activity";
import { emitEvent } from "./events";
import { buildLeadContext, loadPricingCatalog } from "./lead-context";
import type { Actor } from "./types";

export async function loadStages(actor: Actor) {
  const { data } = await actor.db
    .from("pipeline_stages")
    .select("id, key, name, position, probability, is_won, is_lost, color")
    .eq("workspace_id", actor.workspaceId)
    .order("position");
  return data ?? [];
}

/** Open (or reuse) a deal for a lead, prefilled with the pricing engine's recommendation. */
export async function ensureDealForLead(
  actor: Actor,
  leadId: string,
  input: { stageKey?: StageKey; title?: string; setupValue?: number; monthlyValue?: number; serviceSlug?: string | null; campaignId?: string | null } = {},
) {
  const { data: lead } = await actor.db
    .from("leads")
    .select("id, company_id, primary_contact_id, status, company:companies(name)")
    .eq("workspace_id", actor.workspaceId)
    .eq("id", leadId)
    .single();
  if (!lead) throw new Error("Lead not found");

  const { data: existing } = await actor.db.from("deals").select("id, stage_id").eq("lead_id", leadId).eq("status", "open").limit(1).maybeSingle();
  if (existing) return { dealId: existing.id, created: false };

  const stages = await loadStages(actor);
  const stage = stages.find((s) => s.key === (input.stageKey ?? "qualified")) ?? stages.find((s) => !s.is_won && !s.is_lost);
  if (!stage) throw new Error("Pipeline has no stages");

  const ctx = await buildLeadContext(actor, lead.company_id);
  const catalog = await loadPricingCatalog(actor);
  const serviceSlug = input.serviceSlug ?? ctx?.pricing?.primaryService ?? null;
  const companyName = (lead.company as unknown as { name: string } | null)?.name ?? "Deal";

  const { data: campaignLink } = input.campaignId
    ? { data: { campaign_id: input.campaignId } }
    : await actor.db.from("campaign_leads").select("campaign_id").eq("lead_id", leadId).order("added_at", { ascending: false }).limit(1).maybeSingle();

  const { data: deal, error } = await actor.db
    .from("deals")
    .insert({
      workspace_id: actor.workspaceId,
      company_id: lead.company_id,
      lead_id: lead.id,
      contact_id: lead.primary_contact_id,
      campaign_id: campaignLink?.campaign_id ?? null,
      service_id: serviceSlug ? (catalog.serviceIdBySlug.get(serviceSlug) ?? null) : null,
      owner_id: actor.userId,
      title: input.title ?? `${companyName} — ${ctx?.pricing?.packageName ?? "Website project"}`,
      stage_id: stage.id,
      setup_value: input.setupValue ?? ctx?.pricing?.setup ?? 0,
      monthly_value: input.monthlyValue ?? ctx?.pricing?.monthly ?? 0,
    })
    .select("id, value")
    .single();
  if (error || !deal) throw new Error(`Could not create deal: ${error?.message}`);

  await actor.db.from("leads").update({ status: "converted" }).eq("id", lead.id);
  await logActivity(actor, { type: "deal_created", title: `Deal created in ${stage.name}`, companyId: lead.company_id, leadId: lead.id, dealId: deal.id, metadata: { value: deal.value } });
  await emitEvent(actor, "deal.created", { type: "deal", id: deal.id }, { company_id: lead.company_id, lead_id: lead.id, stage: stage.key, value: deal.value });
  if (lead.status === "new") await emitEvent(actor, "lead.qualified", { type: "lead", id: lead.id }, { company_id: lead.company_id });
  return { dealId: deal.id, created: true };
}

/** Move a deal to a stage (drag & drop or automation) and apply the side effects. */
export async function moveDealToStage(actor: Actor, dealId: string, stageId: string, sortOrder?: number, lostReason?: string | null) {
  const stages = await loadStages(actor);
  const stage = stages.find((s) => s.id === stageId);
  if (!stage) throw new Error("Unknown stage");
  const { data: before } = await actor.db.from("deals").select("id, stage_id, company_id, lead_id, campaign_id, value, title").eq("id", dealId).single();
  if (!before) throw new Error("Deal not found");

  const { error } = await actor.db
    .from("deals")
    .update({ stage_id: stageId, ...(sortOrder !== undefined ? { sort_order: sortOrder } : {}), ...(stage.is_lost ? { lost_reason: lostReason ?? null } : {}) })
    .eq("id", dealId);
  if (error) throw new Error(error.message);
  if (before.stage_id === stageId) return;

  const from = stages.find((s) => s.id === before.stage_id);
  const base = { companyId: before.company_id, leadId: before.lead_id, dealId };
  if (stage.is_won) {
    await actor.db.from("companies").update({ is_customer: true }).eq("id", before.company_id);
    if (before.lead_id) await actor.db.from("campaign_leads").update({ won_at: new Date().toISOString() }).eq("lead_id", before.lead_id).is("won_at", null);
    await logActivity(actor, { ...base, type: "deal_won", title: `Deal won — ${before.title}`, metadata: { value: before.value } });
    await emitEvent(actor, "deal.won", { type: "deal", id: dealId }, { company_id: before.company_id, value: before.value });
  } else if (stage.is_lost) {
    if (before.lead_id) await actor.db.from("campaign_leads").update({ lost_at: new Date().toISOString() }).eq("lead_id", before.lead_id).is("lost_at", null);
    await logActivity(actor, { ...base, type: "deal_lost", title: `Deal lost${lostReason ? ` — ${lostReason}` : ""}`, metadata: { from: from?.key ?? null } });
    await emitEvent(actor, "deal.lost", { type: "deal", id: dealId }, { company_id: before.company_id, reason: lostReason ?? null });
  } else {
    await logActivity(actor, { ...base, type: "deal_stage_changed", title: `${from?.name ?? "?"} → ${stage.name}`, metadata: { from: from?.key ?? null, to: stage.key } });
  }
}

/** Advance (never move back) the lead's open deal to at least the given stage. */
export async function advanceDealTo(actor: Actor, leadId: string, stageKey: StageKey) {
  const stages = await loadStages(actor);
  const target = stages.find((s) => s.key === stageKey);
  if (!target) return;
  const { data: deal } = await actor.db.from("deals").select("id, stage_id").eq("lead_id", leadId).eq("status", "open").limit(1).maybeSingle();
  if (!deal) {
    await ensureDealForLead(actor, leadId, { stageKey });
    return;
  }
  const current = stages.find((s) => s.id === deal.stage_id);
  if (current && current.position < target.position) await moveDealToStage(actor, deal.id, target.id);
}
