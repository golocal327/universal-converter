import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, CircleDashed, Settings2 } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { AutomationPanel } from "@/components/settings/automation-panel";
import { DataPanel } from "@/components/settings/data-panel";
import { PricingPanel, type RuleRow, type ServiceRow } from "@/components/settings/pricing-panel";
import { AIForm, ScoringForm } from "@/components/settings/scoring-ai-panels";
import { SectorsPanel, type SectorRow } from "@/components/settings/sectors-panel";
import { WorkspaceForm } from "@/components/settings/workspace-form";
import { availableProviders } from "@/lib/ai";
import { getWorkspaceContext } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env";
import { formatDateTime, formatNumber } from "@/lib/format";
import { listIntegrations } from "@/lib/integrations/registry";
import type { PricingConditions } from "@/lib/pricing/engine";
import { loadSettings } from "@/lib/services/settings";
import { isAdminConfigured } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Settings" };

const TABS = [
  ["workspace", "Workspace"], ["sectors", "Sector intelligence"], ["pricing", "Pricing"], ["scoring", "Scoring"],
  ["integrations", "Integrations"], ["ai", "AI"], ["automation", "Automation & API"], ["data", "Data"],
] as const;
type Tab = (typeof TABS)[number][0];

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const sp = await searchParams;
  const tab: Tab = (TABS.find(([k]) => k === sp.tab)?.[0] ?? "workspace") as Tab;
  const { supabase, workspace, isAdmin } = await getWorkspaceContext();
  const ws = workspace.id;
  const settings = await loadSettings(supabase, ws);
  const disabled = !isAdmin;

  let body: React.ReactNode = null;
  if (tab === "workspace") body = <WorkspaceForm name={workspace.name} branding={settings.branding} disabled={disabled} />;

  if (tab === "sectors") {
    const [{ data: sectors }, { data: services }, { data: links }, { data: templates }, { data: companies }] = await Promise.all([
      supabase.from("sectors").select("*").eq("workspace_id", ws).order("name"),
      supabase.from("services").select("id, name").eq("workspace_id", ws).order("name"),
      supabase.from("sector_services").select("sector_id, service_id").eq("workspace_id", ws),
      supabase.from("email_templates").select("sector_id").eq("workspace_id", ws).not("sector_id", "is", null),
      supabase.from("companies").select("sector_id").eq("workspace_id", ws).not("sector_id", "is", null).limit(10000),
    ]);
    const rows: SectorRow[] = (sectors ?? []).map((s) => {
      const w = (s.score_weights ?? {}) as Record<string, number>;
      return {
        id: s.id, name: s.name, value_tier: s.value_tier as SectorRow["value_tier"], avg_ticket: s.avg_ticket === null ? null : Number(s.avg_ticket),
        booking_relevant: s.booking_relevant, whatsapp_relevant: s.whatsapp_relevant,
        score_weights: { website: w.website ?? 1, google: w.google ?? 1, social: w.social ?? 1, business: w.business ?? 1 },
        setup_price_min: s.setup_price_min === null ? null : Number(s.setup_price_min), setup_price_max: s.setup_price_max === null ? null : Number(s.setup_price_max),
        monthly_price: s.monthly_price === null ? null : Number(s.monthly_price), common_problems: s.common_problems, sales_arguments: s.sales_arguments, keywords: s.keywords,
        service_ids: (links ?? []).filter((l) => l.sector_id === s.id).map((l) => l.service_id),
        templates: (templates ?? []).filter((t) => t.sector_id === s.id).length,
        leads: (companies ?? []).filter((c) => c.sector_id === s.id).length,
      };
    });
    body = <SectorsPanel sectors={rows} services={services ?? []} disabled={disabled} />;
  }

  if (tab === "pricing") {
    const [{ data: services }, { data: rules }] = await Promise.all([
      supabase.from("services").select("id, name, category, description, setup_price, monthly_price, is_active").eq("workspace_id", ws).order("category").order("name"),
      supabase.from("pricing_rules").select("id, name, priority, conditions, package_name, service_id, setup_price, monthly_price, is_active").eq("workspace_id", ws).order("priority"),
    ]);
    body = (
      <PricingPanel
        disabled={disabled}
        services={(services ?? []).map((s) => ({ ...s, setup_price: Number(s.setup_price), monthly_price: Number(s.monthly_price) })) as ServiceRow[]}
        rules={(rules ?? []).map((r) => ({ ...r, conditions: (r.conditions ?? {}) as PricingConditions, setup_price: Number(r.setup_price), monthly_price: Number(r.monthly_price) })) as RuleRow[]}
      />
    );
  }

  if (tab === "scoring") body = <ScoringForm settings={settings.scoring} disabled={disabled} />;

  if (tab === "integrations") {
    const items = listIntegrations();
    body = (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((i) => (
          <div key={i.id} className="rounded-xl border p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium">{i.name}</p>
              <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                i.status === "connected" ? "bg-success-soft text-success" : i.status === "requires_configuration" ? "bg-warm-soft" : "bg-muted text-muted-foreground")}>
                {i.status === "connected" ? <CheckCircle2 className="size-3" /> : i.status === "requires_configuration" ? <Settings2 className="size-3" /> : <CircleDashed className="size-3" />}
                {i.status === "connected" ? "Connected" : i.status === "requires_configuration" ? "Configuration required" : "Planned"}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{i.description}</p>
            {i.envVars.length > 0 && <p className="mt-3 font-mono text-[11px] text-muted-foreground">{i.envVars.join(" · ")}</p>}
            {i.docsUrl && <a href={i.docsUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs underline-offset-4 hover:underline">Docs →</a>}
          </div>
        ))}
      </div>
    );
  }

  if (tab === "ai") {
    const { data: gens } = await supabase.from("ai_generations").select("id, kind, provider, model, input_tokens, output_tokens, latency_ms, status, error, created_at, company:companies(id, name)").eq("workspace_id", ws).order("created_at", { ascending: false }).limit(50);
    const totals = (gens ?? []).reduce((a, g) => ({ input: a.input + (g.input_tokens ?? 0), output: a.output + (g.output_tokens ?? 0) }), { input: 0, output: 0 });
    body = (
      <div className="space-y-8">
        <AIForm settings={settings.ai} disabled={disabled} available={availableProviders()} />
        <section>
          <h3 className="text-sm font-semibold">Generation log</h3>
          <p className="text-xs text-muted-foreground">Last 50 · {formatNumber(totals.input)} input / {formatNumber(totals.output)} output tokens. Prompts and responses are stored in <code className="font-mono">ai_generations</code>.</p>
          {gens?.length ? (
            <div className="mt-3 overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-muted/30 text-xs text-muted-foreground"><tr><th className="px-4 py-2 text-left font-medium">When</th><th className="px-3 py-2 text-left font-medium">Kind</th><th className="px-3 py-2 text-left font-medium">Lead</th><th className="px-3 py-2 text-left font-medium">Model</th><th className="px-3 py-2 text-right font-medium">Tokens in/out</th><th className="px-3 py-2 text-right font-medium">Latency</th><th className="px-3 py-2 text-left font-medium">Status</th></tr></thead>
                <tbody>
                  {gens.map((g) => {
                    const company = g.company as unknown as { id: string; name: string } | null;
                    return (
                      <tr key={g.id} className="border-t">
                        <td className="px-4 py-2 text-xs text-muted-foreground">{formatDateTime(g.created_at)}</td>
                        <td className="px-3 py-2 font-mono text-xs">{g.kind}</td>
                        <td className="px-3 py-2 text-xs">{company ? <Link href={`/companies/${company.id}`} className="hover:underline">{company.name}</Link> : "—"}</td>
                        <td className="px-3 py-2 text-xs">{g.provider} · {g.model}</td>
                        <td className="tabular px-3 py-2 text-right text-xs">{formatNumber(g.input_tokens)} / {formatNumber(g.output_tokens)}</td>
                        <td className="tabular px-3 py-2 text-right text-xs">{g.latency_ms ? `${(g.latency_ms / 1000).toFixed(1)}s` : "—"}</td>
                        <td className={cn("px-3 py-2 text-xs", g.status === "error" && "text-destructive")} title={g.error ?? undefined}>{g.status}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <p className="mt-3 text-sm text-muted-foreground">No AI generations yet.</p>}
        </section>
      </div>
    );
  }

  if (tab === "automation") {
    const [{ data: events }, { data: keys }] = await Promise.all([
      supabase.from("events").select("id, type, created_at, delivered_at, attempts, last_error").eq("workspace_id", ws).order("created_at", { ascending: false }).limit(25),
      isAdmin ? supabase.from("api_keys").select("id, name, prefix, last_used_at, revoked_at, created_at").eq("workspace_id", ws).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    ]);
    body = <AutomationPanel settings={settings.automation} events={events ?? []} keys={keys ?? []} disabled={disabled} adminConfigured={isAdminConfigured()} siteUrl={publicEnv.siteUrl} />;
  }

  if (tab === "data") {
    const { count } = await supabase.from("companies").select("id", { count: "exact", head: true }).eq("workspace_id", ws).contains("tags", ["demo"]);
    body = <DataPanel hasDemo={Boolean(count)} disabled={disabled} />;
  }

  return (
    <>
      <PageHeader title="Settings" description={isAdmin ? "Workspace configuration" : "Read-only — only owners and admins can change settings."}>
        <nav className="-mb-5 mt-4 flex gap-1 overflow-x-auto" aria-label="Settings sections">
          {TABS.map(([key, label]) => (
            <Link key={key} href={`/settings?tab=${key}`} aria-current={tab === key ? "page" : undefined}
              className={cn("whitespace-nowrap border-b-2 px-3 py-2 text-sm", tab === key ? "border-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}>{label}</Link>
          ))}
        </nav>
      </PageHeader>
      <PageBody>{body}</PageBody>
    </>
  );
}
