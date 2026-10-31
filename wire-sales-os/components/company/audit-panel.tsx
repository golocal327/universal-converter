import { CheckCircle2, CircleAlert, Info, XCircle } from "lucide-react";
import type { AuditCheck, AuditOpportunity } from "@/lib/audit/analyzer";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export type AuditView = {
  status: string;
  url: string;
  final_url: string | null;
  error: string | null;
  http_status: number | null;
  response_time_ms: number | null;
  overall_score: number | null;
  performance_score: number | null;
  seo_score: number | null;
  ux_score: number | null;
  conversion_score: number | null;
  mobile_score: number | null;
  checks: AuditCheck[];
  opportunities: AuditOpportunity[];
  tech: { cms?: string | null; analytics?: string[] };
  lighthouse: boolean;
  engine_version: string | null;
  created_at: string;
};

const STATUS_ICON = {
  pass: <CheckCircle2 className="size-4 text-success" aria-label="Pass" />,
  warn: <CircleAlert className="size-4 text-warm" aria-label="Warning" />,
  fail: <XCircle className="size-4 text-destructive" aria-label="Fail" />,
  info: <Info className="size-4 text-muted-foreground" aria-label="Info" />,
};

function Meter({ label, value }: { label: string; value: number | null }) {
  const v = value ?? 0;
  const tone = v >= 70 ? "bg-success" : v >= 45 ? "bg-warm" : "bg-destructive";
  return (
    <div className="grid grid-cols-[6rem_1fr_2.5rem] items-center gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="h-1.5 overflow-hidden rounded-full bg-muted"><span className={cn("block h-full rounded-full", tone)} style={{ width: `${v}%` }} /></span>
      <span className="tabular text-right font-medium">{value ?? "—"}</span>
    </div>
  );
}

const GROUPS: { key: AuditCheck["group"]; label: string }[] = [
  { key: "technical", label: "Technical" },
  { key: "ux", label: "UX" },
  { key: "commercial", label: "Commercial" },
];

export function AuditPanel({ audit }: { audit: AuditView }) {
  if (audit.status === "failed") {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
        <p className="font-medium">The website could not be audited</p>
        <p className="mt-1 text-muted-foreground">{audit.error}{audit.http_status ? ` (HTTP ${audit.http_status})` : ""} · {audit.url}</p>
        <p className="mt-2 text-xs text-muted-foreground">For the lead score this counts as a broken/missing website — itself a strong sales argument.</p>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_1fr]">
        <div className="rounded-xl border p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Website score</p>
          <p className="mt-2 text-5xl font-semibold tracking-tight">{audit.overall_score}<span className="text-lg font-normal text-muted-foreground">/100</span></p>
          <div className="mt-5 space-y-2.5">
            <Meter label="Performance" value={audit.performance_score} />
            <Meter label="SEO" value={audit.seo_score} />
            <Meter label="UX" value={audit.ux_score} />
            <Meter label="Conversion" value={audit.conversion_score} />
            <Meter label="Mobile" value={audit.mobile_score} />
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
            {audit.final_url ?? audit.url} · {formatDateTime(audit.created_at)}
            {audit.response_time_ms ? ` · ${(audit.response_time_ms / 1000).toFixed(2)}s` : ""}
            {audit.tech?.cms ? ` · ${audit.tech.cms}` : ""}
            <br />
            {audit.lighthouse ? "Performance from Lighthouse (PageSpeed Insights)." : "Performance estimated from server response, page weight and scripts."}
          </p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Biggest opportunities</p>
          {audit.opportunities.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No major issues — pitch growth (automation, SEO, reviews) instead of a redesign.</p>
          ) : (
            <ol className="mt-3 space-y-3">
              {audit.opportunities.map((o, i) => (
                <li key={o.key} className="flex gap-3">
                  <span className="tabular flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{o.title} <span className={cn("ml-1 text-[11px] font-medium uppercase", o.impact === "high" ? "text-hot" : "text-muted-foreground")}>{o.impact}</span></p>
                    <p className="text-xs text-muted-foreground">{o.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
      {audit.checks.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-3">
          {GROUPS.map((g) => (
            <div key={g.key} className="rounded-xl border">
              <p className="border-b px-4 py-2.5 text-sm font-semibold">{g.label}</p>
              <ul className="divide-y">
                {audit.checks.filter((c) => c.group === g.key).map((c) => (
                  <li key={c.id} className="flex items-start gap-2.5 px-4 py-2">
                    <span className="mt-0.5">{STATUS_ICON[c.status]}</span>
                    <div className="min-w-0">
                      <p className="text-sm">{c.label}</p>
                      {c.detail && <p className="truncate text-xs text-muted-foreground" title={c.detail}>{c.detail}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
