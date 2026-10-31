"use client";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDate } from "@/lib/format";

/** Small-multiple daily column chart: one metric per chart (no dual axes), hover per column. */
export function ColumnSeries({ title, data, total }: { title: string; data: { day: string; value: number }[]; total?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <figure className="rounded-lg border p-3">
      <figcaption className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
        <span className="text-sm font-semibold">{total ?? data.reduce((a, d) => a + d.value, 0)}</span>
      </figcaption>
      <div className="mt-3 flex h-16 items-end gap-[2px] border-b" role="img" aria-label={`${title} per day`}>
        {data.map((d) => (
          <Tooltip key={d.day}>
            <TooltipTrigger asChild>
              <div className="flex h-full min-w-0 flex-1 items-end outline-none" tabIndex={-1}>
                <div className="w-full rounded-t-[3px] bg-chart-1" style={{ height: d.value ? `${Math.max(6, (d.value / max) * 100)}%` : "0%" }} />
              </div>
            </TooltipTrigger>
            <TooltipContent>{formatDate(d.day)}: {d.value}</TooltipContent>
          </Tooltip>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{formatDate(data[0]?.day)}</span>
        <span>{formatDate(data[data.length - 1]?.day)}</span>
      </div>
    </figure>
  );
}
