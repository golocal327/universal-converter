"use client";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDate } from "@/lib/format";

type Point = { day: string; value: number };

/** Long ranges are bucketed by week so every column keeps a readable width. */
function bucket(data: Point[]): { label: string; start: string; value: number }[] {
  if (data.length <= 31) return data.map((d) => ({ label: formatDate(d.day), start: d.day, value: d.value }));
  const out: { label: string; start: string; value: number }[] = [];
  for (let i = 0; i < data.length; i += 7) {
    const week = data.slice(i, i + 7);
    out.push({ label: `Week of ${formatDate(week[0].day)}`, start: week[0].day, value: week.reduce((a, d) => a + d.value, 0) });
  }
  return out;
}

/** Small-multiple column chart: one metric per chart (no dual axes), hover per column. */
export function ColumnSeries({ title, data, total }: { title: string; data: Point[]; total?: string }) {
  const columns = bucket(data);
  const max = Math.max(1, ...columns.map((d) => d.value));
  const weekly = data.length > 31;
  return (
    <figure className="rounded-lg border p-3">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{title}{weekly ? " · weekly" : ""}</span>
        <span className="text-sm font-semibold">{total ?? data.reduce((a, d) => a + d.value, 0)}</span>
      </figcaption>
      <div className="mt-3 flex h-16 items-end gap-px border-b" role="img" aria-label={`${title} ${weekly ? "per week" : "per day"}`}>
        {columns.map((d) => (
          <Tooltip key={d.start}>
            <TooltipTrigger asChild>
              <div className="flex h-full min-w-0 flex-1 items-end px-px outline-none" tabIndex={-1}>
                <div className="w-full rounded-t-[3px] bg-chart-1" style={{ height: d.value ? `${Math.max(6, (d.value / max) * 100)}%` : "0%" }} />
              </div>
            </TooltipTrigger>
            <TooltipContent>{d.label}: {d.value}</TooltipContent>
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
