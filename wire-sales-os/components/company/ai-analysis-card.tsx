"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { copilotAsk } from "@/lib/actions/ai";
import type { LeadAnalysis } from "@/lib/ai/prompts";
import { formatCurrency, formatRelative } from "@/lib/format";

export function AiAnalysisCard({ companyId, aiConfigured, last }: { companyId: string; aiConfigured: boolean; last: { analysis: LeadAnalysis; created_at: string; model: string } | null }) {
  const [current, setCurrent] = useState(last);
  const [pending, startTransition] = useTransition();
  const run = () =>
    startTransition(async () => {
      const r = await copilotAsk({ companyId, prompt: "Analyze this lead." });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      if (r.data.mode === "analysis") setCurrent({ analysis: r.data.analysis, created_at: new Date().toISOString(), model: r.data.model });
    });

  if (!aiConfigured) {
    return (
      <div className="rounded-xl border border-dashed p-5 text-sm">
        <p className="font-medium">AI analysis requires configuration</p>
        <p className="mt-1 text-muted-foreground">Set <code className="font-mono text-xs">ANTHROPIC_API_KEY</code> or <code className="font-mono text-xs">OPENAI_API_KEY</code>. Until then the rules engine above (score, Why this lead, outreach, proposal) works from the same data.</p>
        <Link href="/settings?tab=integrations" className="mt-3 inline-block text-sm font-medium underline-offset-4 hover:underline">Integration settings →</Link>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{current ? `Last analysis ${formatRelative(current.created_at)} · ${current.model}` : "No AI analysis yet."}</p>
        <Button size="sm" onClick={run} disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : <Sparkles />} {current ? "Re-run analysis" : "Run AI analysis"}</Button>
      </div>
      {current && <AnalysisView analysis={current.analysis} />}
    </div>
  );
}

export function AnalysisView({ analysis: a }: { analysis: LeadAnalysis }) {
  const block = (title: string, body: React.ReactNode) => (
    <div className="rounded-xl border p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="mt-2 text-sm leading-relaxed">{body}</div>
    </div>
  );
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {block("Summary", <><p>{a.summary}</p><p className="mt-2 text-muted-foreground">{a.score_comment}</p></>)}
      {block("Recommended", <><p className="font-medium">{a.recommended_service}</p><p>{formatCurrency(a.recommended_price.setup)} setup · {formatCurrency(a.recommended_price.monthly)}/mo</p><p className="mt-1 text-muted-foreground">{a.recommended_price.rationale}</p></>)}
      {block("Why now", <p>{a.why_now}</p>)}
      {block("Sales angle", <p>{a.sales_angle}</p>)}
      {block("Opportunities", <ul className="list-disc space-y-1 pl-4">{a.opportunities.map((o) => <li key={o}>{o}</li>)}</ul>)}
      {block("Problems", <ul className="list-disc space-y-1 pl-4">{a.problems.map((o) => <li key={o}>{o}</li>)}</ul>)}
      {block("Email", <><p className="font-medium">{a.email.subject}</p><p className="mt-1 whitespace-pre-line">{a.email.body}</p></>)}
      {block("WhatsApp", <p className="whitespace-pre-line">{a.whatsapp}</p>)}
      {block("Call script", <p className="whitespace-pre-line">{a.call_script}</p>)}
      {block("Follow-up & next action", <><p className="whitespace-pre-line">{a.follow_up}</p><p className="mt-2 font-medium">{a.next_action}</p></>)}
    </div>
  );
}
