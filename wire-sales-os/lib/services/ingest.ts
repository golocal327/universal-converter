import "server-only";
import type { LeadSource } from "@/lib/domain/constants";
import { dedupeBatch, DEDUPE_REASON_LABELS, type ExistingRecord } from "@/lib/lead-pipeline/dedupe";
import { matchSector, type SectorRef } from "@/lib/lead-pipeline/sector-match";
import { normalizeLead, type NormalizedLead, type RawLead } from "@/lib/lead-pipeline/validate";
import { logActivity } from "./activity";
import { emitEvent } from "./events";
import { rescoreCompanies } from "./scoring";
import type { Actor } from "./types";

/**
 * Lead pipeline orchestrator:
 *   Lead Source → Normalizer → Validator → Deduplicator → Scoring Engine → CRM
 * Shared by CSV import, manual creation, Find Leads and the public API.
 */
export type IngestRow =
  | { index: number; status: "created"; name: string; companyId: string; leadId: string; warnings: string[] }
  | { index: number; status: "new"; name: string; warnings: string[] }
  | { index: number; status: "duplicate"; name: string; reason: string; matchId: string; warnings: string[] }
  | { index: number; status: "invalid"; name: string | null; errors: string[] };

export type IngestSummary = { total: number; created: number; new: number; duplicates: number; invalid: number; rows: IngestRow[] };

export type IngestOptions = {
  source: LeadSource;
  dryRun?: boolean;
  campaignId?: string | null;
  ownerId?: string | null;
  /** Extra fields set on every created company (e.g. tags). */
  tags?: string[];
};

const CHUNK = 200;

function chunks<T>(arr: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Existing companies that share any dedupe key with the given leads. */
export async function loadExisting(actor: Actor, leads: NormalizedLead[]): Promise<ExistingRecord[]> {
  const domains = [...new Set(leads.map((l) => l.domain).filter((v): v is string => Boolean(v)))];
  const phones = [...new Set(leads.map((l) => l.phone_normalized).filter((v): v is string => Boolean(v)))];
  const emails = [...new Set(leads.map((l) => l.email).filter((v): v is string => Boolean(v)))];
  const nameKeys = [...new Set(leads.map((l) => l.name_key).filter((v) => !v.endsWith("|")))];
  const select = "id, domain, phone_normalized, email, name_key";
  const found = new Map<string, ExistingRecord>();
  const run = async (column: "domain" | "phone_normalized" | "email" | "name_key", values: string[]) => {
    for (const part of chunks(values)) {
      const { data, error } = await actor.db.from("companies").select(select).eq("workspace_id", actor.workspaceId).in(column, part);
      if (error) throw new Error(`Dedup lookup failed: ${error.message}`);
      for (const row of data ?? []) found.set(row.id, row);
    }
  };
  await Promise.all([run("domain", domains), run("phone_normalized", phones), run("email", emails), run("name_key", nameKeys)]);
  return [...found.values()];
}

export async function loadSectorRefs(actor: Actor): Promise<SectorRef[]> {
  const { data } = await actor.db.from("sectors").select("id, name, slug, keywords").eq("workspace_id", actor.workspaceId);
  return (data ?? []) as SectorRef[];
}

export async function ingestLeads(actor: Actor, raws: RawLead[], options: IngestOptions): Promise<IngestSummary> {
  const rows: IngestRow[] = [];
  const valid: { index: number; lead: NormalizedLead; warnings: string[] }[] = [];

  // Normalizer + Validator
  raws.forEach((raw, index) => {
    const res = normalizeLead(raw);
    if (res.ok) valid.push({ index, lead: res.lead, warnings: res.warnings });
    else rows.push({ index, status: "invalid", name: typeof raw.company_name === "string" ? raw.company_name : null, errors: res.errors });
  });

  // Deduplicator (against CRM + within batch)
  const existing = await loadExisting(actor, valid.map((v) => v.lead));
  const classified = dedupeBatch(valid.map((v) => v.lead), existing);
  const fresh: { index: number; lead: NormalizedLead; warnings: string[] }[] = [];
  classified.forEach((item, i) => {
    const v = valid[i];
    if (item.status === "duplicate") {
      const matchId = item.match.matchId.startsWith("row:") ? `row:${valid[Number(item.match.matchId.slice(4))].index}` : item.match.matchId;
      rows.push({ index: v.index, status: "duplicate", name: v.lead.name, reason: DEDUPE_REASON_LABELS[item.match.reason], matchId, warnings: v.warnings });
    } else fresh.push(v);
  });

  if (options.dryRun) {
    for (const v of fresh) rows.push({ index: v.index, status: "new", name: v.lead.name, warnings: v.warnings });
    return summarize(raws.length, rows);
  }

  const sectors = await loadSectorRefs(actor);
  const createdCompanyIds: string[] = [];
  const createdLeads: { leadId: string; companyId: string; name: string }[] = [];

  for (const part of chunks(fresh)) {
    const companyRows = part.map(({ lead }) => {
      const sector = matchSector(lead.sector, sectors);
      return {
        workspace_id: actor.workspaceId,
        name: lead.name,
        legal_name: lead.legal_name,
        sector_id: sector?.id ?? null,
        subsector: lead.subsector ?? (sector ? null : lead.sector),
        city: lead.city,
        province: lead.province,
        country: lead.country,
        address: lead.address,
        postal_code: lead.postal_code,
        phone: lead.phone,
        phone_normalized: lead.phone_normalized,
        email: lead.email,
        website: lead.website,
        domain: lead.domain,
        instagram_url: lead.instagram_url,
        facebook_url: lead.facebook_url,
        linkedin_url: lead.linkedin_url,
        google_maps_url: lead.google_maps_url,
        google_place_id: lead.google_place_id,
        google_rating: lead.google_rating,
        google_reviews_count: lead.google_reviews_count,
        google_last_review_at: lead.google_last_review_at,
        employees_estimate: lead.employees_estimate,
        description: lead.description,
        services_offered: lead.services_offered,
        opening_hours: lead.opening_hours,
        tags: options.tags ?? [],
        name_key: lead.name_key,
        created_by: actor.userId,
      };
    });
    const { data: companies, error } = await actor.db.from("companies").insert(companyRows).select("id");
    if (error || !companies) throw new Error(`Could not create companies: ${error?.message}`);

    const leadRows = companies.map((c, i) => ({
      workspace_id: actor.workspaceId,
      company_id: c.id,
      source: options.source,
      source_ref: part[i].lead.source_ref,
      owner_id: options.ownerId ?? actor.userId,
      notes: part[i].lead.notes,
    }));
    const { data: leads, error: leadError } = await actor.db.from("leads").insert(leadRows).select("id, company_id");
    if (leadError || !leads) throw new Error(`Could not create leads: ${leadError?.message}`);

    // Contacts (optional)
    const contactRows = part
      .map((v, i) => ({ v, companyId: companies[i].id }))
      .filter(({ v }) => v.lead.contact_name)
      .map(({ v, companyId }) => ({
        workspace_id: actor.workspaceId,
        company_id: companyId,
        full_name: v.lead.contact_name as string,
        role: v.lead.contact_role,
        email: v.lead.contact_email,
        phone: v.lead.contact_phone,
        is_primary: true,
      }));
    if (contactRows.length) {
      const { data: contacts } = await actor.db.from("contacts").insert(contactRows).select("id, company_id");
      for (const contact of contacts ?? []) {
        const lead = leads.find((l) => l.company_id === contact.company_id);
        if (lead) await actor.db.from("leads").update({ primary_contact_id: contact.id }).eq("id", lead.id);
      }
    }

    if (options.campaignId) {
      await actor.db.from("campaign_leads").insert(leads.map((l) => ({ workspace_id: actor.workspaceId, campaign_id: options.campaignId as string, lead_id: l.id })));
    }

    part.forEach((v, i) => {
      const lead = leads.find((l) => l.company_id === companies[i].id);
      if (!lead) return;
      createdCompanyIds.push(companies[i].id);
      createdLeads.push({ leadId: lead.id, companyId: companies[i].id, name: v.lead.name });
      rows.push({ index: v.index, status: "created", name: v.lead.name, companyId: companies[i].id, leadId: lead.id, warnings: v.warnings });
    });
  }

  // Scoring Engine → CRM
  await rescoreCompanies(actor, createdCompanyIds, { silent: true });
  await logActivity(
    actor,
    createdLeads.map((l) => ({ type: "lead_created" as const, title: "Lead created", body: `Source: ${options.source}`, companyId: l.companyId, leadId: l.leadId })),
  );
  for (const l of createdLeads.slice(0, 500)) {
    await emitEvent(actor, "lead.created", { type: "lead", id: l.leadId }, { company_id: l.companyId, name: l.name, source: options.source });
  }
  return summarize(raws.length, rows);
}

function summarize(total: number, rows: IngestRow[]): IngestSummary {
  rows.sort((a, b) => a.index - b.index);
  return {
    total,
    created: rows.filter((r) => r.status === "created").length,
    new: rows.filter((r) => r.status === "new").length,
    duplicates: rows.filter((r) => r.status === "duplicate").length,
    invalid: rows.filter((r) => r.status === "invalid").length,
    rows,
  };
}
