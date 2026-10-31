"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { PriorityBadge, ScoreBadge } from "@/components/app/badges";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { dismissProspects, importProspects } from "@/lib/actions/discovery";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ProspectRow = {
  id: string; name: string; city: string | null; website: string | null; google_rating: number | null; google_reviews_count: number | null;
  score: number; priority: string; biggest_opportunity: string | null; recommended_action: string | null; status: string;
  company_id: string | null; duplicate_of_company_id: string | null;
};

export function ProspectResults({ rows }: { rows: ProspectRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const selectable = rows.filter((r) => r.status === "new");
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const act = (fn: "import" | "dismiss") =>
    startTransition(async () => {
      const ids = [...selected];
      if (fn === "import") {
        const r = await importProspects(ids);
        if (r.ok) toast.success(`Added ${r.data.created} lead(s) to the CRM${r.data.duplicates ? ` · ${r.data.duplicates} duplicates skipped` : ""}`);
        else toast.error(r.error);
      } else {
        const r = await dismissProspects(ids);
        if (!r.ok) toast.error(r.error);
      }
      setSelected(new Set());
      router.refresh();
    });

  return (
    <div className="rounded-xl border">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
        <Checkbox aria-label="Select all new" checked={selectable.length > 0 && selected.size === selectable.length} onCheckedChange={(v) => setSelected(v ? new Set(selectable.map((r) => r.id)) : new Set())} />
        <span className="text-sm text-muted-foreground">{selected.size ? `${selected.size} selected` : "Select prospects to add to the CRM"}</span>
        <div className="ml-auto flex gap-2">
          <Button size="sm" disabled={!selected.size || pending} onClick={() => act("import")}>{pending && <Loader2 className="animate-spin" />} Add to CRM</Button>
          <Button size="sm" variant="ghost" disabled={!selected.size || pending} onClick={() => act("dismiss")}>Dismiss</Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-muted/30 text-xs text-muted-foreground">
            <tr>
              <th className="w-10 px-4 py-2" />
              <th className="px-3 py-2 text-left font-medium">Business</th>
              <th className="px-3 py-2 text-left font-medium">Score</th>
              <th className="px-3 py-2 text-left font-medium">Google</th>
              <th className="px-3 py-2 text-left font-medium">Website</th>
              <th className="px-3 py-2 text-left font-medium">Biggest opportunity</th>
              <th className="px-3 py-2 text-left font-medium">Recommended action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={cn("border-t", r.status !== "new" && "text-muted-foreground")}>
                <td className="px-4 py-2.5">{r.status === "new" ? <Checkbox aria-label={`Select ${r.name}`} checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} /> : null}</td>
                <td className="px-3 py-2.5">
                  <span className="font-medium text-foreground">{r.name}</span>
                  <span className="block text-xs text-muted-foreground">{r.city ?? "—"}</span>
                  {r.status === "imported" && r.company_id && <Link href={`/companies/${r.company_id}`} className="text-xs font-medium text-success hover:underline">In CRM →</Link>}
                  {r.status === "duplicate" && <Link href={r.duplicate_of_company_id ? `/companies/${r.duplicate_of_company_id}` : "#"} className="text-xs hover:underline">Already in CRM</Link>}
                  {r.status === "dismissed" && <span className="text-xs">Dismissed</span>}
                </td>
                <td className="px-3 py-2.5"><div className="flex items-center gap-2"><ScoreBadge score={r.score} /><PriorityBadge priority={r.priority} /></div></td>
                <td className="tabular px-3 py-2.5 text-xs">{r.google_reviews_count !== null ? <span className="inline-flex items-center gap-1"><Star className="size-3 fill-current text-warm" />{r.google_rating ?? "—"} ({formatNumber(r.google_reviews_count)})</span> : "—"}</td>
                <td className="max-w-[180px] truncate px-3 py-2.5 text-xs">{r.website ? <a href={r.website} target="_blank" rel="noopener noreferrer nofollow" className="hover:underline">{r.website.replace(/^https?:\/\//, "")}</a> : <span className="font-medium text-hot">None</span>}</td>
                <td className="px-3 py-2.5 text-xs">{r.biggest_opportunity}</td>
                <td className="px-3 py-2.5 text-xs">{r.recommended_action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
