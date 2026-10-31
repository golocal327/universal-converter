import type { Metadata } from "next";
import Link from "next/link";
import { Megaphone } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { CampaignDialog } from "@/components/campaigns/campaign-dialog";
import { getWorkspaceContext } from "@/lib/auth/session";
import { WEBSITE_REQUIREMENT_LABELS, type WebsiteRequirement } from "@/lib/domain/constants";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Campaigns" };

const STATUS_STYLE: Record<string, string> = {
  active: "bg-success-soft text-success", draft: "bg-muted text-muted-foreground", paused: "bg-warm-soft text-[color-mix(in_oklch,var(--warm),var(--foreground)_35%)]", completed: "bg-cold-soft text-cold",
};

export default async function CampaignsPage() {
  const { supabase, workspace } = await getWorkspaceContext();
  const [{ data: campaigns }, { data: sectors }, { data: templates }] = await Promise.all([
    supabase.from("campaign_overview").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false }),
    supabase.from("sectors").select("id, name").eq("workspace_id", workspace.id).order("name"),
    supabase.from("email_templates").select("id, name").eq("workspace_id", workspace.id).eq("is_archived", false).order("name"),
  ]);
  const metric = (n: number | null) => <td className="tabular px-3 py-3 text-right">{formatNumber(n ?? 0)}</td>;
  return (
    <>
      <PageHeader title="Campaigns" description="Outbound campaigns by sector, location and website quality." actions={<CampaignDialog sectors={sectors ?? []} templates={templates ?? []} />} />
      {campaigns?.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-sm">
            <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Campaign</th>
                {["Leads", "Contacted", "Delivered", "Opened", "Replied", "Meetings", "Won", "Conversion", "Revenue"].map((h) => <th key={h} className="px-3 py-2 text-right font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="border-b hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link href={`/campaigns/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                      <span className={cn("rounded-full px-1.5 py-0.5 text-[11px] font-medium capitalize", STATUS_STYLE[c.status ?? "draft"])}>{c.status}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{[c.target_sector_name ?? "Any sector", c.target_location, `Website: ${WEBSITE_REQUIREMENT_LABELS[(c.website_requirement ?? "any") as WebsiteRequirement]}`, c.channel].filter(Boolean).join(" · ")}</p>
                  </td>
                  {metric(c.leads)}{metric(c.contacted)}{metric(c.delivered)}{metric(c.opened)}{metric(c.replied)}{metric(c.meetings)}{metric(c.won)}
                  <td className="tabular px-3 py-3 text-right">{formatPercent(c.leads ? ((c.won ?? 0) / c.leads) * 100 : null, 1)}</td>
                  <td className="tabular px-3 py-3 text-right font-medium">{formatCurrency(c.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={Megaphone} title="No campaigns yet" description="Group leads by sector and city (e.g. “Autoescuelas Cádiz”) to track outreach and conversion per segment." />
      )}
    </>
  );
}
