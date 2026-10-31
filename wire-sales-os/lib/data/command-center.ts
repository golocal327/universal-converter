import "server-only";
import type { ValueTier } from "@/lib/domain/constants";
import { computeBusinessPotential, computeWebsiteQuality, recommendPricing } from "@/lib/pricing/engine";
import type { ScoreFactor } from "@/lib/scoring/engine";
import { loadPricingCatalog } from "@/lib/services/lead-context";
import type { Actor } from "@/lib/services/types";
import { getDashboardMetrics } from "./analytics";

export type TopLead = {
  id: string; company_id: string; company_name: string; city: string | null; sector_name: string | null; score: number; priority: string;
  website_state: string | null; google_reviews_count: number | null; contact_status: string; reasons: string[]; package: string; setup: number; monthly: number;
};

export type CommandCenter = {
  attention: { hotLeads: number; overdueFollowUps: number; proposalsAwaiting: number; meetingsTomorrow: number; meetingsToday: number };
  topLeads: TopLead[];
  sellable: { packageName: string; leads: number; setup: number; monthly: number }[];
  performance: { outreach7d: number; replies7d: number; meetings7d: number; replyRate: number | null; meetingRate: number | null; winRate: number; revenue30d: number; pipeline: number; weighted: number; mrr: number };
};

const DAY = 86_400_000;

export async function getCommandCenter(actor: Actor, now = new Date()): Promise<CommandCenter> {
  const ws = actor.workspaceId;
  const db = actor.db;
  const startToday = new Date(now); startToday.setHours(0, 0, 0, 0);
  const startTomorrow = new Date(startToday.getTime() + DAY);
  const endTomorrow = new Date(startTomorrow.getTime() + DAY);
  const weekAgo = new Date(now.getTime() - 7 * DAY).toISOString();
  const nowIso = now.toISOString();

  const [hot, overdueLeads, overdueTasks, proposals, meetingsTomorrow, meetingsToday, top, acts, metrics, catalog] = await Promise.all([
    db.from("leads").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("priority", "hot").in("status", ["new", "qualified"]).eq("contact_status", "not_contacted"),
    db.from("leads").select("id", { count: "exact", head: true }).eq("workspace_id", ws).lt("next_follow_up_at", nowIso).not("contact_status", "in", "(replied,meeting,do_not_contact)"),
    db.from("tasks").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("type", "follow_up").in("status", ["todo", "in_progress"]).lt("due_at", nowIso),
    db.from("proposals").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("status", "sent"),
    db.from("tasks").select("id", { count: "exact", head: true }).eq("workspace_id", ws).in("type", ["meeting", "demo"]).in("status", ["todo", "in_progress"]).gte("due_at", startTomorrow.toISOString()).lt("due_at", endTomorrow.toISOString()),
    db.from("tasks").select("id", { count: "exact", head: true }).eq("workspace_id", ws).in("type", ["meeting", "demo"]).in("status", ["todo", "in_progress"]).gte("due_at", startToday.toISOString()).lt("due_at", startTomorrow.toISOString()),
    db.from("lead_overview")
      .select("id, company_id, company_name, city, sector_name, sector_tier, score, priority, website, website_state, website_score, google_reviews_count, google_rating, employees_estimate, contact_status")
      .eq("workspace_id", ws).in("status", ["new", "qualified"]).in("contact_status", ["not_contacted", "contacted", "unresponsive"]).eq("is_customer", false)
      .order("score", { ascending: false }).limit(10),
    db.from("activities").select("type").eq("workspace_id", ws).gte("occurred_at", weekAgo).in("type", ["email_sent", "whatsapp_sent", "call_logged", "reply_received", "meeting_scheduled"]).limit(5000),
    getDashboardMetrics(db, ws, new Date(now.getTime() - 30 * DAY)),
    loadPricingCatalog(actor),
  ]);

  const leadIds = (top.data ?? []).map((l) => l.id as string);
  const { data: scores } = leadIds.length
    ? await db.from("lead_scores").select("lead_id, breakdown, created_at").in("lead_id", leadIds).order("created_at", { ascending: false })
    : { data: [] };
  const latest = new Map<string, ScoreFactor[]>();
  for (const s of scores ?? []) if (!latest.has(s.lead_id)) latest.set(s.lead_id, s.breakdown as unknown as ScoreFactor[]);

  const topLeads: TopLead[] = (top.data ?? []).map((l) => {
    const rec = recommendPricing({
      potential: computeBusinessPotential({ google_reviews_count: l.google_reviews_count, google_rating: l.google_rating === null ? null : Number(l.google_rating), employees_estimate: l.employees_estimate, sector_tier: l.sector_tier as ValueTier | null }),
      quality: computeWebsiteQuality(l.website, l.website_score),
      sectorTier: l.sector_tier as ValueTier | null,
      opportunityKeys: [],
      rules: catalog.rules,
      services: catalog.services,
    });
    const reasons = (latest.get(l.id as string) ?? []).filter((f) => f.points > 0).slice(0, 3).map((f) => f.label);
    return {
      id: l.id as string, company_id: l.company_id as string, company_name: l.company_name as string, city: l.city, sector_name: l.sector_name, score: l.score ?? 0,
      priority: l.priority ?? "cold", website_state: l.website_state, google_reviews_count: l.google_reviews_count, contact_status: l.contact_status ?? "not_contacted",
      reasons, package: rec.packageName, setup: rec.setup, monthly: rec.monthly,
    };
  });

  const sellableMap = new Map<string, { packageName: string; leads: number; setup: number; monthly: number }>();
  for (const l of topLeads) {
    const s = sellableMap.get(l.package) ?? { packageName: l.package, leads: 0, setup: 0, monthly: 0 };
    sellableMap.set(l.package, { ...s, leads: s.leads + 1, setup: s.setup + l.setup, monthly: s.monthly + l.monthly });
  }

  const count = (types: string[]) => (acts.data ?? []).filter((a) => types.includes(a.type)).length;
  const outreach = count(["email_sent", "whatsapp_sent", "call_logged"]);
  const replies = count(["reply_received"]);
  const meetings = count(["meeting_scheduled"]);

  return {
    attention: {
      hotLeads: hot.count ?? 0,
      overdueFollowUps: Math.max(overdueLeads.count ?? 0, overdueTasks.count ?? 0),
      proposalsAwaiting: proposals.count ?? 0,
      meetingsTomorrow: meetingsTomorrow.count ?? 0,
      meetingsToday: meetingsToday.count ?? 0,
    },
    topLeads,
    sellable: [...sellableMap.values()].sort((a, b) => b.setup - a.setup),
    performance: {
      outreach7d: outreach, replies7d: replies, meetings7d: meetings,
      replyRate: outreach ? (replies / outreach) * 100 : null,
      meetingRate: outreach ? (meetings / outreach) * 100 : null,
      winRate: metrics.win_rate, revenue30d: metrics.closed_revenue, pipeline: metrics.pipeline_value, weighted: metrics.weighted_pipeline, mrr: metrics.mrr,
    },
  };
}

/** Deterministic daily briefing text (the AI version rewrites this, it never replaces the data). */
export function buildBriefing(cc: CommandCenter, name: string, timeZone = "Europe/Madrid", now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone }).format(now));
  const greeting = `${hour < 13 ? "Good morning" : hour < 20 ? "Good afternoon" : "Good evening"}${name ? `, ${name}` : ""}.`;
  return {
    greeting,
    priorities: cc.topLeads.slice(0, 3).map((l) => ({
      company: l.company_name,
      score: l.score,
      reason: l.reasons.slice(0, 2).join(" + ") || (l.website_state === "missing" ? "No website" : "High score"),
      action: `${l.contact_status === "not_contacted" ? "First contact" : "Follow up"} — offer ${l.package}`,
      companyId: l.company_id,
    })),
    followUps: cc.attention.overdueFollowUps,
    meetings: cc.attention.meetingsToday + cc.attention.meetingsTomorrow,
    pipeline: cc.performance.pipeline,
  };
}
