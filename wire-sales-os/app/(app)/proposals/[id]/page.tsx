import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProposalToolbar } from "@/components/proposals/proposal-toolbar";
import { getWorkspaceContext } from "@/lib/auth/session";
import type { ProposalContent } from "@/lib/outreach/generators";
import { loadSettings } from "@/lib/services/settings";

export const metadata: Metadata = { title: "Proposal" };

const dateEs = (v: string) => new Date(v).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
const eur = (v: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

export default async function ProposalPage({ params }: PageProps<"/proposals/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, workspace } = await getWorkspaceContext();
  const { data: p } = await supabase.from("proposals").select("id, title, status, content, valid_until, created_at, company_id, company:companies(name, city)").eq("workspace_id", workspace.id).eq("id", id).maybeSingle();
  if (!p) notFound();
  const settings = await loadSettings(supabase, workspace.id);
  const c = p.content as unknown as ProposalContent;
  const company = p.company as unknown as { name: string; city: string | null } | null;
  const extrasSetup = c.investment.extras.reduce((a, e) => a + e.setup, 0);
  const extrasMonthly = c.investment.extras.reduce((a, e) => a + e.monthly, 0);
  const h2 = "mt-10 border-b pb-2 text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase";

  return (
    <>
      <ProposalToolbar proposalId={p.id} companyId={p.company_id} status={p.status} />
      <article className="mx-auto max-w-3xl px-6 py-12 print:max-w-none print:px-0 print:py-0" lang="es">
        <header className="flex items-start justify-between gap-6">
          <div>
            <p className="text-sm font-semibold tracking-tight">{settings.branding.companyName || "WIRE"}</p>
            <h1 className="mt-6 text-3xl font-semibold tracking-tight">{c.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{company?.name}{company?.city ? ` · ${company.city}` : ""} · {dateEs(p.created_at)}</p>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            {settings.branding.senderName && <p>{settings.branding.senderName}</p>}
            {settings.branding.senderEmail && <p>{settings.branding.senderEmail}</p>}
            {settings.branding.senderPhone && <p>{settings.branding.senderPhone}</p>}
            {p.valid_until && <p className="mt-2">Válida hasta {dateEs(p.valid_until)}</p>}
          </div>
        </header>
        <p className="mt-8 text-[15px] leading-relaxed">{c.intro}</p>

        <h2 className={h2}>Situación actual</h2>
        <ul className="mt-4 space-y-2 text-[15px] leading-relaxed">{c.currentSituation.map((s) => <li key={s}>— {s}</li>)}</ul>

        {c.problems.length > 0 && (
          <>
            <h2 className={h2}>Problemas detectados</h2>
            <ol className="mt-4 space-y-4">{c.problems.map((pr, i) => <li key={pr.title} className="grid grid-cols-[1.5rem_1fr] gap-2 text-[15px]"><span className="tabular font-semibold">{i + 1}.</span><span><span className="font-medium">{pr.title}.</span> <span className="text-muted-foreground">{pr.detail}</span></span></li>)}</ol>
          </>
        )}

        <h2 className={h2}>Oportunidades</h2>
        <ul className="mt-4 space-y-2 text-[15px] leading-relaxed">{c.opportunities.map((o) => <li key={o}>— {o}</li>)}</ul>

        <h2 className={h2}>La solución de WIRE</h2>
        <p className="mt-4 text-lg font-semibold">{c.solution.name}</p>
        <p className="mt-1 text-[15px] text-muted-foreground">{c.solution.description}</p>
        <ul className="mt-4 grid gap-2 text-[15px] sm:grid-cols-2">{c.features.map((f) => <li key={f} className="flex gap-2"><span aria-hidden>✓</span>{f}</li>)}</ul>

        <h2 className={h2}>Planificación</h2>
        <ol className="mt-4 divide-y rounded-lg border">{c.timeline.map((t) => <li key={t.phase} className="grid grid-cols-[8rem_1fr] gap-4 p-3 text-sm"><span className="font-medium">{t.duration}</span><span><span className="font-medium">{t.phase}.</span> {t.detail}</span></li>)}</ol>

        <h2 className={h2}>Inversión</h2>
        <table className="mt-4 w-full text-[15px]">
          <tbody>
            <tr className="border-b"><td className="py-2.5">{c.solution.name} — desarrollo y puesta en marcha</td><td className="tabular py-2.5 text-right font-medium">{eur(c.investment.setup)}</td></tr>
            <tr className="border-b"><td className="py-2.5">Mantenimiento mensual</td><td className="tabular py-2.5 text-right font-medium">{eur(c.investment.monthly)}/mes</td></tr>
            {c.investment.extras.map((e) => <tr key={e.label} className="border-b text-muted-foreground"><td className="py-2.5">Opcional · {e.label}</td><td className="tabular py-2.5 text-right">{eur(e.setup)}{e.monthly ? ` + ${eur(e.monthly)}/mes` : ""}</td></tr>)}
          </tbody>
          <tfoot>
            <tr><td className="pt-4 font-semibold">Total primer año (sin opcionales)</td><td className="tabular pt-4 text-right font-semibold">{eur(c.investment.setup + c.investment.monthly * 12)}</td></tr>
            {c.investment.extras.length > 0 && <tr className="text-sm text-muted-foreground"><td className="pt-1">Con todos los opcionales</td><td className="tabular pt-1 text-right">{eur(c.investment.setup + extrasSetup + (c.investment.monthly + extrasMonthly) * 12)}</td></tr>}
          </tfoot>
        </table>
        <p className="mt-2 text-xs text-muted-foreground">Precios sin IVA.</p>

        <h2 className={h2}>Mantenimiento incluido</h2>
        <ul className="mt-4 grid gap-2 text-[15px] sm:grid-cols-2">{c.maintenance.map((m) => <li key={m}>— {m}</li>)}</ul>

        <h2 className={h2}>Próximos pasos</h2>
        <ol className="mt-4 space-y-2 text-[15px]">{c.nextSteps.map((s, i) => <li key={s}>{i + 1}. {s}</li>)}</ol>
      </article>
    </>
  );
}
