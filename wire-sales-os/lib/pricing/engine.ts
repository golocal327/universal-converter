import type { ValueTier } from "@/lib/domain/constants";

/**
 * Pricing engine: recommends a WIRE package (setup + monthly) and extras for
 * a lead, from configurable rules. Rules are evaluated in priority order;
 * the first active rule whose conditions all match wins.
 */

export type BusinessPotential = "high" | "medium" | "low";
export type WebsiteQuality = "none" | "low" | "medium" | "high";

export type PricingConditions = {
  business_potential?: BusinessPotential[];
  website_quality?: WebsiteQuality[];
  sector_tier?: ValueTier[];
};

export type PricingRule = {
  id: string;
  name: string;
  priority: number;
  conditions: PricingConditions;
  package_name: string;
  service_slug: string | null;
  setup_price: number;
  monthly_price: number;
  is_active: boolean;
};

export type CatalogService = {
  slug: string;
  name: string;
  setup_price: number;
  monthly_price: number;
  is_active: boolean;
};

export type PricingExtra = { slug: string; label: string; setup: number; monthly: number; reason: string };

export type PricingRecommendation = {
  packageName: string;
  primaryService: string | null;
  setup: number;
  monthly: number;
  extras: PricingExtra[];
  extrasSetupTotal: number;
  extrasMonthlyTotal: number;
  /** First-year value of the core package (setup + 12 × monthly). */
  firstYearValue: number;
  businessPotential: BusinessPotential;
  websiteQuality: WebsiteQuality;
  ruleId: string | null;
  reason: string;
};

export type PotentialInput = {
  google_reviews_count?: number | null;
  google_rating?: number | null;
  employees_estimate?: number | null;
  sector_tier?: ValueTier | null;
};

export function computeBusinessPotential(input: PotentialInput): BusinessPotential {
  let points = 0;
  const reviews = input.google_reviews_count ?? 0;
  if (reviews >= 200) points += 2;
  else if (reviews >= 50) points += 1;
  const employees = input.employees_estimate ?? 0;
  if (employees >= 10) points += 2;
  else if (employees >= 4) points += 1;
  if (input.sector_tier === "high") points += 2;
  else if (input.sector_tier === "medium") points += 1;
  if ((input.google_rating ?? 0) >= 4.5 && reviews >= 50) points += 1;
  return points >= 5 ? "high" : points >= 3 ? "medium" : "low";
}

export function computeWebsiteQuality(website: string | null | undefined, websiteScore: number | null | undefined, auditFailed = false): WebsiteQuality {
  if (!website || auditFailed) return "none";
  if (websiteScore === null || websiteScore === undefined) return "medium";
  if (websiteScore < 45) return "low";
  if (websiteScore < 70) return "medium";
  return "high";
}

function matches(rule: PricingRule, ctx: { potential: BusinessPotential; quality: WebsiteQuality; tier: ValueTier | null }) {
  const c = rule.conditions ?? {};
  if (c.business_potential?.length && !c.business_potential.includes(ctx.potential)) return false;
  if (c.website_quality?.length && !c.website_quality.includes(ctx.quality)) return false;
  if (c.sector_tier?.length && (!ctx.tier || !c.sector_tier.includes(ctx.tier))) return false;
  return true;
}

/** Which service solves which opportunity (audit/opportunity keys → service slugs). */
export const OPPORTUNITY_SERVICE: Record<string, { slug: string; reason: string }> = {
  no_booking: { slug: "booking-system", reason: "No online booking" },
  no_whatsapp: { slug: "whatsapp-integration", reason: "No WhatsApp contact" },
  poor_seo_metadata: { slug: "seo-local", reason: "Weak SEO" },
  technical_seo: { slug: "seo-local", reason: "Weak SEO" },
  weak_seo: { slug: "seo-local", reason: "Weak SEO" },
  no_lead_capture: { slug: "automation", reason: "Leads are not captured automatically" },
  weak_trust: { slug: "review-nfc", reason: "Few visible reviews" },
  low_rating: { slug: "review-nfc", reason: "Reputation needs work" },
  reviews_few: { slug: "review-nfc", reason: "Few Google reviews" },
  chatbot: { slug: "ai-chatbot", reason: "High enquiry volume" },
};

export function recommendPricing(input: {
  potential: BusinessPotential;
  quality: WebsiteQuality;
  sectorTier: ValueTier | null;
  opportunityKeys: string[];
  rules: PricingRule[];
  services: CatalogService[];
  maxExtras?: number;
  fallback?: { setup: number; monthly: number };
}): PricingRecommendation {
  const ctx = { potential: input.potential, quality: input.quality, tier: input.sectorTier };
  const rule = [...input.rules].filter((r) => r.is_active).sort((a, b) => a.priority - b.priority).find((r) => matches(r, ctx)) ?? null;

  const setup = rule?.setup_price ?? input.fallback?.setup ?? 1200;
  const monthly = rule?.monthly_price ?? input.fallback?.monthly ?? 90;
  const primaryService = rule?.service_slug ?? null;

  const catalog = new Map(input.services.filter((s) => s.is_active).map((s) => [s.slug, s]));
  const extras: PricingExtra[] = [];
  const seen = new Set<string>(primaryService ? [primaryService] : []);
  for (const key of input.opportunityKeys) {
    const mapping = OPPORTUNITY_SERVICE[key];
    if (!mapping || seen.has(mapping.slug)) continue;
    const service = catalog.get(mapping.slug);
    if (!service) continue;
    seen.add(mapping.slug);
    extras.push({ slug: service.slug, label: service.name, setup: service.setup_price, monthly: service.monthly_price, reason: mapping.reason });
    if (extras.length >= (input.maxExtras ?? 4)) break;
  }

  const qualityText: Record<WebsiteQuality, string> = {
    none: "has no working website",
    low: "has a weak website",
    medium: "has an average website",
    high: "already has a good website",
  };
  const reason = `${capitalize(input.potential)} business potential and the company ${qualityText[input.quality]}${
    input.sectorTier ? ` in a ${input.sectorTier}-value sector` : ""
  }.`;

  return {
    packageName: rule?.package_name ?? "Website improvement",
    primaryService,
    setup,
    monthly,
    extras,
    extrasSetupTotal: extras.reduce((a, e) => a + e.setup, 0),
    extrasMonthlyTotal: extras.reduce((a, e) => a + e.monthly, 0),
    firstYearValue: setup + monthly * 12,
    businessPotential: input.potential,
    websiteQuality: input.quality,
    ruleId: rule?.id ?? null,
    reason,
  };
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
