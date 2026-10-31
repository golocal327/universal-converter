import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { IMPORT_FIELDS } from "@/lib/lead-pipeline/csv-mapping";
import type { RawLead } from "@/lib/lead-pipeline/validate";
import { ingestLeads } from "@/lib/services/ingest";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

/**
 * Public Lead API — POST /api/v1/leads
 * Auth: `Authorization: Bearer <workspace API key>` (Settings → Automation & API).
 * Body: { source?: "api" | "scraper" | "enrichment", campaign_id?: uuid, leads: RawLead[] (≤ 500) }
 */
export const maxDuration = 60;

const cell = z.union([z.string().max(5000), z.number(), z.null()]).optional();
const bodySchema = z.object({
  source: z.enum(["api", "scraper", "enrichment"]).default("api"),
  campaign_id: z.string().uuid().optional(),
  dry_run: z.boolean().default(false),
  leads: z.array(z.object(Object.fromEntries(IMPORT_FIELDS.map((f) => [f, cell]))).passthrough()).min(1).max(500),
});

function error(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  if (!isAdminConfigured()) return error(503, "API not configured (SUPABASE_SERVICE_ROLE_KEY missing)");
  const key = request.headers.get("authorization")?.match(/^Bearer\s+(wire_[A-Za-z0-9_-]{20,})$/)?.[1];
  if (!key) return error(401, "Missing or malformed API key");

  const admin = createAdminClient();
  const hash = createHash("sha256").update(key).digest("hex");
  const { data: apiKey } = await admin.from("api_keys").select("id, workspace_id, revoked_at").eq("key_hash", hash).maybeSingle();
  if (!apiKey || apiKey.revoked_at) return error(401, "Invalid API key");

  const { data: allowed } = await admin.rpc("check_rate_limit_key", { p_key: apiKey.id, p_limit: 60, p_window_seconds: 60 });
  if (allowed === false) return NextResponse.json({ error: "Rate limit exceeded (60 requests/minute)" }, { status: 429, headers: { "Retry-After": "60" } });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return error(400, "Body must be JSON");
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body", issues: parsed.error.issues.slice(0, 20) }, { status: 400 });

  await admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", apiKey.id);
  try {
    const summary = await ingestLeads({ db: admin, workspaceId: apiKey.workspace_id, userId: null }, parsed.data.leads as RawLead[], {
      source: parsed.data.source,
      campaignId: parsed.data.campaign_id ?? null,
      dryRun: parsed.data.dry_run,
    });
    return NextResponse.json({
      total: summary.total,
      created: summary.created,
      new: summary.new,
      duplicates: summary.duplicates,
      invalid: summary.invalid,
      results: summary.rows.map((r) => ({
        index: r.index,
        status: r.status,
        ...(r.status === "created" ? { company_id: r.companyId, lead_id: r.leadId } : {}),
        ...(r.status === "duplicate" ? { reason: r.reason } : {}),
        ...(r.status === "invalid" ? { errors: r.errors } : {}),
      })),
    }, { status: parsed.data.dry_run ? 200 : 201 });
  } catch (e) {
    console.error("[api/v1/leads]", e);
    return error(500, "Ingestion failed");
  }
}
