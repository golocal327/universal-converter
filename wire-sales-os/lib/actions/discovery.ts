"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActor, withinRateLimit } from "@/lib/auth/actor";
import { WEBSITE_REQUIREMENTS } from "@/lib/domain/constants";
import { isPlacesConfigured, placeToRawLead, searchPlaces } from "@/lib/integrations/google-places";
import { dedupeBatch } from "@/lib/lead-pipeline/dedupe";
import { prospectInsights } from "@/lib/lead-pipeline/prospect-insights";
import { normalizeLead, type NormalizedLead, type RawLead } from "@/lib/lead-pipeline/validate";
import { scoreLead } from "@/lib/scoring/engine";
import type { Json } from "@/lib/supabase/database.types";
import { ingestLeads, loadExisting } from "@/lib/services/ingest";
import { loadSettings } from "@/lib/services/settings";
import { fail, ok, type ActionResult } from "@/lib/services/types";

const discoverySchema = z.object({
  sectorId: z.string().uuid().nullable().optional(),
  sectorText: z.string().trim().max(80).optional(),
  location: z.string().trim().min(2, "Enter a location").max(80),
  websiteRequirement: z.enum(WEBSITE_REQUIREMENTS).default("any"),
  minReviews: z.coerce.number().int().min(0).max(1_000_000).optional(),
  maxReviews: z.coerce.number().int().min(0).max(1_000_000).optional(),
  minScore: z.coerce.number().int().min(0).max(100).optional(),
  maxResults: z.coerce.number().int().min(1).max(60).default(60),
});

/** Find Leads: Google Places → normalize → validate → dedupe vs CRM → score → store as prospects. */
export async function runDiscovery(input: z.input<typeof discoverySchema>): Promise<ActionResult<{ runId: string }>> {
  const parsed = discoverySchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid search");
  if (!isPlacesConfigured()) return fail("Google Places is not configured (GOOGLE_PLACES_API_KEY).");
  const actor = await getActor();
  if (!(await withinRateLimit(actor, "discovery", 20, 3600))) return fail("Discovery limit reached (20 searches per hour).");
  const q = parsed.data;

  const { data: sectorRow } = q.sectorId
    ? await actor.db.from("sectors").select("id, name, slug, keywords, value_tier, booking_relevant, whatsapp_relevant, score_weights").eq("id", q.sectorId).single()
    : { data: null };
  const sectorTerm = sectorRow?.keywords?.[0] ?? sectorRow?.name ?? q.sectorText;
  if (!sectorTerm) return fail("Choose a sector or type a business type");

  let places;
  try {
    places = await searchPlaces(`${sectorTerm} en ${q.location}`, { maxResults: q.maxResults });
  } catch (e) {
    return fail((e as Error).message);
  }

  const settings = await loadSettings(actor.db, actor.workspaceId);
  const normalized: { lead: NormalizedLead; raw: RawLead; placeId: string }[] = [];
  for (const place of places) {
    const raw = placeToRawLead(place, sectorRow?.name ?? q.sectorText ?? null);
    const res = normalizeLead(raw);
    if (res.ok) normalized.push({ lead: res.lead, raw, placeId: place.id });
  }

  // Dedupe against existing companies (domain, phone, email, name+city) and Google Place IDs.
  const existing = await loadExisting(actor, normalized.map((n) => n.lead));
  const placeIds = normalized.map((n) => n.placeId);
  const { data: placeMatches } = placeIds.length
    ? await actor.db.from("companies").select("id, google_place_id").eq("workspace_id", actor.workspaceId).in("google_place_id", placeIds)
    : { data: [] };
  const byPlace = new Map((placeMatches ?? []).map((e) => [e.google_place_id as string, e.id]));
  const classified = dedupeBatch(normalized.map((n) => n.lead), existing);

  const rows = normalized.map((n, i) => {
    const sector = sectorRow;
    const score = scoreLead({
      company: n.lead,
      sector: sector ? { name: sector.name, value_tier: sector.value_tier as "high" | "medium" | "low", booking_relevant: sector.booking_relevant, whatsapp_relevant: sector.whatsapp_relevant, score_weights: sector.score_weights as Record<string, number> } : null,
      audit: null,
      config: settings.scoring,
    });
    const insight = prospectInsights(n.lead, score);
    const dupId = byPlace.get(n.placeId) ?? (classified[i].status === "duplicate" && !classified[i].match.matchId.startsWith("row:") ? classified[i].match.matchId : null);
    const inBatchDup = classified[i].status === "duplicate" && classified[i].match.matchId.startsWith("row:");
    return { n, score, insight, dupId, inBatchDup };
  });

  const filtered = rows.filter(({ n, score, inBatchDup }) => {
    if (inBatchDup) return false;
    const reviews = n.lead.google_reviews_count ?? 0;
    if (q.minReviews !== undefined && reviews < q.minReviews) return false;
    if (q.maxReviews !== undefined && reviews > q.maxReviews) return false;
    if (q.minScore !== undefined && score.score < q.minScore) return false;
    // Website quality is unknown before an audit, so "weak" keeps sites to audit later.
    if (q.websiteRequirement === "missing" && n.lead.website) return false;
    return true;
  });

  const counts = { high: filtered.filter((r) => r.score.priority === "hot").length, medium: filtered.filter((r) => r.score.priority === "warm").length, low: filtered.filter((r) => r.score.priority === "cold").length };
  const { data: run, error } = await actor.db
    .from("discovery_runs")
    .insert({
      workspace_id: actor.workspaceId, source: "google_places", query: q as unknown as Json, total: filtered.length,
      high_priority: counts.high, medium_priority: counts.medium, low_priority: counts.low, created_by: actor.userId,
    })
    .select("id")
    .single();
  if (error || !run) return fail(error?.message ?? "Could not save results");

  if (filtered.length) {
    const { error: pErr } = await actor.db.from("prospects").insert(
      filtered.map(({ n, score, insight, dupId }) => ({
        workspace_id: actor.workspaceId, run_id: run.id, source: "google_places", external_id: n.placeId, name: n.lead.name,
        sector_id: sectorRow?.id ?? null, city: n.lead.city, province: n.lead.province, address: n.lead.address, phone: n.lead.phone,
        website: n.lead.website, domain: n.lead.domain, google_maps_url: n.lead.google_maps_url, google_rating: n.lead.google_rating,
        google_reviews_count: n.lead.google_reviews_count, raw: n.raw as unknown as Json, score: score.score, priority: score.priority,
        breakdown: score.factors as unknown as Json, biggest_opportunity: insight.biggestOpportunity, recommended_action: insight.recommendedAction,
        status: dupId ? ("duplicate" as const) : ("new" as const), duplicate_of_company_id: dupId,
      })),
    );
    if (pErr) return fail(pErr.message);
  }
  revalidatePath("/prospects");
  return ok({ runId: run.id });
}

const idsSchema = z.array(z.string().uuid()).min(1).max(60);

/** Promote selected prospects into the CRM through the regular lead pipeline. */
export async function importProspects(ids: string[]): Promise<ActionResult<{ created: number; duplicates: number }>> {
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) return fail("Select prospects to import");
  const actor = await getActor();
  const { data: prospects } = await actor.db.from("prospects").select("id, raw, status").eq("workspace_id", actor.workspaceId).in("id", parsed.data).eq("status", "new");
  if (!prospects?.length) return fail("Nothing new to import");
  const summary = await ingestLeads(actor, prospects.map((p) => p.raw as unknown as RawLead), { source: "google_places" });
  for (const row of summary.rows) {
    const p = prospects[row.index];
    if (row.status === "created") await actor.db.from("prospects").update({ status: "imported", company_id: row.companyId }).eq("id", p.id);
    else if (row.status === "duplicate") await actor.db.from("prospects").update({ status: "duplicate" }).eq("id", p.id);
  }
  revalidatePath("/prospects");
  revalidatePath("/leads");
  return ok({ created: summary.created, duplicates: summary.duplicates });
}

export async function dismissProspects(ids: string[]): Promise<ActionResult> {
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) return fail("Select prospects");
  const actor = await getActor();
  await actor.db.from("prospects").update({ status: "dismissed" }).eq("workspace_id", actor.workspaceId).in("id", parsed.data);
  revalidatePath("/prospects");
  return ok(undefined);
}
