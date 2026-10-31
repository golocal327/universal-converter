import { detectProblems, firstName, type LeadContext } from "@/lib/outreach/context";

/** Variables available in email/WhatsApp templates. */
export const TEMPLATE_VARIABLES = [
  { key: "company_name", label: "Company name" },
  { key: "contact_name", label: "Contact first name" },
  { key: "city", label: "City" },
  { key: "sector", label: "Sector" },
  { key: "website", label: "Website" },
  { key: "website_score", label: "Website score" },
  { key: "lead_score", label: "Lead score" },
  { key: "main_problem", label: "Main problem detected" },
  { key: "recommended_service", label: "Recommended service" },
  { key: "google_reviews", label: "Google reviews count" },
  { key: "google_rating", label: "Google rating" },
  { key: "sender_name", label: "Your name" },
] as const;
export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number]["key"];

const VARIABLE_RE = /\{\{\s*([a-z_]+)\s*\}\}/g;

export function extractVariables(text: string): string[] {
  return [...new Set([...text.matchAll(VARIABLE_RE)].map((m) => m[1]))];
}

export function unknownVariables(text: string): string[] {
  const known = new Set<string>(TEMPLATE_VARIABLES.map((v) => v.key));
  return extractVariables(text).filter((v) => !known.has(v));
}

/** Replace {{variables}}; returns the list of variables that had no value. */
export function renderTemplate(text: string, values: Partial<Record<string, string | number | null | undefined>>) {
  const missing: string[] = [];
  const output = text.replace(VARIABLE_RE, (match, key: string) => {
    const value = values[key];
    if (value === null || value === undefined || value === "") {
      missing.push(key);
      return match;
    }
    return String(value);
  });
  return { output, missing: [...new Set(missing)] };
}

/** Build template values from a lead context, with sensible Spanish fallbacks. */
export function buildTemplateValues(ctx: LeadContext): Record<TemplateVariable, string> {
  const problem = detectProblems(ctx)[0];
  return {
    company_name: ctx.company.name,
    contact_name: firstName(ctx.contact?.name) ?? "equipo",
    city: ctx.company.city ?? "vuestra zona",
    sector: ctx.sector?.name ?? ctx.company.sector ?? "vuestro sector",
    website: ctx.company.website ?? "sin web",
    website_score: ctx.audit?.overall !== null && ctx.audit?.overall !== undefined ? String(ctx.audit.overall) : "—",
    lead_score: ctx.lead ? String(ctx.lead.score) : "—",
    main_problem: problem?.sentence ?? "hay margen claro para convertir más visitas en clientes",
    recommended_service: ctx.pricing?.packageName ?? "una mejora de vuestra presencia digital",
    google_reviews: ctx.company.google_reviews_count !== null ? String(ctx.company.google_reviews_count) : "—",
    google_rating: ctx.company.google_rating !== null ? String(ctx.company.google_rating) : "—",
    sender_name: ctx.sender.name,
  };
}
