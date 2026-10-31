import "server-only";
import type { AuditOpportunity, AuditSignalsDetail } from "@/lib/audit/analyzer";
import type { Priority, ValueTier } from "@/lib/domain/constants";
import type { LeadContext } from "@/lib/outreach/context";
import {
  computeBusinessPotential,
  computeWebsiteQuality,
  recommendPricing,
  type CatalogService,
  type PricingConditions,
  type PricingRecommendation,
  type PricingRule,
} from "@/lib/pricing/engine";
import type { ScoreFactor } from "@/lib/scoring/engine";
import { loadSettings } from "./settings";
import type { Actor } from "./types";

export async function loadPricingCatalog(actor: Actor): Promise<{ rules: PricingRule[]; services: CatalogService[]; serviceIdBySlug: Map<string, string> }> {
  const [{ data: rules }, { data: services }] = await Promise.all([
    actor.db.from("pricing_rules").select("id, name, priority, conditions, package_name, setup_price, monthly_price, is_active, service:services(slug)").eq("workspace_id", actor.workspaceId),
    actor.db.from("services").select("id, slug, name, setup_price, monthly_price, is_active").eq("workspace_id", actor.workspaceId),
  ]);
  return {
    rules: (rules ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      priority: r.priority,
      conditions: (r.conditions ?? {}) as PricingConditions,
      package_name: r.package_name,
      service_slug: (r.service as unknown as { slug: string } | null)?.slug ?? null,
      setup_price: Number(r.setup_price),
      monthly_price: Number(r.monthly_price),
      is_active: r.is_active,
    })),
    services: (services ?? []).map((s) => ({ slug: s.slug, name: s.name, setup_price: Number(s.setup_price), monthly_price: Number(s.monthly_price), is_active: s.is_active })),
    serviceIdBySlug: new Map((services ?? []).map((s) => [s.slug, s.id])),
  };
}

/** Load everything known about a company into a LeadContext (used by generators, AI and proposals). */
export async function buildLeadContext(actor: Actor, companyId: string): Promise<LeadContext | null> {
  const [{ data: company }, { data: lead }, { data: audit }, settings, catalog] = await Promise.all([
    actor.db
      .from("companies")
      .select("*, sector:sectors(name, value_tier, booking_relevant, whatsapp_relevant, common_problems, sales_arguments, setup_price_min, setup_price_max, monthly_price)")
      .eq("workspace_id", actor.workspaceId)
      .eq("id", companyId)
      .maybeSingle(),
    actor.db
      .from("leads")
      .select("id, score, priority, primary_contact_id, contact:contacts!leads_workspace_id_primary_contact_id_fkey(full_name, role, email, phone)")
      .eq("company_id", companyId)
      .maybeSingle(),
    actor.db
      .from("website_audits")
      .select("status, error, overall_score, performance_score, seo_score, ux_score, conversion_score, mobile_score, opportunities, signals")
      .eq("company_id", companyId)
      .neq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    loadSettings(actor.db, actor.workspaceId),
    loadPricingCatalog(actor),
  ]);
  if (!company) return null;

  const { data: latestScore } = lead
    ? await actor.db.from("lead_scores").select("breakdown").eq("lead_id", lead.id).order("created_at", { ascending: false }).limit(1).maybeSingle()
    : { data: null };

  let contact = (lead?.contact as unknown as { full_name: string; role: string | null; email: string | null; phone: string | null } | null) ?? null;
  if (!contact) {
    const { data: anyContact } = await actor.db
      .from("contacts")
      .select("full_name, role, email, phone")
      .eq("company_id", companyId)
      .order("is_primary", { ascending: false })
      .limit(1)
      .maybeSingle();
    contact = anyContact;
  }

  const sector = company.sector as unknown as {
    name: string; value_tier: ValueTier; booking_relevant: boolean; whatsapp_relevant: boolean;
    common_problems: string[]; sales_arguments: string[]; setup_price_min: number | null; monthly_price: number | null;
  } | null;
  const opportunities = ((audit?.opportunities ?? []) as unknown as AuditOpportunity[]) ?? [];
  const pricing: PricingRecommendation = recommendPricing({
    potential: computeBusinessPotential({
      google_reviews_count: company.google_reviews_count,
      google_rating: company.google_rating === null ? null : Number(company.google_rating),
      employees_estimate: company.employees_estimate,
      sector_tier: sector?.value_tier ?? null,
    }),
    quality: computeWebsiteQuality(company.website, audit?.status === "completed" ? audit.overall_score : null, audit?.status === "failed"),
    sectorTier: sector?.value_tier ?? null,
    opportunityKeys: [
      ...opportunities.map((o) => o.key),
      ...((latestScore?.breakdown ?? []) as unknown as ScoreFactor[]).map((f) => f.key),
    ],
    rules: catalog.rules,
    services: catalog.services,
    fallback: sector?.setup_price_min ? { setup: Number(sector.setup_price_min), monthly: Number(sector.monthly_price ?? 90) } : undefined,
  });

  return {
    company: {
      id: company.id,
      name: company.name,
      city: company.city,
      province: company.province,
      sector: sector?.name ?? company.subsector,
      subsector: company.subsector,
      website: company.website,
      domain: company.domain,
      phone: company.phone,
      email: company.email,
      google_rating: company.google_rating === null ? null : Number(company.google_rating),
      google_reviews_count: company.google_reviews_count,
      instagram_url: company.instagram_url,
      description: company.description,
      services_offered: company.services_offered,
      employees_estimate: company.employees_estimate,
    },
    contact: contact ? { name: contact.full_name, role: contact.role, email: contact.email, phone: contact.phone } : null,
    sector: sector
      ? { name: sector.name, value_tier: sector.value_tier, booking_relevant: sector.booking_relevant, whatsapp_relevant: sector.whatsapp_relevant, common_problems: sector.common_problems, sales_arguments: sector.sales_arguments }
      : null,
    lead: lead ? { id: lead.id, score: lead.score, priority: lead.priority as Priority, factors: (latestScore?.breakdown ?? []) as unknown as ScoreFactor[] } : null,
    audit: audit
      ? {
          status: audit.status,
          overall: audit.overall_score,
          performance: audit.performance_score,
          seo: audit.seo_score,
          ux: audit.ux_score,
          conversion: audit.conversion_score,
          mobile: audit.mobile_score,
          opportunities,
          signals: (audit.signals ?? {}) as Partial<AuditSignalsDetail>,
          error: audit.error,
        }
      : null,
    pricing,
    sender: {
      name: settings.branding.senderName || "El equipo de WIRE",
      company: settings.branding.companyName || "WIRE",
      email: settings.branding.senderEmail || null,
      phone: settings.branding.senderPhone || null,
    },
  };
}
