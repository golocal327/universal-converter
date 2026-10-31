import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** KPI tile: label · value · optional delta/hint (dataviz stat-tile contract). */
export function StatTile({ label, value, hint, delta, upIsGood = true, className, href }: {
  label: string; value: React.ReactNode; hint?: React.ReactNode; delta?: number | null; upIsGood?: boolean; className?: string; href?: string;
}) {
  const good = delta === null || delta === undefined ? null : (delta >= 0) === upIsGood;
  const body = (
    <>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight">{value}</p>
      <div className="mt-1 flex min-h-4 items-center gap-1.5 text-xs text-muted-foreground">
        {delta !== null && delta !== undefined && (
          <span className={cn("inline-flex items-center font-medium", good ? "text-success" : "text-destructive")}>
            {delta >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {Math.abs(delta).toFixed(0)}%
          </span>
        )}
        {hint}
      </div>
    </>
  );
  const cls = cn("rounded-xl border bg-card p-4", href && "transition-colors hover:bg-muted/40", className);
  return href ? <a href={href} className={cls}>{body}</a> : <div className={cls}>{body}</div>;
}
