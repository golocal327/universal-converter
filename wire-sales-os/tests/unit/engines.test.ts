import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeHtml } from "@/lib/audit/analyzer";
import { detectMapping, applyMapping } from "@/lib/lead-pipeline/csv-mapping";
import { dedupeBatch, DedupeIndex } from "@/lib/lead-pipeline/dedupe";
import { canonicalCompanyName, nameCityKey, normalizeEmail, normalizePhone, normalizeWebsite, parseNumber } from "@/lib/lead-pipeline/normalize";
import { normalizeLead } from "@/lib/lead-pipeline/validate";
import { computeBusinessPotential, computeWebsiteQuality, recommendPricing, type PricingRule } from "@/lib/pricing/engine";
import { scoreLead } from "@/lib/scoring/engine";
import { renderTemplate, unknownVariables, buildTemplateValues } from "@/lib/templates/render";
import { analyzeOpportunity, buildProposal, generateEmails, generateWhatsApp } from "@/lib/outreach/generators";
import type { LeadContext } from "@/lib/outreach/context";
import { DEFAULT_PRICING_RULES, DEFAULT_SERVICES } from "@/lib/defaults/catalog";

const fixture = (name: string) => readFileSync(path.join(__dirname, "../fixtures", name), "utf8");
const NOW = new Date("2026-10-31T10:00:00Z");

describe("normalizer", () => {
  it("normalizes websites to a canonical URL and domain", () => {
    expect(normalizeWebsite("www.Clinica-Sol.es/")).toEqual({ website: "https://www.clinica-sol.es", domain: "clinica-sol.es" });
    expect(normalizeWebsite("http://example.com/inicio/")).toEqual({ website: "http://example.com/inicio", domain: "example.com" });
    expect(normalizeWebsite("https://instagram.com/foo")).toBeNull();
    expect(normalizeWebsite("sin web")).toBeNull();
    expect(normalizeWebsite("not a url")).toBeNull();
  });

  it("normalizes Spanish and international phones", () => {
    expect(normalizePhone("956 12 34 56")).toBe("+34956123456");
    expect(normalizePhone("+34 600-111-222")).toBe("+34600111222");
    expect(normalizePhone("0034600111222")).toBe("+34600111222");
    expect(normalizePhone("34600111222")).toBe("+34600111222");
    expect(normalizePhone("123")).toBeNull();
  });

  it("validates emails and parses localized numbers", () => {
    expect(normalizeEmail(" Info@Example.ES ")).toBe("info@example.es");
    expect(normalizeEmail("mailto:a@b.co")).toBe("a@b.co");
    expect(normalizeEmail("nope@")).toBeNull();
    expect(parseNumber("4,7")).toBe(4.7);
    expect(parseNumber("1.234")).toBe(1234);
    expect(parseNumber("1,234")).toBe(1234);
  });

  it("builds identity keys that ignore legal suffixes and accents", () => {
    expect(canonicalCompanyName("Clínica Dental Sol, S.L.")).toBe("clinica dental sol");
    expect(nameCityKey("Taller Pérez SL", "Cádiz")).toBe(nameCityKey("taller perez", "cadiz"));
  });

  it("normalizeLead moves social URLs out of the website column and reports invalid fields", () => {
    const res = normalizeLead({ company_name: "Barbería Norte", website: "https://www.instagram.com/barberianorte", email: "bad", rating: "4,8", reviews: "120" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.lead.website).toBeNull();
    expect(res.lead.instagram_url).toBe("https://www.instagram.com/barberianorte");
    expect(res.lead.google_rating).toBe(4.8);
    expect(res.lead.google_reviews_count).toBe(120);
    expect(res.warnings.some((w) => w.includes("email"))).toBe(true);
    expect(normalizeLead({ website: "a.com" }).ok).toBe(false);
  });
});

describe("deduplicator", () => {
  const keys = (o: Partial<{ domain: string; phone_normalized: string; email: string; name_key: string }>) => ({
    domain: o.domain ?? null, phone_normalized: o.phone_normalized ?? null, email: o.email ?? null, name_key: o.name_key ?? null,
  });

  it("matches existing records by domain, phone, email and name+city", () => {
    const index = new DedupeIndex([{ id: "c1", ...keys({ domain: "sol.es", phone_normalized: "+34600000001", email: "a@sol.es", name_key: "sol|cadiz" }) }]);
    expect(index.find(keys({ domain: "sol.es" }))).toEqual({ reason: "domain", matchId: "c1" });
    expect(index.find(keys({ phone_normalized: "+34600000001" }))?.reason).toBe("phone");
    expect(index.find(keys({ email: "A@SOL.ES" }))?.reason).toBe("email");
    expect(index.find(keys({ name_key: "sol|cadiz" }))?.reason).toBe("name_city");
    expect(index.find(keys({ name_key: "sol|sevilla" }))).toBeNull();
  });

  it("ignores free email/hosting domains as identity", () => {
    const index = new DedupeIndex([{ id: "c1", ...keys({ domain: "gmail.com" }) }]);
    expect(index.find(keys({ domain: "gmail.com" }))).toBeNull();
  });

  it("detects duplicates inside the same batch", () => {
    const res = dedupeBatch([keys({ domain: "a.es" }), keys({ domain: "b.es" }), keys({ domain: "a.es" })], []);
    expect(res.map((r) => r.status)).toEqual(["new", "new", "duplicate"]);
    expect(res[2].status === "duplicate" && res[2].match.matchId).toBe("row:0");
  });
});

describe("CSV mapping", () => {
  it("auto-detects English and Spanish headers", () => {
    const mapping = detectMapping(["Nombre comercial", "Teléfono", "E-mail", "Web", "Ciudad", "Categoría", "Reseñas", "Valoración", "Unknown col"]);
    expect(mapping).toMatchObject({
      "Nombre comercial": "company_name", "Teléfono": "phone", "E-mail": "email", Web: "website",
      Ciudad: "city", "Categoría": "sector", "Reseñas": "reviews", "Valoración": "rating", "Unknown col": null,
    });
    const raw = applyMapping({ "Nombre comercial": "X", Web: "", Ciudad: "Cádiz" }, mapping);
    expect(raw).toEqual({ company_name: "X", city: "Cádiz" });
  });

  it("maps company_name/website/phone/email/city/sector", () => {
    expect(detectMapping(["company_name", "website", "phone", "email", "city", "sector"])).toEqual({
      company_name: "company_name", website: "website", phone: "phone", email: "email", city: "city", sector: "sector",
    });
  });
});

describe("scoring engine", () => {
  it("scores a no-website, high-demand lead in a high-value sector as hot with an itemized breakdown", () => {
    const res = scoreLead({
      company: { website: null, phone: "+34600000000", google_reviews_count: 540, google_rating: 4.7, instagram_url: "https://instagram.com/x", instagram_last_post_at: "2026-10-20", employees_estimate: 8 },
      sector: { name: "Autoescuelas", value_tier: "high", booking_relevant: true },
      now: NOW,
    });
    const labels = res.factors.map((f) => `${f.points > 0 ? "+" : ""}${f.points} ${f.label}`);
    expect(labels).toEqual(expect.arrayContaining(["+25 No website", "+15 500+ Google reviews", "+8 Instagram active", "+12 High-value sector", "+10 Weak Google conversion"]));
    expect(res.score).toBeGreaterThanOrEqual(75);
    expect(res.priority).toBe("hot");
  });

  it("uses audit signals for leads with a website", () => {
    const weak = scoreLead({
      company: { website: "https://a.es", phone: "1", google_reviews_count: 30 },
      sector: { value_tier: "medium", booking_relevant: true, whatsapp_relevant: true },
      audit: { status: "completed", https: false, responseTimeMs: 4200, mobileScore: 30, seoScore: 40, hasCta: false, hasBooking: false, hasWhatsapp: false, outdated: true, overallScore: 35 },
      now: NOW,
    });
    const strong = scoreLead({
      company: { website: "https://b.es", phone: "1", google_reviews_count: 30 },
      sector: { value_tier: "medium", booking_relevant: true, whatsapp_relevant: true },
      audit: { status: "completed", https: true, responseTimeMs: 300, mobileScore: 95, seoScore: 90, hasCta: true, hasBooking: true, hasWhatsapp: true, outdated: false, overallScore: 90 },
      now: NOW,
    });
    expect(weak.score).toBeGreaterThan(strong.score + 30);
    expect(weak.categoryTotals.website).toBe(45); // capped
    expect(weak.factors.find((f) => f.key === "no_booking")?.points).toBe(12);
  });

  it("treats a non-resolving domain as a missing website and penalizes leads without channels", () => {
    const dns = scoreLead({ company: { website: "https://gone.es", phone: "1" }, audit: { status: "failed", errorKind: "dns" }, now: NOW });
    expect(dns.factors[0].key).toBe("website_missing");
    const unreachable = scoreLead({ company: {}, now: NOW });
    expect(unreachable.factors.some((f) => f.key === "no_channel" && f.points === -15)).toBe(true);
  });

  it("applies sector weights, stale-review penalties and target areas", () => {
    const base = { company: { website: null, phone: "1", city: "Sevilla", google_last_review_at: "2025-01-01" }, now: NOW };
    const normal = scoreLead({ ...base, config: { targetLocations: ["sevilla"] } });
    const weighted = scoreLead({ ...base, sector: { score_weights: { website: 1.5 } }, config: { targetLocations: ["sevilla"] } });
    expect(normal.factors.some((f) => f.key === "target_area")).toBe(true);
    expect(normal.factors.some((f) => f.key === "stale_reviews" && f.points < 0)).toBe(true);
    expect(weighted.categoryTotals.website).toBeGreaterThan(normal.categoryTotals.website);
    expect(normal.score).toBeGreaterThanOrEqual(0);
    expect(normal.score).toBeLessThanOrEqual(100);
  });
});

describe("website audit analyzer", () => {
  it("flags an outdated, non-mobile site with low scores and ranked opportunities", () => {
    const res = analyzeHtml({
      html: fixture("weak-site.html"), finalUrl: "http://autoescuela.example/", status: 200, headers: {},
      responseTimeMs: 3500, bytes: 4000, robotsTxt: null, sitemapFound: false, brokenLinks: { checked: 2, broken: ["/cursos"] },
      bookingRelevant: true, now: NOW,
    });
    expect(res.signals.https).toBe(false);
    expect(res.signals.hasViewport).toBe(false);
    expect(res.signals.outdated).toBe(true);
    expect(res.signals.copyrightYear).toBe(2015);
    expect(res.scores.mobile).toBeLessThan(40);
    expect(res.scores.overall).toBeLessThan(45);
    const keys = res.opportunities.map((o) => o.key);
    expect(keys).toEqual(expect.arrayContaining(["no_booking", "weak_mobile", "no_https", "outdated", "no_whatsapp", "poor_seo_metadata"]));
    expect(res.opportunities[0].impact).toBe("high");
    expect(res.tech.cms).toBeNull();
  });

  it("recognizes a strong, conversion-ready site", () => {
    const res = analyzeHtml({
      html: fixture("strong-site.html"), finalUrl: "https://clinicasonrisa.example/", status: 200, headers: { "content-encoding": "br" },
      responseTimeMs: 420, bytes: 6000, robotsTxt: "User-agent: *\nSitemap: https://clinicasonrisa.example/sitemap.xml", sitemapFound: true,
      brokenLinks: { checked: 3, broken: [] }, bookingRelevant: true, now: NOW,
    });
    expect(res.signals.hasBooking).toBe(true);
    expect(res.signals.bookingProvider).toBe("Doctoralia");
    expect(res.signals.hasWhatsapp).toBe(true);
    expect(res.signals.hasCta).toBe(true);
    expect(res.signals.hasLeadCapture).toBe(true);
    expect(res.signals.outdated).toBe(false);
    expect(res.scores.seo).toBeGreaterThanOrEqual(85);
    expect(res.scores.conversion).toBeGreaterThanOrEqual(85);
    expect(res.scores.overall).toBeGreaterThanOrEqual(80);
    expect(res.opportunities.find((o) => o.impact === "high")).toBeUndefined();
  });

  it("prefers the Lighthouse performance score when available", () => {
    const res = analyzeHtml({ html: fixture("strong-site.html"), finalUrl: "https://x.example/", status: 200, headers: {}, responseTimeMs: 300, bytes: 1000, lighthousePerformance: 37 });
    expect(res.scores.performance).toBe(37);
  });
});

describe("pricing engine", () => {
  const rules: PricingRule[] = DEFAULT_PRICING_RULES.map((r, i) => ({ ...r, id: `r${i}`, is_active: true }));
  const services = DEFAULT_SERVICES.map((s) => ({ ...s, is_active: true }));

  it("derives business potential and website quality", () => {
    expect(computeBusinessPotential({ google_reviews_count: 600, employees_estimate: 12, sector_tier: "high" })).toBe("high");
    expect(computeBusinessPotential({ google_reviews_count: 60, sector_tier: "medium" })).toBe("low");
    expect(computeBusinessPotential({ google_reviews_count: 60, employees_estimate: 5, sector_tier: "medium" })).toBe("medium");
    expect(computeWebsiteQuality(null, null)).toBe("none");
    expect(computeWebsiteQuality("https://a.es", 30)).toBe("low");
    expect(computeWebsiteQuality("https://a.es", null)).toBe("medium");
    expect(computeWebsiteQuality("https://a.es", 90, true)).toBe("none");
  });

  it("picks the first matching rule and adds extras from opportunities", () => {
    const rec = recommendPricing({ potential: "high", quality: "low", sectorTier: "high", opportunityKeys: ["no_booking", "poor_seo_metadata", "no_whatsapp", "no_booking"], rules, services });
    expect(rec.packageName).toBe("Premium website redesign");
    expect(rec.setup).toBe(2500);
    expect(rec.monthly).toBe(200);
    expect(rec.extras.map((e) => e.slug)).toEqual(["booking-system", "seo-local", "whatsapp-integration"]);
    expect(rec.firstYearValue).toBe(2500 + 200 * 12);
  });

  it("falls back when nothing matches and skips inactive rules", () => {
    const rec = recommendPricing({ potential: "high", quality: "none", sectorTier: null, opportunityKeys: [], rules: rules.map((r) => ({ ...r, is_active: false })), services, fallback: { setup: 1000, monthly: 80 } });
    expect(rec.ruleId).toBeNull();
    expect(rec.setup).toBe(1000);
  });
});

const ctx: LeadContext = {
  company: {
    id: "c1", name: "Autoescuela Rápida", city: "Cádiz", province: "Cádiz", sector: "Autoescuelas", subsector: null,
    website: null, domain: null, phone: "+34956000000", email: "info@rapida.example", google_rating: 4.6, google_reviews_count: 320,
    instagram_url: null, description: null, services_offered: [], employees_estimate: 6,
  },
  contact: { name: "Laura Gómez", role: "Directora", email: null, phone: null },
  sector: { name: "Autoescuelas", value_tier: "high", booking_relevant: true, whatsapp_relevant: true, common_problems: [], sales_arguments: ["Cada alumno vale cientos de euros: un par de matrículas al mes pagan la web"] },
  lead: { id: "l1", score: 88, priority: "hot", factors: [] },
  audit: null,
  pricing: recommendPricing({
    potential: "high", quality: "none", sectorTier: "high", opportunityKeys: ["no_booking"],
    rules: DEFAULT_PRICING_RULES.map((r, i) => ({ ...r, id: `r${i}`, is_active: true })), services: DEFAULT_SERVICES.map((s) => ({ ...s, is_active: true })),
  }),
  sender: { name: "Gonzalo", company: "WIRE" },
};

describe("templates", () => {
  it("renders variables and reports missing/unknown ones", () => {
    const { output, missing } = renderTemplate("Hola {{ contact_name }} de {{company_name}} {{foo}}", { contact_name: "Laura", company_name: "X" });
    expect(output).toBe("Hola Laura de X {{foo}}");
    expect(missing).toEqual(["foo"]);
    expect(unknownVariables("{{company_name}} {{nope}}")).toEqual(["nope"]);
  });

  it("builds values from real lead data", () => {
    const values = buildTemplateValues(ctx);
    expect(values.contact_name).toBe("Laura");
    expect(values.main_problem).toContain("320 reseñas");
    expect(values.recommended_service).toBe("Premium website (new)");
  });
});

describe("outreach generators", () => {
  it("writes data-driven emails, never agency boilerplate", () => {
    const emails = generateEmails(ctx);
    expect(emails.map((e) => e.variant)).toEqual(["direct", "professional", "high_ticket", "follow_up"]);
    for (const e of emails) {
      expect(e.body).toContain("Autoescuela Rápida");
      expect(e.body).not.toMatch(/somos una agencia/i);
      expect(e.body).toContain("Hola Laura,");
    }
    expect(emails[0].body).toContain("He estado revisando Autoescuela Rápida");
    expect(emails[0].body).toContain("320 reseñas");
    expect(emails[2].body).toContain("€");
  });

  it("writes short WhatsApp messages", () => {
    const [opener] = generateWhatsApp(ctx);
    expect(opener.body.startsWith("Hola, Laura.")).toBe(true);
    expect(opener.body.length).toBeLessThan(450);
  });

  it("explains why the lead matters and what to sell", () => {
    const a = analyzeOpportunity(ctx);
    expect(a.recommendedOffer.setup).toBe(2400);
    expect(a.whyNow.join(" ")).toMatch(/320 Google reviews/);
    expect(a.estimatedValue.firstYear).toBe(2400 + 180 * 12);
    expect(a.extras[0].label).toBe("Online booking system");
  });

  it("builds a complete proposal", () => {
    const p = buildProposal(ctx);
    expect(p.title).toBe("Propuesta para Autoescuela Rápida");
    expect(p.problems.length).toBeGreaterThan(0);
    expect(p.features).toContain("Sistema de reservas online con recordatorios");
    expect(p.investment.setup).toBe(2400);
    expect(p.timeline).toHaveLength(4);
  });
});
