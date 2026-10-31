import type { Metadata } from "next";
import { PageBody, PageHeader, Section } from "@/components/app/page-header";
import { RangeTabs } from "@/components/app/range-tabs";
import { StatTile } from "@/components/app/stat-tile";
import { BarList } from "@/components/charts/bar-list";
import { ColumnSeries } from "@/components/charts/column-series";
import { Funnel } from "@/components/charts/funnel";
import { getWorkspaceContext } from "@/lib/auth/session";
import { getAnalytics, RANGES, resolveRange } from "@/lib/data/analytics";
import { formatCurrency, formatPercent } from "@/lib/format";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage({ searchParams }: PageProps<"/analytics">) {
  const sp = await searchParams;
  const range = resolveRange(sp.range);
  const { supabase, workspace } = await getWorkspaceContext();
  const a = await getAnalytics(supabase, workspace.id, range.from, range.to);
  const days = RANGES[range.key];
  const sum = (k: "contacts" | "replies" | "meetings" | "proposals" | "sales") => a.series.reduce((acc, s) => acc + s[k], 0);
  const contacts = sum("contacts");
  const replies = sum("replies");
  const meetings = sum("meetings");

  const conversions = a.funnel.map((f, i) => ({ ...f, rate: i === 0 ? 100 : a.funnel[i - 1].count ? (f.count / a.funnel[i - 1].count) * 100 : 0 }));
  const revenue = (rows: typeof a.revenue_by_sector) => rows.map((r) => ({ label: r.label, value: r.revenue, detail: `${r.deals} deal(s)${r.mrr ? ` · ${formatCurrency(r.mrr)}/mo` : ""}` }));

  return (
    <>
      <PageHeader title="Analytics" description="Funnel, revenue and outreach performance for the selected period." actions={<RangeTabs basePath="/analytics" active={range.key} />} />
      <PageBody className="space-y-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatTile label="Closed revenue" value={formatCurrency(a.closed_revenue, true)} hint="Setup + 12× monthly" />
          <StatTile label="One-time revenue" value={formatCurrency(a.one_time_revenue, true)} />
          <StatTile label="MRR" value={formatCurrency(a.mrr)} hint={`ARR ${formatCurrency(a.arr, true)}`} />
          <StatTile label="Average deal size" value={formatCurrency(a.avg_deal_size)} />
          <StatTile label="Win rate" value={formatPercent(a.win_rate, 1)} hint={`${a.deals_won} won · ${a.deals_lost} lost`} />
          <StatTile label="Reply rate" value={formatPercent(contacts ? (replies / contacts) * 100 : null, 1)} hint={`${replies} replies / ${contacts} contacts`} />
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Section title="Funnel" description="Leads created in the period, by furthest stage reached">
            <Funnel steps={a.funnel} />
            <div className="border-t px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Overall conversion lead → won: <span className="font-medium text-foreground">{formatPercent(a.funnel[0]?.count ? ((a.funnel.at(-1)?.count ?? 0) / a.funnel[0].count) * 100 : null, 1)}</span>
                {" · "}Weakest step: <span className="font-medium text-foreground">{conversions.slice(1).sort((x, y) => x.rate - y.rate)[0]?.name ?? "—"}</span>
              </p>
            </div>
          </Section>
          <Section title="Performance" description={`Per day, last ${days} days`}>
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
              <ColumnSeries title="Contacts" data={a.series.map((s) => ({ day: s.day, value: s.contacts }))} total={`${(contacts / days).toFixed(1)}/day`} />
              <ColumnSeries title="Replies" data={a.series.map((s) => ({ day: s.day, value: s.replies }))} total={`${(replies / days).toFixed(1)}/day`} />
              <ColumnSeries title="Meetings" data={a.series.map((s) => ({ day: s.day, value: s.meetings }))} total={`${((meetings / days) * 7).toFixed(1)}/week`} />
              <ColumnSeries title="Proposals" data={a.series.map((s) => ({ day: s.day, value: s.proposals }))} />
              <ColumnSeries title="Sales" data={a.series.map((s) => ({ day: s.day, value: s.sales }))} />
            </div>
          </Section>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="Revenue by sector"><BarList caption="Revenue by sector" data={revenue(a.revenue_by_sector)} format="currency" emptyLabel="No won deals in this period" /></Section>
          <Section title="Revenue by service"><BarList caption="Revenue by service" data={revenue(a.revenue_by_service)} format="currency" emptyLabel="No won deals in this period" /></Section>
          <Section title="Revenue by campaign"><BarList caption="Revenue by campaign" data={revenue(a.revenue_by_campaign)} format="currency" emptyLabel="No won deals in this period" /></Section>
          <Section title="Revenue by city"><BarList caption="Revenue by city" data={revenue(a.revenue_by_city)} format="currency" emptyLabel="No won deals in this period" /></Section>
        </div>
      </PageBody>
    </>
  );
}
