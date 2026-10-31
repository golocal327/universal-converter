import { z } from "zod";
import { CONTACT_STATUSES, LEAD_SOURCES, LEAD_STATUSES, PRIORITIES, STAGE_KEYS, WEBSITE_STATES } from "@/lib/domain/constants";

/** Lead list filters — parsed from URL search params, stored as JSON in saved_filters. */
const num = (min: number, max: number) =>
  z.preprocess((v) => (v === "" || v === undefined || v === null ? undefined : Number(v)), z.number().min(min).max(max).optional());
const opt = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess((v) => (v === "" || v === "all" ? undefined : v), z.enum(values).optional());
const text = (max: number) => z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined), z.string().optional());
const uuid = z.preprocess((v) => (v === "" || v === "all" ? undefined : v), z.string().uuid().optional());

export const LEAD_SORTS = ["score", "created", "reviews", "rating", "name", "website_score", "follow_up"] as const;

export const leadFiltersSchema = z.object({
  q: text(80),
  sector: uuid,
  city: text(80),
  province: text(80),
  priority: opt(PRIORITIES),
  status: opt(LEAD_STATUSES),
  stage: opt([...STAGE_KEYS, "none"] as const),
  website: opt(WEBSITE_STATES),
  contact: opt(CONTACT_STATUSES),
  source: opt(LEAD_SOURCES),
  campaign: uuid,
  min_score: num(0, 100),
  max_score: num(0, 100),
  max_website_score: num(0, 100),
  min_reviews: num(0, 1_000_000),
  max_reviews: num(0, 1_000_000),
  min_rating: num(0, 5),
  sort: opt(LEAD_SORTS),
  dir: opt(["asc", "desc"] as const),
  page: num(1, 10_000),
  per: z.preprocess((v) => (v === undefined || v === "" ? undefined : Number(v)), z.union([z.literal(25), z.literal(50), z.literal(100)]).optional()),
});
export type LeadFilters = z.infer<typeof leadFiltersSchema>;

export function parseLeadFilters(params: Record<string, string | string[] | undefined>): LeadFilters {
  const flat = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const parsed = leadFiltersSchema.safeParse(flat);
  if (parsed.success) return parsed.data;
  // Drop only the invalid keys instead of discarding every filter.
  const bad = new Set(parsed.error.issues.map((i) => String(i.path[0])));
  return leadFiltersSchema.parse(Object.fromEntries(Object.entries(flat).filter(([k]) => !bad.has(k))));
}

/** Serialize filters back to a query string (omitting defaults). */
export function leadFiltersToQuery(filters: Partial<LeadFilters>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  return params.toString();
}

export function activeFilterCount(filters: LeadFilters): number {
  const ignore = new Set(["sort", "dir", "page", "per"]);
  return Object.entries(filters).filter(([k, v]) => !ignore.has(k) && v !== undefined).length;
}

const SORT_COLUMN: Record<(typeof LEAD_SORTS)[number], string> = {
  score: "score",
  created: "created_at",
  reviews: "google_reviews_count",
  rating: "google_rating",
  name: "company_name",
  website_score: "website_score",
  follow_up: "next_follow_up_at",
};

/** Minimal query-builder surface we need (keeps this module free of server-only imports). */
type FilterableQuery<Q> = {
  eq(column: string, value: unknown): Q;
  gte(column: string, value: unknown): Q;
  lte(column: string, value: unknown): Q;
  ilike(column: string, value: string): Q;
  or(filters: string): Q;
  is(column: string, value: null): Q;
  contains(column: string, value: unknown): Q;
  order(column: string, options: { ascending: boolean; nullsFirst?: boolean }): Q;
  range(from: number, to: number): Q;
};

/** PostgREST `or()` values must escape commas/parentheses; we strip them instead. */
export function sanitizeSearch(q: string) {
  return q.replace(/[%,()*\\]/g, " ").replace(/\s+/g, " ").trim();
}

export function applyLeadFilters<Q extends FilterableQuery<Q>>(query: Q, f: LeadFilters): Q {
  let q = query;
  if (f.q) {
    const s = sanitizeSearch(f.q);
    if (s) q = q.or(`company_name.ilike.%${s}%,city.ilike.%${s}%,domain.ilike.%${s}%,email.ilike.%${s}%,contact_name.ilike.%${s}%`);
  }
  if (f.sector) q = q.eq("sector_id", f.sector);
  if (f.city) q = q.ilike("city", sanitizeSearch(f.city));
  if (f.province) q = q.ilike("province", sanitizeSearch(f.province));
  if (f.priority) q = q.eq("priority", f.priority);
  if (f.status) q = q.eq("status", f.status);
  if (f.stage === "none") q = q.is("stage_key", null);
  else if (f.stage) q = q.eq("stage_key", f.stage);
  if (f.website) q = q.eq("website_state", f.website);
  if (f.contact) q = q.eq("contact_status", f.contact);
  if (f.source) q = q.eq("source", f.source);
  if (f.campaign) q = q.contains("campaign_ids", [f.campaign]);
  if (f.min_score !== undefined) q = q.gte("score", f.min_score);
  if (f.max_score !== undefined) q = q.lte("score", f.max_score);
  if (f.max_website_score !== undefined) q = q.lte("website_score", f.max_website_score);
  if (f.min_reviews !== undefined) q = q.gte("google_reviews_count", f.min_reviews);
  if (f.max_reviews !== undefined) q = q.lte("google_reviews_count", f.max_reviews);
  if (f.min_rating !== undefined) q = q.gte("google_rating", f.min_rating);
  const sort = f.sort ?? "score";
  const ascending = (f.dir ?? (sort === "name" || sort === "follow_up" ? "asc" : "desc")) === "asc";
  q = q.order(SORT_COLUMN[sort], { ascending, nullsFirst: false });
  if (sort !== "created") q = q.order("created_at", { ascending: false });
  const per = f.per ?? 50;
  const page = f.page ?? 1;
  return q.range((page - 1) * per, page * per - 1);
}
