"use client";
import { useState } from "react";
import { Table2, BarChart3 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type BarDatum = { label: string; value: number; detail?: string };

/**
 * Horizontal bars, one series (single hue, no legend — the title names it).
 * 20px bars, 4px rounded data-end, square at the baseline, value at the tip,
 * hover tooltip and a table view for accessibility.
 */
export function BarList({ data, format = (v) => String(v), emptyLabel = "No data yet", caption }: {
  data: BarDatum[]; format?: (v: number) => string; emptyLabel?: string; caption: string;
}) {
  const [asTable, setAsTable] = useState(false);
  const max = Math.max(1, ...data.map((d) => d.value));
  if (!data.length) return <p className="px-4 py-8 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  return (
    <div className="px-4 py-3">
      <div className="mb-2 flex justify-end">
        <button type="button" onClick={() => setAsTable(!asTable)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" aria-pressed={asTable}>
          {asTable ? <BarChart3 className="size-3.5" /> : <Table2 className="size-3.5" />} {asTable ? "Chart" : "Table"}
        </button>
      </div>
      {asTable ? (
        <table className="w-full text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1 font-medium">Item</th><th className="py-1 text-right font-medium">Value</th></tr></thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.label} className="border-t"><td className="py-1.5">{d.label}</td><td className="tabular py-1.5 text-right">{format(d.value)}</td></tr>
            ))}
          </tbody>
        </table>
      ) : (
        <ul className="space-y-2.5" aria-label={caption}>
          {data.map((d) => (
            <li key={d.label} className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3 sm:grid-cols-[minmax(0,12rem)_1fr]">
              <span className="truncate text-sm text-muted-foreground" title={d.label}>{d.label}</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex h-6 items-center gap-2 outline-none" tabIndex={0} aria-label={`${d.label}: ${format(d.value)}`}>
                    <div className="h-5 rounded-r-[4px] bg-chart-1 transition-[width] duration-500" style={{ width: `${Math.max(1.5, (d.value / max) * 82)}%` }} />
                    <span className="tabular shrink-0 text-xs font-medium">{format(d.value)}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-medium">{d.label}</p>
                  <p>{format(d.value)}{d.detail ? ` · ${d.detail}` : ""}</p>
                </TooltipContent>
              </Tooltip>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
