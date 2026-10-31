import type { ScoreFactor } from "@/lib/scoring/engine";
import { cn } from "@/lib/utils";

const CATEGORY_LABEL: Record<string, string> = { website: "Website", google: "Google", social: "Social", business: "Business", penalty: "Penalty" };

/** "+25 No website" style breakdown — every point of the score is explained. */
export function ScoreBreakdown({ factors }: { factors: ScoreFactor[] }) {
  if (!factors.length) return <p className="text-sm text-muted-foreground">Not scored yet.</p>;
  return (
    <ul className="space-y-2">
      {factors.map((f) => (
        <li key={f.key} className="flex items-start gap-3 text-sm">
          <span className={cn("tabular w-9 shrink-0 font-mono text-xs font-semibold leading-5", f.points > 0 ? "text-success" : f.points < 0 ? "text-destructive" : "text-muted-foreground")}>
            {f.points > 0 ? `+${f.points}` : f.points}
          </span>
          <span className="min-w-0 flex-1">
            <span className="font-medium">{f.label}</span>
            {f.detail && <span className="block text-xs text-muted-foreground">{f.detail}</span>}
          </span>
          <span className="shrink-0 text-[11px] text-muted-foreground">{CATEGORY_LABEL[f.category]}</span>
        </li>
      ))}
    </ul>
  );
}
