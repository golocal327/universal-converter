import { z } from "zod";
import {
  collapseWhitespace,
  nameCityKey,
  normalizeEmail,
  normalizePhone,
  normalizePlace,
  normalizeSocialUrl,
  normalizeWebsite,
  parseInteger,
  parseNumber,
} from "./normalize";

/**
 * A raw lead as produced by any source adapter (CSV row, API payload,
 * Google Places result, manual form). Everything is optional and untrusted.
 */
export type RawLead = {
  company_name?: unknown;
  legal_name?: unknown;
  sector?: unknown;
  subsector?: unknown;
  city?: unknown;
  province?: unknown;
  country?: unknown;
  address?: unknown;
  postal_code?: unknown;
  phone?: unknown;
  email?: unknown;
  website?: unknown;
  instagram?: unknown;
  facebook?: unknown;
  linkedin?: unknown;
  google_maps_url?: unknown;
  google_place_id?: unknown;
  rating?: unknown;
  reviews?: unknown;
  last_review_at?: unknown;
  employees?: unknown;
  description?: unknown;
  services?: unknown;
  opening_hours?: unknown;
  contact_name?: unknown;
  contact_role?: unknown;
  contact_email?: unknown;
  contact_phone?: unknown;
  notes?: unknown;
  source_ref?: unknown;
};

const str = (v: unknown, max = 500): string | null => {
  if (v === null || v === undefined) return null;
  const s = collapseWhitespace(String(v));
  return s ? s.slice(0, max) : null;
};

const dateStr = (v: unknown): string | null => {
  const s = str(v, 40);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

/** Canonical lead record ready for de-duplication and insertion. */
export const normalizedLeadSchema = z.object({
  name: z.string().min(1, "Company name is required").max(200),
  legal_name: z.string().max(200).nullable(),
  sector: z.string().max(120).nullable(),
  subsector: z.string().max(120).nullable(),
  city: z.string().max(120).nullable(),
  province: z.string().max(120).nullable(),
  country: z.string().length(2),
  address: z.string().max(300).nullable(),
  postal_code: z.string().max(12).nullable(),
  phone: z.string().max(40).nullable(),
  phone_normalized: z.string().max(20).nullable(),
  email: z.string().email().nullable(),
  website: z.string().url().nullable(),
  domain: z.string().max(253).nullable(),
  instagram_url: z.string().url().nullable(),
  facebook_url: z.string().url().nullable(),
  linkedin_url: z.string().url().nullable(),
  google_maps_url: z.string().url().nullable(),
  google_place_id: z.string().max(200).nullable(),
  google_rating: z.number().min(0).max(5).nullable(),
  google_reviews_count: z.number().int().min(0).nullable(),
  google_last_review_at: z.string().nullable(),
  employees_estimate: z.number().int().min(0).max(1_000_000).nullable(),
  description: z.string().max(4000).nullable(),
  services_offered: z.array(z.string().max(120)).max(50),
  opening_hours: z.string().max(500).nullable(),
  contact_name: z.string().max(160).nullable(),
  contact_role: z.string().max(120).nullable(),
  contact_email: z.string().email().nullable(),
  contact_phone: z.string().max(40).nullable(),
  notes: z.string().max(4000).nullable(),
  source_ref: z.string().max(200).nullable(),
  name_key: z.string(),
});
export type NormalizedLead = z.infer<typeof normalizedLeadSchema>;

export type ValidationOutcome =
  | { ok: true; lead: NormalizedLead; warnings: string[] }
  | { ok: false; errors: string[] };

/** Normalize + validate one raw lead. Invalid optional fields are dropped with a warning, not fatal. */
export function normalizeLead(raw: RawLead, defaultCountry = "ES"): ValidationOutcome {
  const warnings: string[] = [];
  const name = str(raw.company_name, 200);
  if (!name) return { ok: false, errors: ["Missing company name"] };

  const websiteRaw = str(raw.website, 500);
  const website = normalizeWebsite(websiteRaw);
  let instagram = normalizeSocialUrl(str(raw.instagram), "instagram");
  let facebook = normalizeSocialUrl(str(raw.facebook), "facebook");
  if (websiteRaw && !website) {
    // A social URL in the website column is common in scraped data.
    if (!instagram && /instagram\.com/i.test(websiteRaw)) instagram = normalizeSocialUrl(websiteRaw, "instagram");
    else if (!facebook && /facebook\.com/i.test(websiteRaw)) facebook = normalizeSocialUrl(websiteRaw, "facebook");
    else warnings.push(`Ignored invalid website "${websiteRaw}"`);
  }

  const emailRaw = str(raw.email, 254);
  const email = normalizeEmail(emailRaw);
  if (emailRaw && !email) warnings.push(`Ignored invalid email "${emailRaw}"`);

  const phone = str(raw.phone, 40);
  const country = (str(raw.country, 2) ?? defaultCountry).toUpperCase();
  const phoneNormalized = normalizePhone(phone, country);
  if (phone && !phoneNormalized) warnings.push(`Could not normalize phone "${phone}"`);

  let rating = parseNumber(raw.rating);
  if (rating !== null && (rating < 0 || rating > 5)) {
    warnings.push(`Ignored out-of-range rating ${rating}`);
    rating = null;
  }

  const servicesRaw = raw.services;
  const services = Array.isArray(servicesRaw)
    ? servicesRaw.map((s) => str(s, 120)).filter((s): s is string => Boolean(s))
    : (str(servicesRaw, 2000) ?? "")
        .split(/[;,|]/)
        .map((s) => collapseWhitespace(s))
        .filter(Boolean)
        .slice(0, 50);

  const mapsRaw = str(raw.google_maps_url, 1000);
  const city = normalizePlace(str(raw.city, 120));

  const candidate = {
    name,
    legal_name: str(raw.legal_name, 200),
    sector: str(raw.sector, 120),
    subsector: str(raw.subsector, 120),
    city,
    province: normalizePlace(str(raw.province, 120)),
    country: /^[A-Z]{2}$/.test(country) ? country : defaultCountry,
    address: str(raw.address, 300),
    postal_code: str(raw.postal_code, 12),
    phone,
    phone_normalized: phoneNormalized,
    email,
    website: website?.website ?? null,
    domain: website?.domain ?? null,
    instagram_url: instagram,
    facebook_url: facebook,
    linkedin_url: normalizeSocialUrl(str(raw.linkedin), "linkedin"),
    google_maps_url: mapsRaw && /^https?:\/\//.test(mapsRaw) ? mapsRaw : null,
    google_place_id: str(raw.google_place_id, 200),
    google_rating: rating === null ? null : Math.round(rating * 10) / 10,
    google_reviews_count: parseInteger(raw.reviews),
    google_last_review_at: dateStr(raw.last_review_at),
    employees_estimate: parseInteger(raw.employees),
    description: str(raw.description, 4000),
    services_offered: services,
    opening_hours: str(raw.opening_hours, 500),
    contact_name: str(raw.contact_name, 160),
    contact_role: str(raw.contact_role, 120),
    contact_email: normalizeEmail(str(raw.contact_email, 254)),
    contact_phone: str(raw.contact_phone, 40),
    notes: str(raw.notes, 4000),
    source_ref: str(raw.source_ref, 200),
    name_key: nameCityKey(name, city),
  };

  const parsed = normalizedLeadSchema.safeParse(candidate);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  }
  return { ok: true, lead: parsed.data, warnings };
}
