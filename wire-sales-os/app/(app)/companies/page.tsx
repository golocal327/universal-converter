import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { ScoreBadge, WebsiteState } from "@/components/app/badges";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { Pagination } from "@/components/app/pagination";
import { FilterLink, SearchInput } from "@/components/app/search-input";
import { Button } from "@/components/ui/button";
import { getWorkspaceContext } from "@/lib/auth/session";
import { sanitizeSearch } from "@/lib/filters/leads";
import { formatDate, formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Companies" };
const PER = 50;

export default async function CompaniesPage({ searchParams }: PageProps<"/companies">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sanitizeSearch(sp.q).slice(0, 80) : "";
  const view = sp.view === "customers" ? "customers" : sp.view === "no_website" ? "no_website" : "all";
  const page = Math.max(1, Number(sp.page) || 1);
  const { supabase, workspace } = await getWorkspaceContext();

  let query = supabase
    .from("companies")
    .select("id, name, city, website, domain, website_score, is_customer, google_rating, google_reviews_count, created_at, sector:sectors(name), lead:leads(score)", { count: "exact" })
    .eq("workspace_id", workspace.id);
  if (q) query = query.or(`name.ilike.%${q}%,city.ilike.%${q}%,domain.ilike.%${q}%,email.ilike.%${q}%`);
  if (view === "customers") query = query.eq("is_customer", true);
  if (view === "no_website") query = query.is("website", null);
  const { data: rows, count, error } = await query.order("created_at", { ascending: false }).range((page - 1) * PER, page * PER - 1);
  if (error) throw new Error(error.message);

  const link = (v: string) => `/companies?${new URLSearchParams({ ...(q ? { q } : {}), ...(v !== "all" ? { view: v } : {}) })}`;
  return (
    <>
      <PageHeader title="Companies" description={`${formatNumber(count ?? 0)} companies`} actions={<Button size="sm" asChild><Link href="/leads/new"><Plus /> New company</Link></Button>}>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <SearchInput placeholder="Search companies…" />
          <FilterLink href={link("all")} active={view === "all"}>All</FilterLink>
          <FilterLink href={link("customers")} active={view === "customers"}>Customers</FilterLink>
          <FilterLink href={link("no_website")} active={view === "no_website"}>No website</FilterLink>
        </div>
      </PageHeader>
      {rows && rows.length ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Company</th>
                  <th className="px-3 py-2 text-left font-medium">Lead score</th>
                  <th className="px-3 py-2 text-left font-medium">Website</th>
                  <th className="px-3 py-2 text-left font-medium">Google</th>
                  <th className="px-3 py-2 text-left font-medium">Added</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const sector = c.sector as unknown as { name: string } | null;
                  const lead = (c.lead as unknown as { score: number }[] | { score: number } | null);
                  const score = Array.isArray(lead) ? lead[0]?.score : lead?.score;
                  return (
                    <tr key={c.id} className="border-b hover:bg-muted/40">
                      <td className="px-4 py-2.5">
                        <Link href={`/companies/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                        {c.is_customer && <span className="ml-2 rounded-full bg-success-soft px-1.5 py-0.5 text-[11px] font-medium text-success">Customer</span>}
                        <span className="block text-xs text-muted-foreground">{[sector?.name, c.city].filter(Boolean).join(" · ") || "—"}</span>
                      </td>
                      <td className="px-3 py-2.5"><ScoreBadge score={score ?? null} /></td>
                      <td className="px-3 py-2.5"><WebsiteState state={!c.website ? "missing" : c.website_score === null ? "unknown" : c.website_score < 50 ? "weak" : "good"} score={c.website_score} /></td>
                      <td className="tabular px-3 py-2.5 text-xs">{c.google_reviews_count !== null ? `${c.google_rating ?? "—"}★ · ${formatNumber(c.google_reviews_count)}` : "—"}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{formatDate(c.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} per={PER} total={count ?? 0} basePath="/companies" params={{ q: q || undefined, view: view !== "all" ? view : undefined }} />
        </>
      ) : (
        <EmptyState icon={Building2} title={q || view !== "all" ? "No companies match" : "No companies yet"} description="Companies are created with leads — import a CSV or add a lead." action={<Button size="sm" asChild><Link href="/leads/new"><Plus /> New lead</Link></Button>} />
      )}
    </>
  );
}
