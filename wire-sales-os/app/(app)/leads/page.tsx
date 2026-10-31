import type { Metadata } from "next";
import Link from "next/link";
import { Crosshair, Telescope, Upload, Plus } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { Pagination } from "@/components/app/pagination";
import { LeadFilterBar } from "@/components/leads/lead-filters";
import { LeadsTable, type LeadRow } from "@/components/leads/leads-table";
import { Button } from "@/components/ui/button";
import { getWorkspaceContext } from "@/lib/auth/session";
import { activeFilterCount, applyLeadFilters, parseLeadFilters } from "@/lib/filters/leads";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Leads" };

const COLUMNS = "id, company_id, company_name, sector_name, city, score, priority, website, website_state, website_score, website_top_issue, google_rating, google_reviews_count, stage_key, stage_name, contact_status, contact_name, next_follow_up_at, created_at";

export default async function LeadsPage({ searchParams }: PageProps<"/leads">) {
  const raw = await searchParams;
  const filters = parseLeadFilters(raw);
  const { supabase, workspace, isAdmin, user } = await getWorkspaceContext();

  const base = supabase.from("lead_overview").select(COLUMNS, { count: "exact" }).eq("workspace_id", workspace.id);
  const [{ data: rows, count, error }, { data: sectors }, { data: campaigns }, { data: saved }] = await Promise.all([
    applyLeadFilters(base, filters),
    supabase.from("sectors").select("id, name").eq("workspace_id", workspace.id).order("name"),
    supabase.from("campaigns").select("id, name").eq("workspace_id", workspace.id).order("created_at", { ascending: false }),
    supabase.from("saved_filters").select("id, name, filters, user_id").eq("workspace_id", workspace.id).eq("entity", "leads").order("created_at"),
  ]);
  if (error) throw new Error(error.message);

  const total = count ?? 0;
  const filtered = activeFilterCount(filters) > 0;
  const flatParams = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));

  return (
    <>
      <PageHeader
        title="Leads"
        description={`${formatNumber(total)} ${filtered ? "matching" : "total"} · sorted by ${filters.sort ?? "score"}`}
        actions={
          <>
            <Button variant="outline" size="sm" asChild><Link href="/leads/import"><Upload /> Import CSV</Link></Button>
            <Button variant="outline" size="sm" asChild><Link href="/prospects"><Telescope /> Find leads</Link></Button>
            <Button size="sm" asChild><Link href="/leads/new"><Plus /> New lead</Link></Button>
          </>
        }
      >
        <div className="mt-4">
          <LeadFilterBar
            sectors={sectors ?? []}
            campaigns={campaigns ?? []}
            saved={(saved ?? []).map((s) => ({ id: s.id, name: s.name, filters: s.filters as Record<string, unknown>, mine: s.user_id === user.id }))}
          />
        </div>
      </PageHeader>
      {rows && rows.length > 0 ? (
        <>
          <LeadsTable rows={rows as LeadRow[]} campaigns={campaigns ?? []} isAdmin={isAdmin} />
          <Pagination page={filters.page ?? 1} per={filters.per ?? 50} total={total} basePath="/leads" params={flatParams as Record<string, string | undefined>} />
        </>
      ) : filtered ? (
        <EmptyState icon={Crosshair} title="No leads match these filters" description="Loosen a filter or clear them to see every lead." action={<Button variant="outline" size="sm" asChild><Link href="/leads">Clear filters</Link></Button>} />
      ) : (
        <EmptyState
          icon={Crosshair}
          title="No leads yet"
          description="Import a CSV, discover businesses by sector and city, or add your first lead manually."
          action={
            <div className="flex gap-2">
              <Button size="sm" asChild><Link href="/leads/new"><Plus /> New lead</Link></Button>
              <Button size="sm" variant="outline" asChild><Link href="/leads/import"><Upload /> Import CSV</Link></Button>
            </div>
          }
        />
      )}
    </>
  );
}
