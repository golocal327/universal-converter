import "server-only";
import { deriveOpportunities, type AuditSignalsDetail } from "@/lib/audit/analyzer";
import { DEMO_CAMPAIGNS, DEMO_COMPANIES, type DemoAudit } from "@/lib/demo/seed-data";
import { DEFAULT_SECTORS } from "@/lib/defaults/catalog";
import type { ActivityType, StageKey } from "@/lib/domain/constants";
import { buildProposal } from "@/lib/outreach/generators";
import type { Json } from "@/lib/supabase/database.types";
import { logActivity, type ActivityInput } from "./activity";
import { ingestLeads } from "./ingest";
import { buildLeadContext } from "./lead-context";
import { ensureDealForLead, loadStages } from "./pipeline";
import { rescoreCompanies } from "./scoring";
import type { Actor } from "./types";

const DAY = 86_400_000;
const ago = (days: number, hours = 10) => new Date(Date.now() - days * DAY + (hours - 10) * 3_600_000).toISOString();
const STAGE_ORDER: StageKey[] = ["new", "qualified", "contacted", "replied", "meeting", "proposal", "negotiation", "won", "lost"];
const reached = (stage: StageKey | undefined, step: StageKey) => {
  if (!stage) return false;
  if (stage === "lost") return STAGE_ORDER.indexOf(step) <= STAGE_ORDER.indexOf("meeting");
  return STAGE_ORDER.indexOf(stage) >= STAGE_ORDER.indexOf(step);
};

function demoSignals(a: DemoAudit): Partial<AuditSignalsDetail> {
  return {
    https: a.https, hasViewport: a.mobile >= 50, hasCta: a.cta, ctaCount: a.cta ? 3 : 0, hasBooking: a.booking, bookingProvider: a.booking ? "Doctoralia" : null,
    hasWhatsapp: a.whatsapp, hasForm: a.conversion > 40, hasLeadCapture: a.conversion > 40, hasTel: true, hasEmail: true, hasPricing: false,
    trustSignals: a.conversion > 60 ? ["Reviews", "Experience"] : [], outdated: a.outdated, outdatedReasons: a.outdated ? ["Copyright 2017", "Legacy HTML tags"] : [],
    copyrightYear: a.outdated ? 2017 : 2026, wordCount: 420, title: null, description: null, h1: null,
  };
}

/** Load a realistic demo dataset into the workspace (through the real pipeline). */
export async function loadDemoData(actor: Actor) {
  const { count } = await actor.db.from("companies").select("id", { count: "exact", head: true }).eq("workspace_id", actor.workspaceId).contains("tags", ["demo"]);
  if (count) throw new Error("Demo data is already loaded");

  const { data: sectors } = await actor.db.from("sectors").select("id, slug, name, booking_relevant").eq("workspace_id", actor.workspaceId);
  const sectorBySlug = new Map((sectors ?? []).map((s) => [s.slug, s]));
  const nameOf = (slug: string) => sectorBySlug.get(slug)?.name ?? DEFAULT_SECTORS.find((s) => s.slug === slug)?.name ?? slug;

  // Campaigns
  const campaignIds = new Map<string, string>();
  for (const c of DEMO_CAMPAIGNS) {
    const { data } = await actor.db
      .from("campaigns")
      .insert({
        workspace_id: actor.workspaceId, name: c.name, target_sector_id: sectorBySlug.get(c.sector)?.id ?? null, target_location: c.location,
        website_requirement: c.website_requirement, status: c.status, channel: c.channel, start_date: ago(35).slice(0, 10), created_by: actor.userId,
      })
      .select("id")
      .single();
    if (data) campaignIds.set(c.key, data.id);
  }

  // Companies + leads through the real lead pipeline
  const sources = ["google_places", "csv", "manual"] as const;
  const created: { index: number; companyId: string; leadId: string }[] = [];
  for (let s = 0; s < sources.length; s++) {
    const slice = DEMO_COMPANIES.map((c, index) => ({ c, index })).filter(({ index }) => index % sources.length === s);
    const summary = await ingestLeads(
      actor,
      slice.map(({ c, index }) => ({
        company_name: c.name, sector: nameOf(c.sector), city: c.city, province: c.province, country: "ES", website: c.website,
        phone: `+34 600 ${String(100 + index).padStart(3, "0")} ${String(200 + index * 7).slice(-3)}`,
        email: c.website ? `hola@${new URL(c.website).hostname}` : null,
        rating: c.rating, reviews: c.reviews, employees: c.employees,
        instagram: c.instagram ? `@${c.name.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "").slice(0, 24)}` : null,
        contact_name: c.contact?.[0], contact_role: c.contact?.[1],
      })),
      { source: sources[s], tags: ["demo"] },
    );
    summary.rows.forEach((row) => {
      if (row.status === "created") created.push({ index: slice[row.index].index, companyId: row.companyId, leadId: row.leadId });
    });
  }

  const stages = await loadStages(actor);
  for (const item of created) {
    const c = DEMO_COMPANIES[item.index];
    await actor.db
      .from("companies")
      .update({
        instagram_last_post_at: c.instagram === "active" ? ago(4).slice(0, 10) : c.instagram === "abandoned" ? ago(200).slice(0, 10) : null,
        instagram_followers: c.instagram ? 800 + item.index * 137 : null,
        growth_signals: c.growth ?? [],
        google_last_review_at: c.reviews ? ago(c.reviews > 50 ? 6 : 40).slice(0, 10) : null,
        created_at: ago(c.daysAgo),
      })
      .eq("id", item.companyId);
    await actor.db.from("leads").update({ created_at: ago(c.daysAgo) }).eq("id", item.leadId);
    await actor.db.from("activities").update({ occurred_at: ago(c.daysAgo) }).eq("lead_id", item.leadId).eq("type", "lead_created");

    // Synthetic audits (demo sites are not real, so they cannot be fetched)
    if (c.audit && c.website) {
      const bookingRelevant = sectorBySlug.get(c.sector)?.booking_relevant ?? false;
      const row =
        c.audit === "broken"
          ? { status: "failed" as const, http_status: 503, error: "The website answered HTTP 503", error_kind: "http" }
          : (() => {
              const a = c.audit as DemoAudit;
              const signals = demoSignals(a) as AuditSignalsDetail;
              const scores = { performance: a.performance, seo: a.seo, ux: a.ux, conversion: a.conversion, mobile: a.mobile };
              const opportunities = deriveOpportunities([], signals, scores, bookingRelevant);
              if (a.seo < 50) opportunities.push({ key: "poor_seo_metadata", title: "Poor SEO metadata", impact: "medium", service: "seo-local", detail: "Missing or weak title, description or headings reduce visibility on Google." });
              return {
                status: "completed" as const, http_status: 200, final_url: c.website, response_time_ms: a.responseMs, page_bytes: 180_000,
                overall_score: a.overall, performance_score: a.performance, seo_score: a.seo, ux_score: a.ux, conversion_score: a.conversion, mobile_score: a.mobile,
                opportunities: opportunities as unknown as Json, signals: signals as unknown as Json, tech: { cms: a.outdated ? "WordPress" : "Wix", analytics: [], generator: null } as Json,
              };
            })();
      await actor.db.from("website_audits").insert({
        workspace_id: actor.workspaceId, company_id: item.companyId, url: c.website, created_by: actor.userId, engine_version: "demo",
        created_at: ago(Math.max(c.daysAgo - 1, 0)), ...row,
      });
      await logActivity(actor, { type: "website_audited", title: row.status === "completed" ? `Website audited — ${(c.audit as DemoAudit).overall}/100` : "Website audit failed — HTTP 503", companyId: item.companyId, leadId: item.leadId, occurredAt: ago(Math.max(c.daysAgo - 1, 0)) });
    }

    if (c.campaign && campaignIds.has(c.campaign)) {
      await actor.db.from("campaign_leads").insert({
        workspace_id: actor.workspaceId, campaign_id: campaignIds.get(c.campaign) as string, lead_id: item.leadId, added_at: ago(c.daysAgo),
        contacted_at: reached(c.stage, "contacted") ? ago(c.daysAgo - 1) : null,
        delivered_at: reached(c.stage, "contacted") ? ago(c.daysAgo - 1) : null,
        opened_at: reached(c.stage, "contacted") && item.index % 2 === 0 ? ago(c.daysAgo - 1, 15) : null,
        replied_at: reached(c.stage, "replied") ? ago(c.daysAgo - 3) : null,
        meeting_at: reached(c.stage, "meeting") ? ago(c.daysAgo - 5) : null,
        won_at: c.stage === "won" ? ago(Math.max(c.daysAgo - 12, 1)) : null,
        lost_at: c.stage === "lost" ? ago(Math.max(c.daysAgo - 10, 1)) : null,
      });
    }
  }

  await rescoreCompanies(actor, created.map((c) => c.companyId), { silent: true });

  // Deals, outreach history, proposals
  for (const item of created) {
    const c = DEMO_COMPANIES[item.index];
    if (!c.stage || c.stage === "new") continue;
    const { dealId } = await ensureDealForLead(actor, item.leadId, { stageKey: c.stage, campaignId: c.campaign ? campaignIds.get(c.campaign) : null });
    const stage = stages.find((s) => s.key === c.stage);
    await actor.db
      .from("deals")
      .update({
        created_at: ago(c.daysAgo - 1),
        ...(c.stage === "won" ? { won_at: ago(Math.max(c.daysAgo - 12, 1)) } : {}),
        ...(c.stage === "lost" ? { lost_at: ago(Math.max(c.daysAgo - 10, 1)), lost_reason: "Chose a cheaper provider", max_stage_position: 5 } : {}),
        next_action: c.stage === "proposal" ? "Follow up on proposal" : c.stage === "meeting" ? "Prepare meeting" : c.stage === "contacted" ? "Send follow-up" : null,
        next_action_at: ["proposal", "meeting", "contacted"].includes(c.stage) ? ago(-1 - (item.index % 3)) : null,
        last_contact_at: reached(c.stage, "contacted") ? ago(c.daysAgo - 1) : null,
      })
      .eq("id", dealId);
    if (c.stage === "won") await actor.db.from("companies").update({ is_customer: true }).eq("id", item.companyId);

    const timeline: ActivityInput[] = [];
    const add = (type: ActivityType, title: string, days: number) =>
      timeline.push({ type, title, companyId: item.companyId, leadId: item.leadId, dealId, occurredAt: ago(Math.max(days, 0)) });
    if (reached(c.stage, "contacted")) add("email_sent", "Email sent: primer contacto", c.daysAgo - 1);
    if (reached(c.stage, "replied")) add("reply_received", "Reply received", c.daysAgo - 3);
    if (reached(c.stage, "meeting")) add("meeting_scheduled", "Meeting scheduled", c.daysAgo - 5);
    if (reached(c.stage, "proposal")) add("proposal_sent", "Proposal sent", c.daysAgo - 8);
    if (c.stage === "won") add("deal_won", `Deal won — ${c.name}`, Math.max(c.daysAgo - 12, 1));
    if (c.stage === "lost") add("deal_lost", "Deal lost — Chose a cheaper provider", Math.max(c.daysAgo - 10, 1));
    if (timeline.length) await logActivity(actor, timeline);

    await actor.db
      .from("leads")
      .update({
        contact_status: reached(c.stage, "meeting") ? "meeting" : reached(c.stage, "replied") ? "replied" : reached(c.stage, "contacted") ? "contacted" : "not_contacted",
        last_contacted_at: reached(c.stage, "contacted") ? ago(c.daysAgo - 1) : null,
        next_follow_up_at: c.stage === "contacted" ? ago(c.daysAgo - 4) : c.stage === "proposal" ? ago(-2) : null,
        status: stage?.key === "qualified" ? "qualified" : "converted",
      })
      .eq("id", item.leadId);

    if (c.stage === "proposal" || c.stage === "negotiation" || c.stage === "won") {
      const ctx = await buildLeadContext(actor, item.companyId);
      if (ctx) {
        const content = buildProposal(ctx);
        await actor.db.from("proposals").insert({
          workspace_id: actor.workspaceId, company_id: item.companyId, lead_id: item.leadId, deal_id: dealId, title: content.title,
          status: c.stage === "won" ? "accepted" : "sent", content: content as unknown as Json,
          setup_total: content.investment.setup, monthly_total: content.investment.monthly, valid_until: ago(-30).slice(0, 10),
          generated_by: "rules", sent_at: ago(c.daysAgo - 8), created_by: actor.userId,
        });
      }
    }
  }

  // Tasks: overdue follow-ups, today, upcoming
  const taskFor = (name: string) => created.find((x) => DEMO_COMPANIES[x.index].name === name);
  const tasks = [
    { name: "Autoescuela El Carril", title: "Follow up with Autoescuela El Carril", type: "follow_up", priority: "high", due: ago(2) },
    { name: "Fisio Triana Movimiento", title: "Follow up with Fisio Triana Movimiento", type: "follow_up", priority: "high", due: ago(1) },
    { name: "Clínica Veterinaria San Telmo", title: "Call Clínica Veterinaria San Telmo", type: "call", priority: "medium", due: ago(3) },
    { name: "Arrocería Malagueta", title: "Tell Arrocería Malagueta their site is down", type: "call", priority: "urgent", due: ago(0, 12) },
    { name: "Clínica Dental Triana Sonríe", title: "Send first email to Clínica Dental Triana Sonríe", type: "email", priority: "high", due: ago(0, 16) },
    { name: "Autoescuela Bahía Norte", title: "Meeting with Autoescuela Bahía Norte", type: "meeting", priority: "high", due: ago(-1, 11) },
    { name: "Inmobiliaria Costa de la Luz", title: "Demo for Inmobiliaria Costa de la Luz", type: "demo", priority: "medium", due: ago(-2, 17) },
    { name: "Asesoría Fiscal Gaditana", title: "Chase proposal — Asesoría Fiscal Gaditana", type: "follow_up", priority: "medium", due: ago(-3) },
    { name: "Clínica Dental Arenal", title: "Close Clínica Dental Arenal", type: "close", priority: "urgent", due: ago(-4) },
    { name: "Centro Médico Nervión Salud", title: "Prepare proposal for Nervión Salud", type: "proposal", priority: "medium", due: ago(-5) },
  ] as const;
  await actor.db.from("tasks").insert(
    tasks
      .map((t) => ({ t, item: taskFor(t.name) }))
      .filter(({ item }) => item)
      .map(({ t, item }) => ({
        workspace_id: actor.workspaceId, title: t.title, type: t.type, priority: t.priority, due_at: t.due,
        company_id: item!.companyId, lead_id: item!.leadId, assignee_id: actor.userId, created_by: actor.userId,
      })),
  );

  return { companies: created.length, campaigns: campaignIds.size };
}

/** Remove everything created by loadDemoData (companies tagged "demo" cascade to leads, deals, tasks…). */
export async function clearDemoData(actor: Actor) {
  await actor.db.from("companies").delete().eq("workspace_id", actor.workspaceId).contains("tags", ["demo"]);
  await actor.db.from("campaigns").delete().eq("workspace_id", actor.workspaceId).in("name", DEMO_CAMPAIGNS.map((c) => c.name));
}
