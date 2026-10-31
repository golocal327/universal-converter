import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CalendarClock, FileClock, Flame } from "lucide-react";
import { PriorityBadge, ScoreBadge } from "@/components/app/badges";
import { PageBody, Section } from "@/components/app/page-header";
import { StatTile } from "@/components/app/stat-tile";
import { DailyBriefing } from "@/components/command-center/daily-briefing";
import { Button } from "@/components/ui/button";
import { isAIConfigured } from "@/lib/ai";
import { getActor } from "@/lib/auth/actor";
import { getWorkspaceContext } from "@/lib/auth/session";
import { buildBriefing, getCommandCenter } from "@/lib/data/command-center";
import { CONTACT_STATUS_LABELS, type ContactStatus } from "@/lib/domain/constants";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Command Center" };

export default async function CommandCenterPage() {
  const { user, workspace } = await getWorkspaceContext();
  const cc = await getCommandCenter(await getActor());
  const firstName = ((user.user_metadata?.full_name as string | undefined) ?? "").split(" ")[0];
  const briefing = buildBriefing(cc, firstName, workspace.timezone);
  const a = cc.attention;
  const attention = [
    { icon: Flame, value: a.hotLeads, label: "hot leads not contacted", href: "/leads?priority=hot&contact=not_contacted", tone: "text-hot" },
    { icon: AlertTriangle, value: a.overdueFollowUps, label: "follow-ups overdue", href: "/tasks?view=overdue", tone: "text-destructive" },
    { icon: FileClock, value: a.proposalsAwaiting, label: "proposals awaiting response", href: "/pipeline", tone: "text-foreground" },
    { icon: CalendarClock, value: a.meetingsTomorrow, label: a.meetingsTomorrow === 1 ? "meeting tomorrow" : "meetings tomorrow", href: "/tasks?view=upcoming", tone: "text-foreground" },
  ];
  const p = cc.performance;

  return (
    <PageBody className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">{workspace.name} Command Center</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">What needs your attention</h1>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" asChild><Link href="/prospects">Find leads</Link></Button>
          <Button size="sm" asChild><Link href="/leads?sort=score">Work the list</Link></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {attention.map((item) => (
          <Link key={item.label} href={item.href} className="group rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40">
            <item.icon className={cn("size-4", item.value ? item.tone : "text-muted-foreground")} />
            <p className="mt-3 text-3xl font-semibold tracking-tight">{item.value}</p>
            <p className="text-sm text-muted-foreground group-hover:text-foreground">{item.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Section title="Who should I contact?" description="Top 10 open leads by score" actions={<Link href="/leads?sort=score" className="text-xs text-muted-foreground hover:text-foreground">All leads</Link>}>
          {cc.topLeads.length ? (
            <ol className="divide-y">
              {cc.topLeads.map((l, i) => (
                <li key={l.id}>
                  <Link href={`/companies/${l.company_id}?tab=outreach`} className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 hover:bg-muted/40">
                    <span className="tabular text-xs text-muted-foreground">{i + 1}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{l.company_name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{l.reasons.length ? l.reasons.join(" · ") : [l.sector_name, l.city].filter(Boolean).join(" · ")}</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="hidden text-xs text-muted-foreground sm:inline">{CONTACT_STATUS_LABELS[l.contact_status as ContactStatus]}</span>
                      <PriorityBadge priority={l.priority} />
                      <ScoreBadge score={l.score} />
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <p className="px-4 py-8 text-sm text-muted-foreground">No open leads. <Link href="/leads/import" className="underline">Import</Link> or <Link href="/prospects" className="underline">discover</Link> businesses.</p>
          )}
        </Section>
        <DailyBriefing briefing={briefing} aiConfigured={isAIConfigured()} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Section title="What can I sell?" description="Recommended packages for your top leads">
          {cc.sellable.length ? (
            <ul className="divide-y">
              {cc.sellable.map((s) => (
                <li key={s.packageName} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span><span className="block text-sm font-medium">{s.packageName}</span><span className="text-xs text-muted-foreground">{s.leads} lead{s.leads === 1 ? "" : "s"}</span></span>
                  <span className="text-right"><span className="tabular block text-sm font-semibold">{formatCurrency(s.setup)}</span><span className="tabular text-xs text-muted-foreground">+ {formatCurrency(s.monthly)}/mo MRR</span></span>
                </li>
              ))}
            </ul>
          ) : <p className="px-4 py-8 text-sm text-muted-foreground">Nothing to sell yet.</p>}
        </Section>
        <Section title="How am I performing?" description="Outreach last 7 days · revenue last 30 days">
          <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-3">
            <StatTile label="Weekly outreach" value={formatNumber(p.outreach7d)} hint={`${p.replies7d} replies`} />
            <StatTile label="Reply rate" value={formatPercent(p.replyRate, 1)} />
            <StatTile label="Meeting rate" value={formatPercent(p.meetingRate, 1)} hint={`${p.meetings7d} meetings`} />
            <StatTile label="Win rate" value={formatPercent(p.winRate, 1)} hint="Last 30 days" />
            <StatTile label="Revenue" value={formatCurrency(p.revenue30d, true)} hint="Closed, 30 days" />
            <StatTile label="Pipeline" value={formatCurrency(p.pipeline, true)} hint={`${formatCurrency(p.weighted, true)} weighted · MRR ${formatCurrency(p.mrr)}`} />
          </div>
        </Section>
      </div>
    </PageBody>
  );
}
