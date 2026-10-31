import { Flame, Snowflake, ThermometerSun } from "lucide-react";
import type { Priority } from "@/lib/domain/constants";
import { cn } from "@/lib/utils";

const PRIORITY: Record<Priority, { label: string; className: string; icon: typeof Flame }> = {
  hot: { label: "Hot", className: "bg-hot-soft text-hot", icon: Flame },
  warm: { label: "Warm", className: "bg-warm-soft text-[color-mix(in_oklch,var(--warm),var(--foreground)_35%)]", icon: ThermometerSun },
  cold: { label: "Cold", className: "bg-cold-soft text-cold", icon: Snowflake },
};

export function PriorityBadge({ priority, className }: { priority: Priority | string; className?: string }) {
  const p = PRIORITY[(priority as Priority) in PRIORITY ? (priority as Priority) : "cold"];
  return (
    <span className={cn("inline-flex h-5 items-center gap-1 rounded-full px-1.5 text-[11px] font-medium", p.className, className)}>
      <p.icon className="size-3" /> {p.label}
    </span>
  );
}

/** Numeric score with a thin meter. Ink stays neutral; the meter carries severity. */
export function ScoreBadge({ score, className, size = "sm" }: { score: number | null | undefined; className?: string; size?: "sm" | "lg" }) {
  if (score === null || score === undefined) return <span className="text-muted-foreground">—</span>;
  const tone = score >= 75 ? "bg-hot" : score >= 50 ? "bg-warm" : "bg-cold";
  return (
    <span className={cn("inline-flex items-center gap-2", className)} aria-label={`Score ${score} of 100`}>
      <span className={cn("tabular font-semibold", size === "lg" ? "text-2xl" : "text-sm")}>{score}</span>
      <span className={cn("relative overflow-hidden rounded-full bg-muted", size === "lg" ? "h-1.5 w-20" : "h-1 w-10")}>
        <span className={cn("absolute inset-y-0 left-0 rounded-full", tone)} style={{ width: `${Math.max(4, score)}%` }} />
      </span>
    </span>
  );
}

const STAGE_DOT: Record<string, string> = {
  new: "bg-cold", qualified: "bg-chart-2", contacted: "bg-brand", replied: "bg-brand", meeting: "bg-warm",
  proposal: "bg-warm", negotiation: "bg-hot", won: "bg-success", lost: "bg-muted-foreground/50",
};

export function StageBadge({ stageKey, name, className }: { stageKey: string | null | undefined; name?: string | null; className?: string }) {
  if (!stageKey) return <span className="text-xs text-muted-foreground">Not in pipeline</span>;
  return (
    <span className={cn("inline-flex h-5 items-center gap-1.5 rounded-md border px-1.5 text-[11px] font-medium", className)}>
      <span className={cn("size-1.5 rounded-full", STAGE_DOT[stageKey] ?? "bg-muted-foreground")} />
      {name ?? stageKey}
    </span>
  );
}

const WEBSITE_STATE: Record<string, { label: string; className: string }> = {
  missing: { label: "No website", className: "text-hot" },
  weak: { label: "Weak", className: "text-[color-mix(in_oklch,var(--warm),var(--foreground)_35%)]" },
  unknown: { label: "Not audited", className: "text-muted-foreground" },
  good: { label: "Good", className: "text-success" },
};

export function WebsiteState({ state, score }: { state: string | null; score?: number | null }) {
  const s = WEBSITE_STATE[state ?? "unknown"] ?? WEBSITE_STATE.unknown;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className={cn("font-medium", s.className)}>{s.label}</span>
      {score !== null && score !== undefined && <span className="tabular text-muted-foreground">{score}/100</span>}
    </span>
  );
}
