import type { Metadata } from "next";
import Link from "next/link";
import { PriorityBadge, ScoreBadge } from "@/components/app/badges";
import { PageBody, PageHeader, Section } from "@/components/app/page-header";
import { RangeTabs } from "@/components/app/range-tabs";
import { StatTile } from "@/components/app/stat-tile";
import { Funnel } from "@/components/charts/funnel";
import { Timeline } from "@/components/company/timeline";
import { getWorkspaceContext } from "@/lib/auth/session";
import { getDashboardMetrics, resolveRange } from "@/lib/data/analytics";
import { formatCurrency, formatNumber, formatPercent, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const sp = await searchParams;
  const range = resolveRange(sp.range ?? "30d");
  const { supabase, workspace } = await getWorkspaceContext();
  const nowIso = new Date(range.to.getTime() - 86_400_000 + 1).toISOString();
  const [m, { data: stages }, { data: openDeals }, { data: activity }, { data: tasks }, { data: hot }] = await Promise.all([
    getDashboardMetrics(supabase, workspace.id, range.from),
    supabase.from("pipeline_stages").select("id, key, name, is_won, is_lost").eq("workspace_id", workspace.id).order("position"),
    supabase.from("deals").select("stage_id, value").eq("workspace_id", workspace.id).eq("status", "open"),
    supabase.from("activities").select("id, type, title, body, occurred_at, company:companies(id, name)").eq("workspace_id", workspace.id).in("type", ["lead_created", "reply_received", "meeting_scheduled", "deal_won", "proposal_sent", "email_sent"]).order("occurred_at", { ascending: false }).limit(12),
    supabase.from("tasks").select("id, title, type, due_at, company_id, company:companies(name)").eq("workspace_id", workspace.id).in("status", ["todo", "in_progress"]).order("due_at", { nullsFirst: false }).limit(8),
    supabase.from("lead_overview").select("id, company_id, company_name, city, sector_name, score, priority, website_top_issue, website_state").eq("workspace_id", workspace.id).eq("priority", "hot").not("status", "eq", "disqualified").order("score", { ascending: false }).limit(6),
  ]);
  const byStage = new Map<string, { count: number; value: number }>();
  for (const d of openDeals ?? []) {
    const s = byStage.get(d.stage_id) ?? { count: 0, value: 0 };
    byStage.set(d.stage_id, { count: s.count + 1, value: s.value + Number(d.value) });
  }
  const openStages = (stages ?? []).filter((s) => !s.is_won && !s.is_lost);
  const maxValue = Math.max(1, ...openStages.map((s) => byStage.get(s.id)?.value ?? 0));

  const kpis: [string, string, string?][] = [
    ["Leads found", formatNumber(m.leads_found)], ["Qualified", formatNumber(m.leads_qualified)], ["Contacted", formatNumber(m.leads_contacted)],
    ["Replies", formatNumber(m.replies)], ["Meetings", formatNumber(m.meetings)], ["Proposals", formatNumber(m.proposals)],
    ["Won", formatNumber(m.won)], ["Lost", formatNumber(m.lost)], ["Conversion rate", formatPercent(m.conversion_rate, 1), "Leads → won"],
  ];

  return (
    <>
      <PageHeader title="Dashboard" description="Commercial performance for the selected period." actions={<RangeTabs basePath="/dashboard" active={range.key} />} />
      <PageBody className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-9">
          {kpis.map(([label, value, hint]) => <StatTile key={label} label={label} value={value} hint={hint} />)}
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <StatTile label="Pipeline value" value={formatCurrency(m.pipeline_value, true)} hint={`${m.open_deals} open deals`} href="/pipeline" />
          <StatTile label="Weighted pipeline" value={formatCurrency(m.weighted_pipeline, true)} hint="Value × probability" />
          <StatTile label="Closed revenue" value={formatCurrency(m.closed_revenue, true)} hint="In period" />
          <StatTile label="MRR" value={formatCurrency(m.mrr)} hint={`+${formatCurrency(m.new_mrr)} new in period`} />
          <StatTile label="One-time revenue" value={formatCurrency(m.one_time_revenue, true)} hint="Setup fees in period" />
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Section title="Funnel" description="Leads created in the period, by furthest stage reached">
            <Funnel steps={m.funnel} />
          </Section>
          <Section title="Pipeline by stage" description="Open deals today" actions={<Link href="/pipeline" className="text-xs text-muted-foreground hover:text-foreground">Open pipeline</Link>}>
            <ul className="space-y-2 px-4 py-4">
              {openStages.map((s) => {
                const v = byStage.get(s.id) ?? { count: 0, value: 0 };
                return (
                  <li key={s.id} className="grid grid-cols-[6.5rem_1fr_6rem] items-center gap-3 text-sm sm:grid-cols-[8rem_1fr_7rem]">
                    <span className="truncate text-muted-foreground">{s.name}</span>
                    <span className="flex h-5 items-center"><span className="h-5 rounded-r-[4px] bg-chart-1" style={{ width: `${Math.max(1.5, (v.value / maxValue) * 100)}%` }} /></span>
                    <span className="tabular text-right text-xs"><span className="font-medium">{formatCurrency(v.value, true)}</span> <span className="text-muted-foreground">· {v.count}</span></span>
                  </li>
                );
              })}
            </ul>
          </Section>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <Section title="Hot opportunities" actions={<Link href="/leads?priority=hot" className="text-xs text-muted-foreground hover:text-foreground">All hot leads</Link>}>
            <ul className="divide-y">
              {(hot ?? []).map((l) => (
                <li key={l.id}>
                  <Link href={`/companies/${l.company_id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/40">
                    <span className="min-w-0"><span className="block truncate text-sm font-medium">{l.company_name}</span><span className="block truncate text-xs text-muted-foreground">{l.website_state === "missing" ? "No website" : l.website_top_issue ?? [l.sector_name, l.city].filter(Boolean).join(" · ")}</span></span>
                    <span className="flex items-center gap-2"><ScoreBadge score={l.score} /><PriorityBadge priority="hot" /></span>
                  </Link>
                </li>
              ))}
              {!hot?.length && <li className="px-4 py-6 text-sm text-muted-foreground">No hot leads right now.</li>}
            </ul>
          </Section>
          <Section title="Pending tasks & follow-ups" actions={<Link href="/tasks" className="text-xs text-muted-foreground hover:text-foreground">All tasks</Link>}>
            <ul className="divide-y">
              {(tasks ?? []).map((t) => {
                const overdue = t.due_at && t.due_at < nowIso;
                return (
                  <li key={t.id} className="px-4 py-2.5">
                    <p className="truncate text-sm">{t.title}</p>
                    <p className={cn("text-xs text-muted-foreground", overdue && "font-medium text-destructive")}>{t.due_at ? formatRelative(t.due_at) : "No date"}{t.company_id ? ` · ${(t.company as unknown as { name: string } | null)?.name ?? ""}` : ""}</p>
                  </li>
                );
              })}
              {!tasks?.length && <li className="px-4 py-6 text-sm text-muted-foreground">No pending tasks.</li>}
            </ul>
          </Section>
          <Section title="Activity">
            <div className="p-4">
              <Timeline items={(activity ?? []).map((a) => ({ ...a, title: `${a.title}${(a.company as unknown as { name: string } | null)?.name ? ` · ${(a.company as unknown as { name: string }).name}` : ""}` }))} />
            </div>
          </Section>
        </div>
      </PageBody>
    </>
  );
}
