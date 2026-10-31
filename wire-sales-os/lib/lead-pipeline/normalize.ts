/**
 * Normalizer: turns messy input from any lead source into canonical values.
 * Pure functions — no I/O — so every source (CSV, API, Places, manual form)
 * shares exactly the same rules.
 */

const SOCIAL_HOSTS = ["facebook.com", "instagram.com", "linkedin.com", "twitter.com", "x.com", "tiktok.com", "youtube.com", "wa.me"];
const LEGAL_SUFFIXES = /\b(s\.?\s?l\.?\s?u?\.?|s\.?\s?a\.?\s?u?\.?|s\.?\s?c\.?|s\.?\s?l\.?\s?l\.?|sll|slu|sociedad limitada|sociedad anonima|c\.?\s?b\.?|ltd|llc|inc|gmbh)\.?$/i;

export function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** "  sevilla " → "Sevilla", "SAN FERNANDO" → "San Fernando". Keeps short connectors lowercase. */
export function normalizePlace(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = collapseWhitespace(raw);
  if (!cleaned) return null;
  const lowerWords = new Set(["de", "del", "la", "las", "los", "el", "y"]);
  return cleaned
    .toLowerCase()
    .split(" ")
    .map((word, i) => (i > 0 && lowerWords.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

export function isSocialUrl(url: string): boolean {
  try {
    const host = new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
    return SOCIAL_HOSTS.some((s) => host === s || host.endsWith(`.${s}`));
  } catch {
    return false;
  }
}

export type NormalizedWebsite = { website: string; domain: string };

/**
 * Canonical website URL + registrable-ish domain (www. stripped).
 * Returns null for empty, invalid or social-network URLs (those are not a website).
 */
export function normalizeWebsite(raw: string | null | undefined): NormalizedWebsite | null {
  if (!raw) return null;
  let value = collapseWhitespace(raw);
  if (!value || /^(n\/?a|none|no|sin web|-+)$/i.test(value)) return null;
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(url.protocol)) return null;
  const host = url.hostname.toLowerCase();
  if (!host.includes(".") || host.endsWith(".")) return null;
  if (isSocialUrl(url.toString())) return null;
  const domain = host.replace(/^www\./, "");
  const path = url.pathname.replace(/\/+$/, "");
  return { website: `${url.protocol}//${host}${path}${url.search}`, domain };
}

/**
 * Phone → E.164-like string. Spanish numbers are the default market:
 * 9 digits starting with 6/7/8/9 get the +34 prefix.
 */
export function normalizePhone(raw: string | null | undefined, defaultCountry = "ES"): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let digits = trimmed.replace(/[^\d+]/g, "");
  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;
  const hasPlus = digits.startsWith("+");
  digits = digits.replace(/\+/g, "");
  if (digits.length < 6 || digits.length > 15) return null;
  if (hasPlus) return `+${digits}`;
  if (defaultCountry === "ES") {
    if (digits.length === 11 && digits.startsWith("34")) return `+${digits}`;
    if (digits.length === 9 && /^[6789]/.test(digits)) return `+34${digits}`;
  }
  return digits.length >= 9 ? `+${digits}` : null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim().toLowerCase().replace(/^mailto:/, "");
  return EMAIL_RE.test(value) ? value : null;
}

/** Social profile URL normalizer: accepts @handles for Instagram. */
export function normalizeSocialUrl(raw: string | null | undefined, network: "instagram" | "facebook" | "linkedin"): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;
  if (network === "instagram" && /^@?[a-z0-9._]{1,30}$/i.test(value)) {
    return `https://www.instagram.com/${value.replace(/^@/, "")}`;
  }
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    if (!url.hostname.includes(network)) return null;
    return `https://${url.hostname.toLowerCase()}${url.pathname.replace(/\/+$/, "")}`;
  } catch {
    return null;
  }
}

/** Remove legal suffixes and punctuation for fuzzy identity matching. */
export function canonicalCompanyName(name: string): string {
  let value = stripAccents(collapseWhitespace(name).toLowerCase());
  value = value.replace(/[,]/g, " ");
  for (let i = 0; i < 2; i++) value = collapseWhitespace(value.replace(LEGAL_SUFFIXES, ""));
  return value.replace(/[^a-z0-9]+/g, " ").trim();
}

/** Dedup key for "same business in the same city". */
export function nameCityKey(name: string, city: string | null | undefined): string {
  const place = city ? stripAccents(city.toLowerCase()).replace(/[^a-z0-9]+/g, " ").trim() : "";
  return `${canonicalCompanyName(name)}|${place}`;
}

export function parseNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const cleaned = String(raw).trim().replace(/\s/g, "");
  // Accept 1.234,5 / 1.234 (es thousands) and 1,234.5 (en).
  let normalized: string;
  if (/,\d{1,2}$/.test(cleaned)) normalized = cleaned.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(cleaned)) normalized = cleaned.replace(/\./g, "");
  else normalized = cleaned.replace(/,/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function parseInteger(raw: unknown): number | null {
  const n = parseNumber(raw);
  return n === null ? null : Math.max(0, Math.round(n));
}

export function slugify(value: string): string {
  return stripAccents(value.toLowerCase())
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}
