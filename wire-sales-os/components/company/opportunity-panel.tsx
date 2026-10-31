import { ArrowRight, Lightbulb, Target, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import type { OpportunityAnalysis } from "@/lib/outreach/generators";

/** WHY THIS LEAD? — why now, what to sell, best angle, estimated value. */
export function OpportunityPanel({ analysis }: { analysis: OpportunityAnalysis }) {
  const v = analysis.estimatedValue;
  return (
    <div className="grid gap-px overflow-hidden rounded-xl border bg-border md:grid-cols-2">
      <div className="bg-card p-4">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground"><TrendingUp className="size-3.5" /> Why now</p>
        <ul className="mt-3 space-y-2 text-sm">
          {analysis.whyNow.map((w) => <li key={w} className="flex gap-2"><span className="mt-2 size-1 shrink-0 rounded-full bg-foreground" />{w}</li>)}
        </ul>
      </div>
      <div className="bg-card p-4">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground"><Target className="size-3.5" /> What to sell</p>
        <p className="mt-3 text-base font-semibold">{analysis.recommendedOffer.name}</p>
        <p className="mt-0.5 text-sm">
          <span className="font-medium">{formatCurrency(analysis.recommendedOffer.setup)}</span> setup ·{" "}
          <span className="font-medium">{formatCurrency(analysis.recommendedOffer.monthly)}</span>/month
        </p>
        <p className="mt-2 text-xs text-muted-foreground">{analysis.recommendedOffer.reason}</p>
        {analysis.extras.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs">
            {analysis.extras.map((e) => (
              <li key={e.label} className="flex justify-between gap-3">
                <span>+ {e.label} <span className="text-muted-foreground">· {e.reason}</span></span>
                <span className="tabular shrink-0 font-medium">{formatCurrency(e.setup)}{e.monthly ? ` + ${formatCurrency(e.monthly)}/mo` : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="bg-card p-4">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground"><Lightbulb className="size-3.5" /> Best angle</p>
        <p className="mt-3 text-sm leading-relaxed">{analysis.bestAngle}</p>
        <p className="mt-3 flex items-center gap-1.5 text-sm font-medium"><ArrowRight className="size-3.5" /> {analysis.nextAction}</p>
      </div>
      <div className="bg-card p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Estimated value</p>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-xs text-muted-foreground">Setup</dt><dd className="text-lg font-semibold">{formatCurrency(v.setup)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">MRR</dt><dd className="text-lg font-semibold">{formatCurrency(v.mrr)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Potential extras</dt><dd className="text-lg font-semibold">{formatCurrency(v.extras)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">First-year value</dt><dd className="text-lg font-semibold">{formatCurrency(v.firstYear)}</dd></div>
        </dl>
      </div>
    </div>
  );
}
