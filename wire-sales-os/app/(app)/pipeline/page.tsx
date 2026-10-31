import type { Metadata } from "next";
import Link from "next/link";
import { Columns3 } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { Kanban, type KanbanDeal, type KanbanStage } from "@/components/pipeline/kanban";
import { Button } from "@/components/ui/button";
import { getWorkspaceContext } from "@/lib/auth/session";
import { formatCurrency, isoDaysAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Pipeline" };

const COLUMNS = "id, title, company_id, company_name, contact_name, stage_id, value, setup_value, monthly_value, probability, weighted_value, next_action, next_action_at, last_contact_at, sort_order, lead_priority, expected_close_date, status, won_at, lost_at";

export default async function PipelinePage() {
  const { supabase, workspace } = await getWorkspaceContext();
  const since = isoDaysAgo(90);
  const [{ data: stages }, { data: open }, { data: won }, { data: lost }] = await Promise.all([
    supabase.from("pipeline_stages").select("id, key, name, probability, is_won, is_lost").eq("workspace_id", workspace.id).order("position"),
    supabase.from("deal_overview").select(COLUMNS).eq("workspace_id", workspace.id).eq("status", "open").order("sort_order").limit(1000),
    supabase.from("deal_overview").select(COLUMNS).eq("workspace_id", workspace.id).eq("status", "won").gte("won_at", since).order("won_at", { ascending: false }).limit(50),
    supabase.from("deal_overview").select(COLUMNS).eq("workspace_id", workspace.id).eq("status", "lost").gte("lost_at", since).order("lost_at", { ascending: false }).limit(50),
  ]);
  const deals = [...(open ?? []), ...(won ?? []), ...(lost ?? [])].map((d) => ({ ...d, value: Number(d.value), setup_value: Number(d.setup_value), monthly_value: Number(d.monthly_value), weighted_value: Number(d.weighted_value) })) as KanbanDeal[];
  const openValue = (open ?? []).reduce((a, d) => a + Number(d.value), 0);
  const weighted = (open ?? []).reduce((a, d) => a + Number(d.weighted_value), 0);

  return (
    <>
      <PageHeader
        title="Pipeline"
        description={`${open?.length ?? 0} open deals · ${formatCurrency(openValue)} pipeline · ${formatCurrency(weighted)} weighted · won/lost: last 90 days`}
        actions={<Button size="sm" variant="outline" asChild><Link href="/leads?stage=none&sort=score">Add leads to pipeline</Link></Button>}
        className="border-b-0"
      />
      {deals.length ? (
        <Kanban stages={(stages ?? []) as KanbanStage[]} initialDeals={deals} />
      ) : (
        <EmptyState icon={Columns3} title="The pipeline is empty" description="Qualify leads (“Add to pipeline”) or log a first email — deals are created automatically with the recommended package." action={<Button size="sm" asChild><Link href="/leads?sort=score">Open top leads</Link></Button>} />
      )}
    </>
  );
}
