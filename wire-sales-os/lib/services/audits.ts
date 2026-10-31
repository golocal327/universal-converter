import "server-only";
import { runWebsiteAudit } from "@/lib/audit/run-audit";
import type { Json, TablesInsert } from "@/lib/supabase/database.types";
import { logActivity } from "./activity";
import { emitEvent } from "./events";
import { rescoreCompanies } from "./scoring";
import type { Actor } from "./types";

/** Audit a company's website, persist the result, rescore the lead. */
export async function auditCompanyWebsite(actor: Actor, companyId: string, overrideUrl?: string) {
  const { data: company, error } = await actor.db
    .from("companies")
    .select("id, name, website, sector:sectors(booking_relevant)")
    .eq("workspace_id", actor.workspaceId)
    .eq("id", companyId)
    .single();
  if (error || !company) throw new Error("Company not found");
  const url = overrideUrl ?? company.website;
  if (!url) throw new Error("This company has no website to audit");

  const sector = company.sector as unknown as { booking_relevant: boolean } | null;
  const run = await runWebsiteAudit(url, { bookingRelevant: sector?.booking_relevant ?? false });

  const base = { workspace_id: actor.workspaceId, company_id: companyId, url, created_by: actor.userId, engine_version: run.engineVersion };
  const row: TablesInsert<"website_audits"> =
    run.status === "completed"
      ? {
          ...base,
          status: "completed" as const,
          final_url: run.finalUrl,
          http_status: run.httpStatus,
          response_time_ms: run.responseTimeMs,
          page_bytes: run.pageBytes,
          overall_score: run.result.scores.overall,
          performance_score: run.result.scores.performance,
          seo_score: run.result.scores.seo,
          ux_score: run.result.scores.ux,
          conversion_score: run.result.scores.conversion,
          mobile_score: run.result.scores.mobile,
          checks: run.result.checks as unknown as Json,
          opportunities: run.result.opportunities as unknown as Json,
          signals: run.result.signals as unknown as Json,
          tech: run.result.tech as unknown as Json,
          lighthouse: run.lighthouse,
        }
      : {
          ...base,
          status: "failed" as const,
          final_url: run.finalUrl,
          http_status: run.httpStatus,
          error: run.error,
          error_kind: run.errorKind,
        };

  const { data: audit, error: insertError } = await actor.db.from("website_audits").insert(row).select("id").single();
  if (insertError || !audit) throw new Error(`Could not save audit: ${insertError?.message}`);

  const { data: lead } = await actor.db.from("leads").select("id").eq("company_id", companyId).maybeSingle();
  await rescoreCompanies(actor, [companyId], { silent: true });
  const title = run.status === "completed" ? `Website audited — ${run.result.scores.overall}/100` : `Website audit failed — ${run.error}`;
  await logActivity(actor, { type: "website_audited", title, companyId, leadId: lead?.id ?? null, metadata: { audit_id: audit.id, status: run.status } });
  await emitEvent(actor, "audit.completed", { type: "website_audit", id: audit.id }, {
    company_id: companyId,
    status: run.status,
    overall_score: run.status === "completed" ? run.result.scores.overall : null,
    top_opportunity: run.status === "completed" ? (run.result.opportunities[0]?.title ?? null) : null,
  });
  return { auditId: audit.id, run };
}
