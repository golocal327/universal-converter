"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActor, withinRateLimit } from "@/lib/auth/actor";
import { IMPORT_FIELDS } from "@/lib/lead-pipeline/csv-mapping";
import type { RawLead } from "@/lib/lead-pipeline/validate";
import type { Json } from "@/lib/supabase/database.types";
import { ingestLeads, type IngestSummary } from "@/lib/services/ingest";
import { fail, ok, type ActionResult } from "@/lib/services/types";

const MAX_ROWS = 5000;
const cell = z.union([z.string().max(5000), z.number(), z.null()]).optional();
const rowSchema = z.object(Object.fromEntries(IMPORT_FIELDS.map((f) => [f, cell]))).strict();
const rowsSchema = z.array(rowSchema).min(1).max(MAX_ROWS, `Up to ${MAX_ROWS} rows per import`);

type Summary = Omit<IngestSummary, "rows"> & { issues: { index: number; name: string | null; status: "duplicate" | "invalid"; detail: string }[] };

function compact(summary: IngestSummary): Summary {
  return {
    total: summary.total,
    created: summary.created,
    new: summary.new,
    duplicates: summary.duplicates,
    invalid: summary.invalid,
    issues: summary.rows
      .filter((r) => r.status === "duplicate" || r.status === "invalid")
      .slice(0, 500)
      .map((r) => ({
        index: r.index,
        name: r.name,
        status: r.status as "duplicate" | "invalid",
        detail: r.status === "duplicate" ? `${r.reason}${r.matchId.startsWith("row:") ? ` (row ${Number(r.matchId.slice(4)) + 2})` : " (already in CRM)"}` : r.status === "invalid" ? r.errors.join("; ") : "",
      })),
  };
}

/** Dry run: normalize, validate and de-duplicate without writing. */
export async function previewImport(rows: unknown): Promise<ActionResult<Summary>> {
  const parsed = rowsSchema.safeParse(rows);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid rows");
  const actor = await getActor();
  const summary = await ingestLeads(actor, parsed.data as RawLead[], { source: "csv", dryRun: true });
  return ok(compact(summary));
}

const commitSchema = z.object({
  rows: z.array(rowSchema).min(1).max(500),
  campaignId: z.string().uuid().nullable().optional(),
  jobId: z.string().uuid().nullable().optional(),
  filename: z.string().max(200).optional(),
  mapping: z.record(z.string(), z.string().nullable()).optional(),
  offset: z.number().int().min(0).default(0),
});

/** Import one chunk (≤500 rows). The client calls this sequentially to show progress. */
export async function commitImportChunk(input: z.input<typeof commitSchema>): Promise<ActionResult<Summary & { jobId: string }>> {
  const parsed = commitSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid chunk");
  const actor = await getActor();
  if (!parsed.data.jobId && !(await withinRateLimit(actor, "import", 20, 3600))) return fail("Import limit reached (20 per hour)");

  let jobId = parsed.data.jobId ?? null;
  if (!jobId) {
    const { data: job, error } = await actor.db
      .from("import_jobs")
      .insert({ workspace_id: actor.workspaceId, filename: parsed.data.filename ?? null, mapping: (parsed.data.mapping ?? {}) as Json, status: "running", created_by: actor.userId })
      .select("id")
      .single();
    if (error || !job) return fail(error?.message ?? "Could not start import");
    jobId = job.id;
  }
  try {
    const summary = await ingestLeads(actor, parsed.data.rows as RawLead[], { source: "csv", campaignId: parsed.data.campaignId ?? null });
    const { data: job } = await actor.db.from("import_jobs").select("total, created_count, duplicate_count, invalid_count").eq("id", jobId).single();
    await actor.db
      .from("import_jobs")
      .update({
        total: (job?.total ?? 0) + summary.total,
        created_count: (job?.created_count ?? 0) + summary.created,
        duplicate_count: (job?.duplicate_count ?? 0) + summary.duplicates,
        invalid_count: (job?.invalid_count ?? 0) + summary.invalid,
      })
      .eq("id", jobId);
    const c = compact(summary);
    c.issues = c.issues.map((i) => ({ ...i, index: i.index + parsed.data.offset }));
    return ok({ ...c, jobId });
  } catch (e) {
    await actor.db.from("import_jobs").update({ status: "failed" }).eq("id", jobId);
    return fail((e as Error).message);
  }
}

export async function finishImport(jobId: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(jobId).success) return fail("Invalid job");
  const actor = await getActor();
  await actor.db.from("import_jobs").update({ status: "completed" }).eq("id", jobId).eq("status", "running");
  revalidatePath("/leads");
  return ok(undefined);
}
