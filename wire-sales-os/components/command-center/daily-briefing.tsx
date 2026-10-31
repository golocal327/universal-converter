"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { aiDailyBriefing } from "@/lib/actions/ai";
import { formatCurrency } from "@/lib/format";

type Briefing = {
  greeting: string;
  priorities: { company: string; score: number; reason: string; action: string; companyId?: string }[];
  followUps: number;
  meetings: number;
  pipeline: number;
};

export function DailyBriefing({ briefing, aiConfigured }: { briefing: Briefing; aiConfigured: boolean }) {
  const [ai, setAi] = useState<{ greeting: string; priorities: Briefing["priorities"]; notes: string[] } | null>(null);
  const [pending, startTransition] = useTransition();
  const priorities = ai?.priorities ?? briefing.priorities;
  const linkFor = (company: string) => briefing.priorities.find((p) => p.company === company)?.companyId;

  return (
    <section aria-labelledby="briefing" className="rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p id="briefing" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Daily briefing</p>
          <p className="mt-2 text-lg font-semibold tracking-tight">{ai?.greeting ?? briefing.greeting}</p>
          <p className="text-sm text-muted-foreground">Today you should prioritize:</p>
        </div>
        <Button size="sm" variant="outline" disabled={!aiConfigured || pending} title={aiConfigured ? undefined : "Configure an AI provider"}
          onClick={() => startTransition(async () => { const r = await aiDailyBriefing(); if (r.ok) setAi(r.data); else toast.error(r.error); })}>
          {pending ? <Loader2 className="animate-spin" /> : <Sparkles />} {ai ? "Rewrite" : "Write with AI"}
        </Button>
      </div>
      {priorities.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No open leads to prioritize. Import or discover new businesses.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {priorities.map((p, i) => {
            const id = linkFor(p.company);
            return (
              <li key={`${p.company}-${i}`} className="grid grid-cols-[1.5rem_1fr_auto] items-start gap-3">
                <span className="tabular text-sm font-semibold text-muted-foreground">{i + 1}.</span>
                <div className="min-w-0">
                  {id ? <Link href={`/companies/${id}?tab=outreach`} className="text-sm font-medium hover:underline">{p.company}</Link> : <span className="text-sm font-medium">{p.company}</span>}
                  <p className="text-xs text-muted-foreground">Reason: {p.reason}</p>
                  <p className="text-xs">{p.action}</p>
                </div>
                <span className="tabular text-sm font-semibold">{p.score}</span>
              </li>
            );
          })}
        </ol>
      )}
      <dl className="mt-5 grid grid-cols-3 gap-3 border-t pt-4 text-sm">
        <div><dt className="text-xs text-muted-foreground">Follow-ups due</dt><dd className="font-semibold">{briefing.followUps}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Meetings (today + tomorrow)</dt><dd className="font-semibold">{briefing.meetings}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Pipeline</dt><dd className="font-semibold">{formatCurrency(briefing.pipeline)}</dd></div>
      </dl>
      {ai?.notes?.length ? <ul className="mt-4 space-y-1 border-t pt-4 text-sm text-muted-foreground">{ai.notes.map((n) => <li key={n}>— {n}</li>)}</ul> : null}
    </section>
  );
}
