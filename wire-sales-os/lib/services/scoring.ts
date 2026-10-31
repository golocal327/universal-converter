import "server-only";
import type { AuditSignalsDetail } from "@/lib/audit/analyzer";
import type { ValueTier } from "@/lib/domain/constants";
import { scoreLead, type AuditSignals, type ScoreResult } from "@/lib/scoring/engine";
import type { Json } from "@/lib/supabase/database.types";
import { logActivity } from "./activity";
import { emitEvent } from "./events";
import { loadSettings } from "./settings";
import type { Actor } from "./types";

type AuditRow = {
  company_id: string;
  status: "pending" | "completed" | "failed";
  error_kind: string | null;
  http_status: number | null;
  response_time_ms: number | null;
  performance_score: number | null;
  seo_score: number | null;
  mobile_score: number | null;
  overall_score: number | null;
  signals: Json;
  created_at: string;
};

export function auditRowToSignals(audit: AuditRow | null | undefined): AuditSignals | null {
  if (!audit) return null;
  const s = (audit.signals ?? {}) as Partial<AuditSignalsDetail>;
  return {
    status: audit.status,
    errorKind: (audit.error_kind as AuditSignals["errorKind"]) ?? null,
    httpStatus: audit.http_status,
    https: s.https,
    responseTimeMs: audit.response_time_ms,
    performanceScore: audit.performance_score,
    seoScore: audit.seo_score,
    mobileScore: audit.mobile_score,
    overallScore: audit.overall_score,
    hasCta: s.hasCta,
    hasBooking: s.hasBooking,
    hasWhatsapp: s.hasWhatsapp,
    outdated: s.outdated,
  };
}

/**
 * Recompute and persist scores for the given leads (by company id).
 * Writes a lead_scores history row, updates the cached score on the lead,
 * and logs timeline + automation events.
 */
export async function rescoreCompanies(actor: Actor, companyIds: string[], options: { silent?: boolean } = {}): Promise<Map<string, ScoreResult>> {
  const results = new Map<string, ScoreResult>();
  if (!companyIds.length) return results;
  const settings = await loadSettings(actor.db, actor.workspaceId);

  for (let i = 0; i < companyIds.length; i += 200) {
    const chunk = companyIds.slice(i, i + 200);
    const [{ data: companies }, { data: leads }, { data: audits }] = await Promise.all([
      actor.db
        .from("companies")
        .select("id, website, phone, email, city, province, google_rating, google_reviews_count, google_last_review_at, instagram_url, instagram_followers, instagram_last_post_at, facebook_url, linkedin_url, employees_estimate, growth_signals, sector:sectors(name, value_tier, booking_relevant, whatsapp_relevant, score_weights)")
        .eq("workspace_id", actor.workspaceId)
        .in("id", chunk),
      actor.db.from("leads").select("id, company_id, score").eq("workspace_id", actor.workspaceId).in("company_id", chunk),
      actor.db
        .from("website_audits")
        .select("company_id, status, error_kind, http_status, response_time_ms, performance_score, seo_score, mobile_score, overall_score, signals, created_at")
        .eq("workspace_id", actor.workspaceId)
        .in("company_id", chunk)
        .neq("status", "pending")
        .order("created_at", { ascending: false }),
    ]);

    const latestAudit = new Map<string, AuditRow>();
    for (const a of (audits ?? []) as AuditRow[]) if (!latestAudit.has(a.company_id)) latestAudit.set(a.company_id, a);

    const scoreRows: { workspace_id: string; lead_id: string; score: number; priority: string; breakdown: Json; inputs: Json; engine_version: string }[] = [];
    for (const company of companies ?? []) {
      const lead = leads?.find((l) => l.company_id === company.id);
      if (!lead) continue;
      const sector = company.sector as unknown as {
        name: string; value_tier: ValueTier; booking_relevant: boolean; whatsapp_relevant: boolean; score_weights: Record<string, number>;
      } | null;
      const audit = auditRowToSignals(latestAudit.get(company.id));
      const result = scoreLead({
        company: { ...company, google_rating: company.google_rating === null ? null : Number(company.google_rating) },
        sector,
        audit,
        config: settings.scoring,
      });
      results.set(company.id, result);
      scoreRows.push({
        workspace_id: actor.workspaceId,
        lead_id: lead.id,
        score: result.score,
        priority: result.priority,
        breakdown: result.factors as unknown as Json,
        inputs: { categoryTotals: result.categoryTotals, audited: Boolean(audit) } as Json,
        engine_version: result.engineVersion,
      });
      await actor.db
        .from("leads")
        .update({ score: result.score, priority: result.priority, score_updated_at: new Date().toISOString() })
        .eq("id", lead.id);
    }
    if (scoreRows.length) await actor.db.from("lead_scores").insert(scoreRows);

    if (!options.silent && scoreRows.length <= 5) {
      for (const row of scoreRows) {
        const companyId = leads?.find((l) => l.id === row.lead_id)?.company_id ?? null;
        await logActivity(actor, { type: "lead_scored", title: `Lead scored ${row.score}/100`, companyId, leadId: row.lead_id, metadata: { score: row.score, priority: row.priority } });
        await emitEvent(actor, "lead.scored", { type: "lead", id: row.lead_id }, { score: row.score, priority: row.priority, company_id: companyId });
      }
    }
  }
  return results;
}
