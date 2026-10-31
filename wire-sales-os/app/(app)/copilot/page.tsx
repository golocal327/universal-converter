import type { Metadata } from "next";
import Link from "next/link";
import { OpportunityPanel } from "@/components/company/opportunity-panel";
import { CopilotChat } from "@/components/copilot/copilot-chat";
import { isAIConfigured } from "@/lib/ai";
import { getActor } from "@/lib/auth/actor";
import { analyzeOpportunity } from "@/lib/outreach/generators";
import { buildLeadContext } from "@/lib/services/lead-context";

export const metadata: Metadata = { title: "AI Copilot" };

export default async function CopilotPage({ searchParams }: PageProps<"/copilot">) {
  const sp = await searchParams;
  const companyId = typeof sp.company === "string" && /^[0-9a-f-]{36}$/i.test(sp.company) ? sp.company : null;
  const actor = await getActor();
  const ctx = companyId ? await buildLeadContext(actor, companyId) : null;
  const configured = isAIConfigured();
  const company = ctx ? { id: ctx.company.id, name: ctx.company.name, subtitle: [ctx.sector?.name, ctx.company.city, ctx.lead ? `${ctx.lead.score}/100` : null].filter(Boolean).join(" · ") } : null;

  if (!configured) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <h1 className="text-xl font-semibold tracking-tight">AI Copilot</h1>
        <div className="mt-4 rounded-xl border border-dashed p-5 text-sm">
          <p className="font-medium">Configuration required</p>
          <p className="mt-1 text-muted-foreground">
            Set <code className="font-mono text-xs">ANTHROPIC_API_KEY</code> (recommended) or <code className="font-mono text-xs">OPENAI_API_KEY</code> on the server and redeploy.
            The Copilot will then answer free-form questions, analyze leads, write emails, proposals and meeting prep. Every generation is logged in Settings → AI.
          </p>
          <Link href="/settings?tab=integrations" className="mt-3 inline-block font-medium underline-offset-4 hover:underline">Integration status →</Link>
        </div>
        {ctx && (
          <div className="mt-8">
            <p className="mb-3 text-sm font-semibold">Rules-engine analysis for {ctx.company.name} <span className="font-normal text-muted-foreground">(no AI involved)</span></p>
            <OpportunityPanel analysis={analyzeOpportunity(ctx)} />
            <p className="mt-3 text-sm text-muted-foreground">Personalized emails, WhatsApp, call script and proposal are available on the company’s <Link href={`/companies/${ctx.company.id}?tab=outreach`} className="underline">Outreach tab</Link>.</p>
          </div>
        )}
      </div>
    );
  }
  return <CopilotChat key={company?.id ?? "none"} company={company} aiConfigured={configured} />;
}
