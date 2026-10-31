import type { Priority, ValueTier } from "@/lib/domain/constants";

/**
 * Lead scoring engine (0–100) with a visible, itemized explanation.
 *
 * The score answers "how attractive is this business for WIRE right now?":
 * a high score means a real need (weak/no website, missing booking…) AND the
 * capacity to pay (established demand, team size, high-value sector).
 * Every point comes from a named factor so the UI can show the breakdown.
 */
export const SCORING_ENGINE_VERSION = "2026.10-1";

export type ScoreCategory = "website" | "google" | "social" | "business" | "penalty";

export type ScoreFactor = {
  key: string;
  label: string;
  points: number;
  category: ScoreCategory;
  detail?: string;
};

export type ScoreResult = {
  score: number;
  priority: Priority;
  factors: ScoreFactor[];
  categoryTotals: Record<ScoreCategory, number>;
  engineVersion: string;
};

/** Website signals extracted by the audit engine (subset needed for scoring). */
export type AuditSignals = {
  status: "completed" | "failed" | "pending";
  errorKind?: "dns" | "timeout" | "http" | "blocked" | "network" | null;
  httpStatus?: number | null;
  https?: boolean;
  responseTimeMs?: number | null;
  performanceScore?: number | null;
  seoScore?: number | null;
  mobileScore?: number | null;
  overallScore?: number | null;
  hasCta?: boolean;
  hasBooking?: boolean;
  hasWhatsapp?: boolean;
  outdated?: boolean;
};

export type ScoringInput = {
  company: {
    website?: string | null;
    phone?: string | null;
    email?: string | null;
    city?: string | null;
    province?: string | null;
    google_rating?: number | null;
    google_reviews_count?: number | null;
    google_last_review_at?: string | null;
    instagram_url?: string | null;
    instagram_followers?: number | null;
    instagram_last_post_at?: string | null;
    facebook_url?: string | null;
    linkedin_url?: string | null;
    employees_estimate?: number | null;
    growth_signals?: string[] | null;
  };
  sector?: {
    name?: string | null;
    value_tier?: ValueTier | null;
    booking_relevant?: boolean | null;
    whatsapp_relevant?: boolean | null;
    score_weights?: Partial<Record<Exclude<ScoreCategory, "penalty">, number>> | null;
  } | null;
  audit?: AuditSignals | null;
  config?: ScoringConfig;
  now?: Date;
};

export type ScoringConfig = {
  /** Cities or provinces WIRE actively targets (case-insensitive). */
  targetLocations?: string[];
  hotThreshold?: number;
  warmThreshold?: number;
};

const CATEGORY_CAPS: Record<Exclude<ScoreCategory, "penalty">, number> = {
  website: 45,
  google: 30,
  social: 12,
  business: 30,
};

const DAY_MS = 86_400_000;

function daysSince(date: string | null | undefined, now: Date): number | null {
  if (!date) return null;
  const t = new Date(date).getTime();
  return Number.isNaN(t) ? null : Math.floor((now.getTime() - t) / DAY_MS);
}

function websiteFactors(input: ScoringInput): ScoreFactor[] {
  const { company, audit, sector } = input;
  const f: ScoreFactor[] = [];
  const add = (key: string, label: string, points: number, detail?: string) =>
    f.push({ key, label, points, category: "website", detail });

  if (!company.website) {
    add("no_website", "No website", 25, "Every visitor from Google or Instagram has nowhere to convert.");
    return f;
  }
  if (!audit || audit.status === "pending") {
    add("not_audited", "Website not audited yet", 0, "Run a website audit to score the site.");
    return f;
  }
  if (audit.status === "failed") {
    if (audit.errorKind === "dns") add("website_missing", "Website domain does not resolve", 24, "The listed website does not exist anymore.");
    else if (audit.errorKind === "blocked") add("website_blocked", "Website could not be analysed", 0, "The site blocked the audit or is not public.");
    else add("website_broken", "Website broken or unreachable", 22, audit.httpStatus ? `HTTP ${audit.httpStatus}` : "No response");
    return f;
  }
  if (audit.https === false) add("no_https", "No HTTPS", 8, "Browsers show 'Not secure'.");
  if (audit.outdated) add("outdated", "Outdated website", 10, "Old design or technology signals.");
  const slow = (audit.responseTimeMs ?? 0) > 3000 || (audit.performanceScore ?? 100) < 50;
  if (slow) add("slow", "Slow website", 8, audit.responseTimeMs ? `${(audit.responseTimeMs / 1000).toFixed(1)}s response` : undefined);
  if ((audit.mobileScore ?? 100) < 50) add("poor_mobile", "Poor mobile experience", 9, `Mobile score ${audit.mobileScore}/100`);
  if ((audit.seoScore ?? 100) < 50) add("weak_seo", "Weak SEO structure", 6, `SEO score ${audit.seoScore}/100`);
  if (audit.hasCta === false) add("no_cta", "No clear call-to-action", 6);
  if (sector?.booking_relevant && audit.hasBooking === false) add("no_booking", "No online booking", 12, "Booking matters in this sector.");
  if (sector?.whatsapp_relevant && audit.hasWhatsapp === false) add("no_whatsapp", "No WhatsApp contact", 5);
  return f;
}

function googleFactors(input: ScoringInput, now: Date): ScoreFactor[] {
  const { company, audit } = input;
  const f: ScoreFactor[] = [];
  const add = (key: string, label: string, points: number, detail?: string) =>
    f.push({ key, label, points, category: "google", detail });
  const reviews = company.google_reviews_count;
  const rating = company.google_rating;

  if (reviews !== null && reviews !== undefined) {
    if (reviews >= 500) add("reviews_500", "500+ Google reviews", 15, "Established business with steady demand.");
    else if (reviews >= 200) add("reviews_200", "200+ Google reviews", 12, "Established business.");
    else if (reviews >= 50) add("reviews_50", "50+ Google reviews", 8);
    else if (reviews >= 10) add("reviews_10", "Some Google reviews", 4);
    else add("reviews_few", "Few Google reviews", 2, "Early-stage: reputation system opportunity.");
  }
  if (rating !== null && rating !== undefined && (reviews ?? 0) >= 10) {
    if (rating < 4.0) add("low_rating", "Low Google rating", 6, `${rating}★ — reputation opportunity`);
    else if (rating >= 4.5 && (reviews ?? 0) >= 100) add("great_rating", "Excellent reputation at scale", 5, `${rating}★ — strong capacity to pay`);
  }
  const weakSite = !company.website || audit?.status === "failed" || (audit?.overallScore ?? 100) < 50;
  if ((reviews ?? 0) >= 100 && weakSite) {
    add("weak_conversion", "Weak Google conversion", 10, "Strong Google demand, weak digital conversion.");
  }
  const sinceReview = daysSince(company.google_last_review_at, now);
  if (sinceReview !== null && sinceReview > 180) add("stale_reviews", "No recent Google reviews", -8, `Last review ${sinceReview} days ago`);
  return f;
}

function socialFactors(input: ScoringInput, now: Date): ScoreFactor[] {
  const { company } = input;
  const f: ScoreFactor[] = [];
  const add = (key: string, label: string, points: number, detail?: string) =>
    f.push({ key, label, points, category: "social", detail });

  if (company.instagram_url) {
    const since = daysSince(company.instagram_last_post_at, now);
    if (since !== null && since <= 30) add("instagram_active", "Instagram active", 8, "Already invests in marketing.");
    else if (since !== null && since > 120) add("instagram_abandoned", "Instagram abandoned", 5, `Last post ${since} days ago`);
    else if ((company.instagram_followers ?? 0) >= 1000) add("instagram_audience", "Instagram audience", 6, `${company.instagram_followers} followers`);
  } else if (!company.facebook_url && !company.linkedin_url) {
    if (!company.website) add("minimal_presence", "Minimal digital presence", 6, "No website and no social profiles.");
    else add("weak_social", "Weak social presence", 4);
  }
  return f;
}

function businessFactors(input: ScoringInput): ScoreFactor[] {
  const { company, sector, config } = input;
  const f: ScoreFactor[] = [];
  const add = (key: string, label: string, points: number, detail?: string) =>
    f.push({ key, label, points, category: "business", detail });

  if (sector?.value_tier === "high") add("sector_high", "High-value sector", 12, sector.name ?? undefined);
  else if (sector?.value_tier === "medium") add("sector_medium", "Mid-value sector", 6, sector.name ?? undefined);
  else if (sector?.value_tier === "low") add("sector_low", "Low-value sector", 2, sector.name ?? undefined);

  const employees = company.employees_estimate ?? 0;
  if (employees >= 20) add("team_20", "20+ employees", 10);
  else if (employees >= 10) add("team_10", "10+ employees", 8);
  else if (employees >= 5) add("team_5", "5+ employees", 5);
  else if (employees >= 2) add("team_2", "Small team", 2);

  const signals = (company.growth_signals ?? []).slice(0, 3);
  for (const s of signals) add(`growth_${s.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`, `Growth signal: ${s}`, 3);

  const targets = (config?.targetLocations ?? []).map((t) => t.toLowerCase().trim()).filter(Boolean);
  const place = [company.city, company.province].filter(Boolean).map((p) => (p as string).toLowerCase());
  if (targets.length && place.some((p) => targets.includes(p))) add("target_area", "In target area", 4);
  return f;
}

function penaltyFactors(input: ScoringInput): ScoreFactor[] {
  const { company } = input;
  if (!company.phone && !company.email && !company.website && !company.instagram_url) {
    return [{ key: "no_channel", label: "No contact channel", points: -15, category: "penalty", detail: "Add a phone, email or social profile." }];
  }
  return [];
}

export function priorityFor(score: number, config?: ScoringConfig): Priority {
  const hot = config?.hotThreshold ?? 75;
  const warm = config?.warmThreshold ?? 50;
  return score >= hot ? "hot" : score >= warm ? "warm" : "cold";
}

export function scoreLead(input: ScoringInput): ScoreResult {
  const now = input.now ?? new Date();
  const weights = input.sector?.score_weights ?? {};
  const raw = [
    ...websiteFactors(input),
    ...googleFactors(input, now),
    ...socialFactors(input, now),
    ...businessFactors(input),
    ...penaltyFactors(input),
  ];

  // Apply sector weight multipliers, then cap each category so no single
  // dimension can dominate the score.
  const factors: ScoreFactor[] = raw.map((factor) => {
    if (factor.category === "penalty") return factor;
    const w = weights[factor.category];
    const multiplier = typeof w === "number" && w >= 0 && w <= 3 ? w : 1;
    return { ...factor, points: Math.round(factor.points * multiplier) };
  });

  const categoryTotals: Record<ScoreCategory, number> = { website: 0, google: 0, social: 0, business: 0, penalty: 0 };
  for (const factor of factors) categoryTotals[factor.category] += factor.points;
  for (const cat of Object.keys(CATEGORY_CAPS) as (keyof typeof CATEGORY_CAPS)[]) {
    categoryTotals[cat] = Math.min(categoryTotals[cat], CATEGORY_CAPS[cat]);
  }

  const total = Object.values(categoryTotals).reduce((a, b) => a + b, 0);
  const score = Math.max(0, Math.min(100, Math.round(total)));
  return {
    score,
    priority: priorityFor(score, input.config),
    factors: factors.filter((x) => x.points !== 0 || x.key === "not_audited").sort((a, b) => b.points - a.points),
    categoryTotals,
    engineVersion: SCORING_ENGINE_VERSION,
  };
}
