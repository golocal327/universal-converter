"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { PriorityBadge, ScoreBadge, StageBadge, WebsiteState } from "@/components/app/badges";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { bulkLeadAction, type BulkLeadInput } from "@/lib/actions/leads";
import { CONTACT_STATUS_LABELS, type ContactStatus } from "@/lib/domain/constants";
import { formatNumber, formatRelative, isOverdue } from "@/lib/format";
import { cn } from "@/lib/utils";

export type LeadRow = {
  id: string;
  company_id: string;
  company_name: string;
  sector_name: string | null;
  city: string | null;
  score: number;
  priority: string;
  website: string | null;
  website_state: string | null;
  website_score: number | null;
  website_top_issue: string | null;
  google_rating: number | null;
  google_reviews_count: number | null;
  stage_key: string | null;
  stage_name: string | null;
  contact_status: string;
  contact_name: string | null;
  next_follow_up_at: string | null;
  created_at: string;
};

type BulkPayload = BulkLeadInput extends infer U ? (U extends unknown ? Omit<U, "ids"> : never) : never;

type SortKey = "score" | "name" | "reviews" | "website_score" | "follow_up" | "created";

export function LeadsTable({ rows, campaigns, isAdmin }: { rows: LeadRow[]; campaigns: { id: string; name: string }[]; isAdmin: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const allSelected = rows.length > 0 && selected.size === rows.length;
  const sort = (params.get("sort") ?? "score") as SortKey;
  const dir = params.get("dir");

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const run = (input: BulkPayload) =>
    startTransition(async () => {
      const result = await bulkLeadAction({ ...input, ids: [...selected] } as BulkLeadInput);
      if (result.ok) {
        toast.success(result.data.message);
        setSelected(new Set());
        router.refresh();
      } else toast.error(result.error);
    });

  const sortHeader = (key: SortKey, label: string, className?: string) => {
    const active = sort === key;
    const nextDir = active && (dir ?? (key === "name" || key === "follow_up" ? "asc" : "desc")) === "desc" ? "asc" : "desc";
    const sp = new URLSearchParams(params);
    sp.set("sort", key);
    sp.set("dir", nextDir);
    sp.delete("page");
    return (
      <th scope="col" className={cn("px-3 py-2 text-left font-medium", className)}>
        <Link href={`${pathname}?${sp}`} scroll={false} className={cn("inline-flex items-center gap-1 hover:text-foreground", active && "text-foreground")}>
          {label}
          {active && ((dir ?? "desc") === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
        </Link>
      </th>
    );
  };

  return (
    <div className="relative">
      {selected.size > 0 && (
        <div className="sticky top-14 z-20 flex flex-wrap items-center gap-2 border-b bg-brand-soft/60 px-4 py-2 backdrop-blur">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run({ action: "qualify" })}>Add to pipeline</Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run({ action: "rescore" })}>Rescore</Button>
          <Button size="sm" variant="outline" disabled={pending || selected.size > 10} title={selected.size > 10 ? "Up to 10 at a time" : undefined} onClick={() => run({ action: "audit" })}>
            Audit websites
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" disabled={pending}>More <ChevronDown /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Add to campaign</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {campaigns.length === 0 && <DropdownMenuLabel className="text-xs text-muted-foreground">No campaigns</DropdownMenuLabel>}
                  {campaigns.map((c) => <DropdownMenuItem key={c.id} onSelect={() => run({ action: "add_to_campaign", campaignId: c.id })}>{c.name}</DropdownMenuItem>)}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Set contact status</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {(Object.keys(CONTACT_STATUS_LABELS) as ContactStatus[]).map((s) => (
                    <DropdownMenuItem key={s} onSelect={() => run({ action: "contact_status", value: s })}>{CONTACT_STATUS_LABELS[s]}</DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem onSelect={() => run({ action: "disqualify" })}>Disqualify</DropdownMenuItem>
              {isAdmin && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>Delete…</DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
          {pending && <Loader2 className="size-4 animate-spin" />}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="w-10 px-3 py-2">
                <Checkbox aria-label="Select all" checked={allSelected} onCheckedChange={(v) => setSelected(v ? new Set(rows.map((r) => r.id)) : new Set())} />
              </th>
              {sortHeader("name", "Company")}
              {sortHeader("score", "Score")}
              <th scope="col" className="px-3 py-2 text-left font-medium">Priority</th>
              {sortHeader("website_score", "Website")}
              {sortHeader("reviews", "Google")}
              <th scope="col" className="px-3 py-2 text-left font-medium">Biggest opportunity</th>
              <th scope="col" className="px-3 py-2 text-left font-medium">Stage</th>
              {sortHeader("follow_up", "Follow-up")}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={cn("group border-b transition-colors hover:bg-muted/40", selected.has(r.id) && "bg-brand-soft/40")}>
                <td className="px-3 py-2.5">
                  <Checkbox aria-label={`Select ${r.company_name}`} checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} />
                </td>
                <td className="max-w-[260px] px-3 py-2.5">
                  <Link href={`/companies/${r.company_id}`} className="block truncate font-medium hover:underline">{r.company_name}</Link>
                  <span className="block truncate text-xs text-muted-foreground">{[r.sector_name, r.city].filter(Boolean).join(" · ") || "—"}</span>
                </td>
                <td className="px-3 py-2.5"><ScoreBadge score={r.score} /></td>
                <td className="px-3 py-2.5"><PriorityBadge priority={r.priority} /></td>
                <td className="px-3 py-2.5"><WebsiteState state={r.website_state} score={r.website_score} /></td>
                <td className="tabular px-3 py-2.5 text-xs">
                  {r.google_reviews_count !== null ? (
                    <span className="inline-flex items-center gap-1">
                      <Star className="size-3 fill-current text-warm" />
                      {r.google_rating ?? "—"} <span className="text-muted-foreground">({formatNumber(r.google_reviews_count)})</span>
                    </span>
                  ) : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="max-w-[220px] truncate px-3 py-2.5 text-xs text-muted-foreground">
                  {r.website ? (r.website_top_issue ?? (r.website_state === "unknown" ? "Run an audit" : "—")) : "No website"}
                </td>
                <td className="px-3 py-2.5"><StageBadge stageKey={r.stage_key} name={r.stage_name} /></td>
                <td className={cn("px-3 py-2.5 text-xs", isOverdue(r.next_follow_up_at) ? "font-medium text-destructive" : "text-muted-foreground")}>
                  {r.next_follow_up_at ? formatRelative(r.next_follow_up_at) : CONTACT_STATUS_LABELS[r.contact_status as ContactStatus] ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} lead(s)?</AlertDialogTitle>
            <AlertDialogDescription>This deletes the companies with their contacts, deals, tasks and timeline. It cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => run({ action: "delete" })}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
