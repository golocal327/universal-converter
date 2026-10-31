import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Users } from "lucide-react";
import { PriorityBadge, ScoreBadge, StageBadge, WebsiteState } from "@/components/app/badges";
import { EmptyState } from "@/components/app/empty-state";
import { PageBody, PageHeader, Section } from "@/components/app/page-header";
import { StatTile } from "@/components/app/stat-tile";
import { AddMatchingLeadsButton, DeleteCampaignButton, RemoveFromCampaign } from "@/components/campaigns/campaign-detail-actions";
import { CampaignDialog } from "@/components/campaigns/campaign-dialog";
import { Funnel } from "@/components/charts/funnel";
import { getWorkspaceContext } from "@/lib/auth/session";
import { WEBSITE_REQUIREMENT_LABELS, type CampaignStatus, type Channel, type WebsiteRequirement } from "@/lib/domain/constants";
import { formatCurrency, formatPercent } from "@/lib/format";

export const metadata: Metadata = { title: "Campaign" };

export default async function CampaignPage({ params }: PageProps<"/campaigns/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, workspace } = await getWorkspaceContext();
  const { data: c } = await supabase.from("campaign_overview").select("*").eq("workspace_id", workspace.id).eq("id", id).maybeSingle();
  if (!c) notFound();
  const [{ data: leads }, { data: sectors }, { data: templates }] = await Promise.all([
    supabase.from("lead_overview").select("id, company_id, company_name, city, sector_name, score, priority, website_state, website_score, stage_key, stage_name").eq("workspace_id", workspace.id).contains("campaign_ids", [id]).order("score", { ascending: false }).limit(300),
    supabase.from("sectors").select("id, name").eq("workspace_id", workspace.id).order("name"),
    supabase.from("email_templates").select("id, name").eq("workspace_id", workspace.id).eq("is_archived", false).order("name"),
  ]);
  const n = (v: number | null) => v ?? 0;
  const rate = (a: number | null, b: number | null) => (n(b) ? formatPercent((n(a) / n(b)) * 100, 1) : "—");

  return (
    <>
      <PageHeader
        title={c.name}
        description={[c.target_sector_name ?? "Any sector", c.target_location, `Website: ${WEBSITE_REQUIREMENT_LABELS[(c.website_requirement ?? "any") as WebsiteRequirement]}`, c.channel, c.status].filter(Boolean).join(" · ")}
        actions={
          <>
            <AddMatchingLeadsButton campaignId={id} />
            <CampaignDialog sectors={sectors ?? []} templates={templates ?? []} trigger="edit"
              initial={{ id, name: c.name ?? "", description: c.description, target_sector_id: c.target_sector_id, target_location: c.target_location, website_requirement: (c.website_requirement ?? "any") as WebsiteRequirement, channel: (c.channel ?? "email") as Channel, status: (c.status ?? "draft") as CampaignStatus, template_id: c.template_id }} />
            <DeleteCampaignButton campaignId={id} />
          </>
        }
      />
      <PageBody className="space-y-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label="Leads" value={n(c.leads)} />
          <StatTile label="Reply rate" value={rate(c.replied, c.contacted)} hint={`${n(c.replied)} of ${n(c.contacted)} contacted`} />
          <StatTile label="Conversion" value={rate(c.won, c.leads)} hint={`${n(c.won)} won`} />
          <StatTile label="Revenue" value={formatCurrency(c.revenue)} />
        </div>
        <Section title="Campaign funnel">
          <Funnel steps={[
            { key: "leads", name: "Leads", count: n(c.leads) }, { key: "contacted", name: "Contacted", count: n(c.contacted) },
            { key: "delivered", name: "Delivered", count: n(c.delivered) }, { key: "opened", name: "Opened", count: n(c.opened) },
            { key: "replied", name: "Replied", count: n(c.replied) }, { key: "meetings", name: "Meetings", count: n(c.meetings) }, { key: "won", name: "Won", count: n(c.won) },
          ]} />
          <p className="px-4 pb-3 text-xs text-muted-foreground">Delivered/opened are recorded when emails are sent through a connected provider; manual sends count as contacted.</p>
        </Section>
        <Section title={`Leads (${leads?.length ?? 0})`}>
          {leads?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <tbody>
                  {leads.map((l) => (
                    <tr key={l.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="px-4 py-2.5"><Link href={`/companies/${l.company_id}?tab=outreach`} className="font-medium hover:underline">{l.company_name}</Link><span className="block text-xs text-muted-foreground">{[l.sector_name, l.city].filter(Boolean).join(" · ")}</span></td>
                      <td className="px-3 py-2.5"><ScoreBadge score={l.score} /></td>
                      <td className="px-3 py-2.5"><PriorityBadge priority={l.priority ?? "cold"} /></td>
                      <td className="px-3 py-2.5"><WebsiteState state={l.website_state} score={l.website_score} /></td>
                      <td className="px-3 py-2.5"><StageBadge stageKey={l.stage_key} name={l.stage_name} /></td>
                      <td className="px-3 py-2.5 text-right"><RemoveFromCampaign campaignId={id} leadId={l.id as string} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={Users} title="No leads in this campaign" description="Use “Add matching leads” to pull every lead that fits the target, or add leads from the Leads table." />
          )}
        </Section>
      </PageBody>
    </>
  );
}
