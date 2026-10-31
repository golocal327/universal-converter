"use client";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatNumber } from "@/lib/format";

export type FunnelStep = { key: string; name: string; count: number };

/** Ordered funnel as horizontal bars (one hue) with step and overall conversion. */
export function Funnel({ steps }: { steps: FunnelStep[] }) {
  const top = Math.max(1, steps[0]?.count ?? 1);
  return (
    <ol className="space-y-2 px-4 py-4" aria-label="Sales funnel">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].count : null;
        const stepRate = prev ? (s.count / prev) * 100 : null;
        return (
          <li key={s.key} className="grid grid-cols-[6.5rem_1fr_4.5rem] items-center gap-3 sm:grid-cols-[8rem_1fr_6rem]">
            <span className="truncate text-sm text-muted-foreground">{s.name}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex h-6 items-center gap-2 outline-none" tabIndex={0} aria-label={`${s.name}: ${s.count}`}>
                  <div className="h-5 rounded-r-[4px] bg-chart-1 transition-[width] duration-500" style={{ width: `${Math.max(1.5, (s.count / top) * 85)}%` }} />
                  <span className="tabular text-xs font-medium">{formatNumber(s.count)}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-medium">{s.name}: {formatNumber(s.count)}</p>
                <p>{((s.count / top) * 100).toFixed(1)}% of leads{stepRate !== null ? ` · ${stepRate.toFixed(0)}% from previous step` : ""}</p>
              </TooltipContent>
            </Tooltip>
            <span className="tabular text-right text-xs text-muted-foreground">{stepRate === null ? "100%" : `${stepRate.toFixed(0)}% →`}</span>
          </li>
        );
      })}
    </ol>
  );
}
