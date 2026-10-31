"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isAIConfigured } from "@/lib/ai";
import { COPILOT_SYSTEM, leadDataBlock, proposalSchema } from "@/lib/ai/prompts";
import { getActor, withinRateLimit } from "@/lib/auth/actor";
import { nameCityKey, normalizeEmail, normalizePhone, normalizePlace, normalizeSocialUrl, normalizeWebsite } from "@/lib/lead-pipeline/normalize";
import { analyzeOpportunity, buildProposal, type ProposalContent } from "@/lib/outreach/generators";
import type { Json } from "@/lib/supabase/database.types";
import { logActivity } from "@/lib/services/activity";
import { runAIObject } from "@/lib/services/ai";
import { auditCompanyWebsite } from "@/lib/services/audits";
import { buildLeadContext } from "@/lib/services/lead-context";
import { recordOutreach, type OutreachKind } from "@/lib/services/outreach";
import { advanceDealTo } from "@/lib/services/pipeline";
import { rescoreCompanies } from "@/lib/services/scoring";
import { fail, ok, type ActionResult } from "@/lib/services/types";

const uuid = z.string().uuid();
const optional = (max: number) => z.string().trim().max(max).nullable().optional().transform((v) => (v ? v : null));
const optionalNumber = (max: number) => z.union([z.number(), z.string()]).nullable().optional().transform((v, ctx) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > max) { ctx.addIssue({ code: "custom", message: "Invalid number" }); return z.NEVER; }
  return n;
});

const updateCompanySchema = z.object({
  id: uuid,
  name: z.string().trim().min(1).max(200),
  legal_name: optional(200),
  sector_id: uuid.nullable().optional(),
  subsector: optional(120),
  city: optional(120),
  province: optional(120),
  address: optional(300),
  postal_code: optional(12),
  phone: optional(40),
  email: optional(254),
  website: optional(500),
  instagram_url: optional(300),
  instagram_followers: optionalNumber(100_000_000),
  instagram_last_post_at: optional(10),
  facebook_url: optional(300),
  linkedin_url: optional(300),
  google_maps_url: optional(1000),
  google_rating: optionalNumber(5),
  google_reviews_count: optionalNumber(10_000_000),
  google_last_review_at: optional(10),
  employees_estimate: optionalNumber(1_000_000),
  description: optional(4000),
  opening_hours: optional(500),
  services_offered: z.string().max(2000).nullable().optional(),
  growth_signals: z.string().max(500).nullable().optional(),
});
export type UpdateCompanyInput = z.input<typeof updateCompanySchema>;

export async function updateCompany(input: UpdateCompanyInput): Promise<ActionResult> {
  const parsed = updateCompanySchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields", parsed.error.flatten().fieldErrors as Record<string, string[]>);
  const actor = await getActor();
  const d = parsed.data;
  const site = normalizeWebsite(d.website);
  if (d.website && !site) return fail("Invalid website", { website: ["Enter a valid website URL"] });
  const email = d.email ? normalizeEmail(d.email) : null;
  if (d.email && !email) return fail("Invalid email", { email: ["Enter a valid email"] });
  const city = normalizePlace(d.city);
  const list = (v: string | null | undefined) => (v ?? "").split(/[;,\n]/).map((s) => s.trim()).filter(Boolean).slice(0, 50);

  const { error } = await actor.db
    .from("companies")
    .update({
      name: d.name, legal_name: d.legal_name, sector_id: d.sector_id ?? null, subsector: d.subsector, city, province: normalizePlace(d.province),
      address: d.address, postal_code: d.postal_code, phone: d.phone, phone_normalized: normalizePhone(d.phone), email,
      website: site?.website ?? null, domain: site?.domain ?? null,
      instagram_url: normalizeSocialUrl(d.instagram_url, "instagram"), instagram_followers: d.instagram_followers, instagram_last_post_at: d.instagram_last_post_at,
      facebook_url: normalizeSocialUrl(d.facebook_url, "facebook"), linkedin_url: normalizeSocialUrl(d.linkedin_url, "linkedin"), google_maps_url: d.google_maps_url,
      google_rating: d.google_rating, google_reviews_count: d.google_reviews_count, google_last_review_at: d.google_last_review_at,
      employees_estimate: d.employees_estimate, description: d.description, opening_hours: d.opening_hours,
      services_offered: list(d.services_offered), growth_signals: list(d.growth_signals), name_key: nameCityKey(d.name, city),
    })
    .eq("id", d.id)
    .eq("workspace_id", actor.workspaceId);
  if (error) return fail(error.message);
  await rescoreCompanies(actor, [d.id], { silent: true });
  revalidatePath(`/companies/${d.id}`);
  return ok(undefined);
}

export async function deleteCompany(companyId: string): Promise<ActionResult> {
  if (!uuid.safeParse(companyId).success) return fail("Invalid company");
  const actor = await getActor();
  if (!actor.isAdmin) return fail("Only admins can delete companies");
  const { error } = await actor.db.from("companies").delete().eq("id", companyId).eq("workspace_id", actor.workspaceId);
  if (error) return fail(error.message);
  revalidatePath("/leads");
  redirect("/companies");
}

export async function auditWebsite(companyId: string): Promise<ActionResult<{ status: string; score: number | null }>> {
  if (!uuid.safeParse(companyId).success) return fail("Invalid company");
  const actor = await getActor();
  if (!(await withinRateLimit(actor, "audit", 30, 3600))) return fail("Audit limit reached (30 per hour). Try again later.");
  try {
    const { run } = await auditCompanyWebsite(actor, companyId);
    revalidatePath(`/companies/${companyId}`);
    return ok({ status: run.status, score: run.status === "completed" ? run.result.scores.overall : null });
  } catch (e) {
    return fail((e as Error).message);
  }
}

const contactSchema = z.object({
  id: uuid.optional(),
  companyId: uuid,
  full_name: z.string().trim().min(1, "Name is required").max(160),
  role: optional(120),
  email: optional(254).refine((v) => !v || normalizeEmail(v), "Invalid email"),
  phone: optional(40),
  whatsapp: optional(40),
  linkedin_url: optional(300),
  notes: optional(2000),
  is_primary: z.boolean().default(false),
});

export async function saveContact(input: z.input<typeof contactSchema>): Promise<ActionResult<{ id: string }>> {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields", parsed.error.flatten().fieldErrors as Record<string, string[]>);
  const actor = await getActor();
  const { id, companyId, ...c } = parsed.data;
  const row = { ...c, email: c.email ? normalizeEmail(c.email) : null, phone_normalized: normalizePhone(c.phone), linkedin_url: normalizeSocialUrl(c.linkedin_url, "linkedin") };
  const result = id
    ? await actor.db.from("contacts").update(row).eq("id", id).eq("workspace_id", actor.workspaceId).select("id").single()
    : await actor.db.from("contacts").insert({ ...row, workspace_id: actor.workspaceId, company_id: companyId }).select("id").single();
  if (result.error || !result.data) return fail(result.error?.message ?? "Could not save contact");
  if (c.is_primary) {
    await actor.db.from("contacts").update({ is_primary: false }).eq("company_id", companyId).neq("id", result.data.id);
    await actor.db.from("leads").update({ primary_contact_id: result.data.id }).eq("company_id", companyId);
  }
  revalidatePath(`/companies/${companyId}`);
  revalidatePath("/contacts");
  return ok({ id: result.data.id });
}

export async function deleteContact(contactId: string): Promise<ActionResult> {
  if (!uuid.safeParse(contactId).success) return fail("Invalid contact");
  const actor = await getActor();
  const { data, error } = await actor.db.from("contacts").delete().eq("id", contactId).eq("workspace_id", actor.workspaceId).select("company_id").single();
  if (error) return fail(error.message);
  if (data?.company_id) revalidatePath(`/companies/${data.company_id}`);
  revalidatePath("/contacts");
  return ok(undefined);
}

const noteSchema = z.object({ companyId: uuid, body: z.string().trim().min(1).max(10_000) });

export async function addNote(input: z.input<typeof noteSchema>): Promise<ActionResult> {
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return fail("Write something first");
  const actor = await getActor();
  const { data: lead } = await actor.db.from("leads").select("id").eq("company_id", parsed.data.companyId).maybeSingle();
  await logActivity(actor, { type: "note_added", title: "Note", body: parsed.data.body, companyId: parsed.data.companyId, leadId: lead?.id ?? null });
  revalidatePath(`/companies/${parsed.data.companyId}`);
  return ok(undefined);
}

const outreachSchema = z.object({
  companyId: uuid,
  kind: z.enum(["email_sent", "whatsapp_sent", "call_logged", "reply_received", "meeting_scheduled", "meeting_completed"]),
  subject: z.string().max(300).nullable().optional(),
  body: z.string().max(20_000).nullable().optional(),
  to: z.string().max(254).nullable().optional(),
  variant: z.string().max(40).nullable().optional(),
  generatedBy: z.enum(["rules", "ai", "template", "manual"]).optional(),
  templateId: uuid.nullable().optional(),
  aiGenerationId: uuid.nullable().optional(),
  sendViaProvider: z.boolean().optional(),
  followUpInDays: z.number().int().min(0).max(60).nullable().optional(),
  occurredAt: z.string().datetime({ offset: true }).optional(),
});

/** Log (or send) an outreach touchpoint and apply CRM side effects. */
export async function recordOutreachAction(input: z.input<typeof outreachSchema>): Promise<ActionResult<{ sent: boolean }>> {
  const parsed = outreachSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid request");
  const actor = await getActor();
  if (parsed.data.sendViaProvider && !(await withinRateLimit(actor, "send_email", 100, 3600))) return fail("Sending limit reached (100 emails per hour)");
  try {
    const res = await recordOutreach(actor, { ...parsed.data, kind: parsed.data.kind as OutreachKind });
    revalidatePath(`/companies/${parsed.data.companyId}`);
    revalidatePath("/pipeline");
    return ok({ sent: Boolean(res.providerMessageId) });
  } catch (e) {
    return fail((e as Error).message);
  }
}

const proposalInput = z.object({ companyId: uuid, useAI: z.boolean().default(false) });

/** Generate a proposal from the lead data (rules engine, or AI when configured and requested). */
export async function generateProposal(input: z.input<typeof proposalInput>): Promise<ActionResult<{ proposalId: string }>> {
  const parsed = proposalInput.safeParse(input);
  if (!parsed.success) return fail("Invalid request");
  const actor = await getActor();
  const ctx = await buildLeadContext(actor, parsed.data.companyId);
  if (!ctx) return fail("Company not found");

  let content: ProposalContent = buildProposal(ctx);
  let generatedBy: "rules" | "ai" = "rules";
  if (parsed.data.useAI) {
    if (!isAIConfigured()) return fail("AI is not configured — generate the rules-based proposal instead.");
    if (!(await withinRateLimit(actor, "ai", 60, 3600))) return fail("AI limit reached (60 requests per hour).");
    try {
      const result = await runAIObject(
        actor,
        { kind: "proposal", companyId: ctx.company.id, leadId: ctx.lead?.id ?? null },
        {
          system: `${COPILOT_SYSTEM}\n\n${leadDataBlock(ctx, analyzeOpportunity(ctx))}\n\nDraft proposal from the rules engine (improve it, keep prices unless you justify a change):\n${JSON.stringify(content)}`,
          messages: [{ role: "user", content: "Write the final commercial proposal in Spanish for this business: current situation, detected problems, opportunities, WIRE's solution, features, timeline, investment (setup, monthly maintenance, extras), maintenance and next steps. Professional and concrete." }],
          effort: "medium",
          maxTokens: 12000,
        },
        proposalSchema,
        "proposal",
      );
      content = result.object;
      generatedBy = "ai";
    } catch (e) {
      return fail(`AI proposal failed: ${(e as Error).message}`);
    }
  }

  const { data: deal } = ctx.lead
    ? await actor.db.from("deals").select("id").eq("lead_id", ctx.lead.id).eq("status", "open").limit(1).maybeSingle()
    : { data: null };
  const validUntil = new Date(Date.now() + content.validDays * 86_400_000).toISOString().slice(0, 10);
  const { data: proposal, error } = await actor.db
    .from("proposals")
    .insert({
      workspace_id: actor.workspaceId, company_id: ctx.company.id, lead_id: ctx.lead?.id ?? null, deal_id: deal?.id ?? null, title: content.title,
      content: content as unknown as Json, setup_total: content.investment.setup, monthly_total: content.investment.monthly, valid_until: validUntil,
      generated_by: generatedBy, created_by: actor.userId,
    })
    .select("id")
    .single();
  if (error || !proposal) return fail(error?.message ?? "Could not save proposal");
  await logActivity(actor, { type: "proposal_created", title: `Proposal created (${generatedBy === "ai" ? "AI" : "rules engine"})`, companyId: ctx.company.id, leadId: ctx.lead?.id ?? null, dealId: deal?.id ?? null, metadata: { proposal_id: proposal.id } });
  revalidatePath(`/companies/${ctx.company.id}`);
  return ok({ proposalId: proposal.id });
}

const proposalStatusSchema = z.object({ proposalId: uuid, status: z.enum(["draft", "sent", "accepted", "rejected"]) });

export async function setProposalStatus(input: z.input<typeof proposalStatusSchema>): Promise<ActionResult> {
  const parsed = proposalStatusSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid request");
  const actor = await getActor();
  const { data: p, error } = await actor.db
    .from("proposals")
    .update({ status: parsed.data.status, ...(parsed.data.status === "sent" ? { sent_at: new Date().toISOString() } : {}) })
    .eq("id", parsed.data.proposalId)
    .eq("workspace_id", actor.workspaceId)
    .select("company_id, lead_id, deal_id, title")
    .single();
  if (error || !p) return fail(error?.message ?? "Proposal not found");
  if (parsed.data.status === "sent") {
    await logActivity(actor, { type: "proposal_sent", title: `Proposal sent — ${p.title}`, companyId: p.company_id, leadId: p.lead_id, dealId: p.deal_id });
    if (p.lead_id) await advanceDealTo(actor, p.lead_id, "proposal");
  }
  revalidatePath(`/companies/${p.company_id}`);
  revalidatePath(`/proposals/${parsed.data.proposalId}`);
  return ok(undefined);
}

const documentSchema = z.object({
  companyId: uuid,
  name: z.string().trim().min(1).max(200),
  storagePath: z.string().max(500),
  mimeType: z.string().max(120).nullable().optional(),
  sizeBytes: z.number().int().min(0).max(20 * 1024 * 1024),
});

/** Register a file already uploaded to the private `documents` bucket (path is checked against the workspace). */
export async function registerDocument(input: z.input<typeof documentSchema>): Promise<ActionResult> {
  const parsed = documentSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid document");
  const actor = await getActor();
  if (!parsed.data.storagePath.startsWith(`${actor.workspaceId}/${parsed.data.companyId}/`)) return fail("Invalid storage path");
  const { error } = await actor.db.from("documents").insert({
    workspace_id: actor.workspaceId, company_id: parsed.data.companyId, name: parsed.data.name, storage_path: parsed.data.storagePath,
    mime_type: parsed.data.mimeType ?? null, size_bytes: parsed.data.sizeBytes, uploaded_by: actor.userId,
  });
  if (error) return fail(error.message);
  await logActivity(actor, { type: "document_uploaded", title: `Document uploaded — ${parsed.data.name}`, companyId: parsed.data.companyId });
  revalidatePath(`/companies/${parsed.data.companyId}`);
  return ok(undefined);
}

export async function deleteDocument(documentId: string): Promise<ActionResult> {
  if (!uuid.safeParse(documentId).success) return fail("Invalid document");
  const actor = await getActor();
  const { data: doc } = await actor.db.from("documents").select("storage_path, company_id").eq("id", documentId).single();
  if (!doc) return fail("Document not found");
  await actor.db.storage.from("documents").remove([doc.storage_path]);
  await actor.db.from("documents").delete().eq("id", documentId);
  revalidatePath(`/companies/${doc.company_id}`);
  return ok(undefined);
}

export async function getDocumentUrl(documentId: string): Promise<ActionResult<{ url: string }>> {
  if (!uuid.safeParse(documentId).success) return fail("Invalid document");
  const actor = await getActor();
  const { data: doc } = await actor.db.from("documents").select("storage_path").eq("id", documentId).single();
  if (!doc) return fail("Document not found");
  const { data, error } = await actor.db.storage.from("documents").createSignedUrl(doc.storage_path, 60);
  if (error || !data) return fail(error?.message ?? "Could not create link");
  return ok({ url: data.signedUrl });
}
