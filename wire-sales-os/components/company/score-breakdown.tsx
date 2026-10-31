import { CATEGORY_CAPS, type ScoreCategory, type ScoreFactor } from "@/lib/scoring/engine";
import { cn } from "@/lib/utils";

const CATEGORY_LABEL: Record<ScoreCategory, string> = { website: "Website", google: "Google", social: "Social", business: "Business", penalty: "Penalties" };
const ORDER: ScoreCategory[] = ["website", "google", "business", "social", "penalty"];

const sign = (n: number) => (n > 0 ? `+${n}` : String(n));

/**
 * "+25 No website" style breakdown grouped by category. Each category has a
 * cap so one dimension cannot dominate; when a cap applies it is shown, so
 * the visible numbers always add up to the score.
 */
export function ScoreBreakdown({ factors, score }: { factors: ScoreFactor[]; score?: number }) {
  if (!factors.length) return <p className="text-sm text-muted-foreground">Not scored yet.</p>;
  const groups = ORDER.map((cat) => {
    const items = factors.filter((f) => f.category === cat);
    const raw = items.reduce((a, f) => a + f.points, 0);
    const cap = cat === "penalty" ? null : CATEGORY_CAPS[cat];
    return { cat, items, raw, total: cap === null ? raw : Math.min(raw, cap), capped: cap !== null && raw > cap, cap };
  }).filter((g) => g.items.length);
  const sum = groups.reduce((a, g) => a + g.total, 0);

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.cat}>
          <div className="mb-1.5 flex items-baseline justify-between text-xs">
            <span className="font-medium tracking-wide text-muted-foreground uppercase">{CATEGORY_LABEL[g.cat]}</span>
            <span className="tabular font-semibold">
              {g.capped ? <span className="mr-1 font-normal text-muted-foreground" title={`Category capped at ${g.cap}`}>{sign(g.raw)} → cap</span> : null}
              {sign(g.total)}
            </span>
          </div>
          <ul className="space-y-1.5">
            {g.items.map((f) => (
              <li key={f.key} className="flex items-start gap-3 text-sm">
                <span className={cn("tabular w-9 shrink-0 font-mono text-xs font-semibold leading-5", f.points > 0 ? "text-success" : f.points < 0 ? "text-destructive" : "text-muted-foreground")}>{sign(f.points)}</span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{f.label}</span>
                  {f.detail && <span className="block text-xs text-muted-foreground">{f.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="flex items-baseline justify-between border-t pt-3 text-sm">
        <span className="text-muted-foreground">Total{score !== undefined && score !== Math.max(0, Math.min(100, sum)) ? " (recalculate to refresh)" : ""}</span>
        <span className="tabular font-semibold">{Math.max(0, Math.min(100, sum))}/100{sum > 100 ? " (max)" : ""}</span>
      </div>
    </div>
  );
}
