import type { Metadata } from "next";
import Link from "next/link";
import { Settings2, Telescope, Upload } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { FindLeadsForm } from "@/components/prospects/find-leads-form";
import { ProspectResults, type ProspectRow } from "@/components/prospects/prospect-results";
import { Button } from "@/components/ui/button";
import { getWorkspaceContext } from "@/lib/auth/session";
import { formatNumber, formatRelative } from "@/lib/format";
import { isPlacesConfigured } from "@/lib/integrations/google-places";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Prospects" };

export default async function ProspectsPage({ searchParams }: PageProps<"/prospects">) {
  const sp = await searchParams;
  const { supabase, workspace } = await getWorkspaceContext();
  const configured = isPlacesConfigured();
  const [{ data: sectors }, { data: runs }] = await Promise.all([
    supabase.from("sectors").select("id, name").eq("workspace_id", workspace.id).order("name"),
    supabase.from("discovery_runs").select("id, query, total, high_priority, medium_priority, low_priority, created_at").eq("workspace_id", workspace.id).order("created_at", { ascending: false }).limit(12),
  ]);
  const runId = typeof sp.run === "string" ? sp.run : runs?.[0]?.id;
  const run = runs?.find((r) => r.id === runId) ?? null;
  const { data: prospects } = run
    ? await supabase.from("prospects").select("id, name, city, website, google_rating, google_reviews_count, score, priority, biggest_opportunity, recommended_action, status, company_id, duplicate_of_company_id").eq("run_id", run.id).order("score", { ascending: false })
    : { data: null };
  const sectorName = (q: unknown) => {
    const query = q as { sectorId?: string; sectorText?: string; location?: string };
    return `${sectors?.find((s) => s.id === query.sectorId)?.name ?? query.sectorText ?? "Businesses"} · ${query.location ?? ""}`;
  };

  return (
    <>
      <PageHeader title="Prospects" description="Find businesses by sector and location, pre-scored and de-duplicated before they enter the CRM." />
      <PageBody className="space-y-6">
        {configured ? (
          <FindLeadsForm sectors={sectors ?? []} />
        ) : (
          <div className="rounded-xl border border-dashed p-5">
            <p className="flex items-center gap-2 text-sm font-medium"><Settings2 className="size-4" /> Lead discovery requires configuration</p>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Set <code className="font-mono text-xs">GOOGLE_PLACES_API_KEY</code> (Places API (New), Text Search) to search businesses by sector and city from here.
              Meanwhile you can bring leads from any source — Apify, Outscraper, spreadsheets — through CSV import or the Public Lead API; they go through the same normalize → validate → dedupe → score pipeline.
            </p>
            <div className="mt-4 flex gap-2">
              <Button size="sm" variant="outline" asChild><Link href="/leads/import"><Upload /> Import CSV</Link></Button>
              <Button size="sm" variant="ghost" asChild><Link href="/settings?tab=automation">Public API & keys</Link></Button>
            </div>
          </div>
        )}

        {run ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">{sectorName(run.query)}</h2>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{formatNumber(run.total)}</span> potential businesses ·{" "}
                  <span className="text-hot">{run.high_priority} high</span> · {run.medium_priority} medium · {run.low_priority} low priority
                </p>
              </div>
              {runs && runs.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  {runs.slice(0, 6).map((r) => (
                    <Link key={r.id} href={`/prospects?run=${r.id}`} className={cn("rounded-md border px-2 py-1 text-xs", r.id === run.id ? "border-foreground" : "text-muted-foreground hover:bg-muted")}>
                      {sectorName(r.query)} · {formatRelative(r.created_at)}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            {prospects?.length ? <ProspectResults rows={prospects as ProspectRow[]} /> : <EmptyState icon={Telescope} title="No businesses matched the filters" description="Widen the review range or the website requirement." />}
          </div>
        ) : configured ? (
          <EmptyState icon={Telescope} title="Run your first search" description="Example: Autoescuelas · Sevilla · website missing/weak · min 50 reviews." />
        ) : null}
      </PageBody>
    </>
  );
}
