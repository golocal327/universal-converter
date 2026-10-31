"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCorners, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarClock, ExternalLink, GripVertical, User } from "lucide-react";
import { toast } from "sonner";
import { DealEditDialog } from "@/components/company/deals-card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { moveDeal } from "@/lib/actions/pipeline";
import { formatCurrency, formatRelative, isOverdue } from "@/lib/format";
import { cn } from "@/lib/utils";

export type KanbanStage = { id: string; key: string; name: string; probability: number; is_won: boolean; is_lost: boolean };
export type KanbanDeal = {
  id: string; title: string; company_id: string; company_name: string; contact_name: string | null; stage_id: string; value: number;
  setup_value: number; monthly_value: number; probability: number | null; weighted_value: number; next_action: string | null;
  next_action_at: string | null; last_contact_at: string | null; sort_order: number; lead_priority: string | null; expected_close_date: string | null;
};

const ACCENT: Record<string, string> = {
  new: "bg-cold", qualified: "bg-chart-2", contacted: "bg-brand", replied: "bg-brand", meeting: "bg-warm",
  proposal: "bg-warm", negotiation: "bg-hot", won: "bg-success", lost: "bg-muted-foreground/40",
};

function DealCard({ deal, onOpen, dragging }: { deal: KanbanDeal; onOpen?: () => void; dragging?: boolean }) {
  const followUpOverdue = isOverdue(deal.next_action_at);
  return (
    <div className={cn("group rounded-lg border bg-card p-3 text-left shadow-xs transition-shadow", dragging ? "rotate-1 shadow-lg ring-2 ring-ring/40" : "hover:shadow-sm")}>
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={onOpen} className="min-w-0 text-left">
          <p className="truncate text-sm font-medium">{deal.company_name}</p>
          <p className="truncate text-xs text-muted-foreground">{deal.title.replace(`${deal.company_name} — `, "")}</p>
        </button>
        {deal.lead_priority === "hot" && <span className="mt-1 size-1.5 shrink-0 rounded-full bg-hot" aria-label="Hot lead" />}
      </div>
      <div className="mt-2.5 flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">{formatCurrency(deal.value)}</span>
        <span className="tabular text-xs text-muted-foreground">{deal.probability ?? 0}% · {formatCurrency(deal.weighted_value)}</span>
      </div>
      <p className="tabular text-[11px] text-muted-foreground">{formatCurrency(deal.setup_value)} + {formatCurrency(deal.monthly_value)}/mo</p>
      {(deal.contact_name || deal.next_action || deal.last_contact_at) && (
        <div className="mt-2 space-y-1 border-t pt-2 text-xs text-muted-foreground">
          {deal.contact_name && <p className="flex items-center gap-1.5 truncate"><User className="size-3" />{deal.contact_name}</p>}
          {deal.next_action && (
            <p className={cn("flex items-center gap-1.5 truncate", followUpOverdue && "font-medium text-destructive")}>
              <CalendarClock className="size-3" />{deal.next_action}{deal.next_action_at ? ` · ${formatRelative(deal.next_action_at)}` : ""}
            </p>
          )}
          {deal.last_contact_at && <p>Last contact {formatRelative(deal.last_contact_at)}</p>}
        </div>
      )}
    </div>
  );
}

function SortableDeal({ deal, onOpen }: { deal: KanbanDeal; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: deal.id, data: { stageId: deal.stage_id } });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn("relative", isDragging && "opacity-40")}>
      <button type="button" {...attributes} {...listeners} aria-label={`Move ${deal.company_name}`}
        className="absolute top-2 -left-1 z-10 cursor-grab rounded p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted focus-visible:opacity-100 active:cursor-grabbing [div:hover>&]:opacity-100">
        <GripVertical className="size-3.5" />
      </button>
      <div {...listeners} className="cursor-grab active:cursor-grabbing"><DealCard deal={deal} onOpen={onOpen} /></div>
    </div>
  );
}

function Column({ stage, deals, onOpen }: { stage: KanbanStage; deals: KanbanDeal[]; onOpen: (d: KanbanDeal) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${stage.id}`, data: { stageId: stage.id } });
  const total = deals.reduce((a, d) => a + d.value, 0);
  const weighted = deals.reduce((a, d) => a + d.weighted_value, 0);
  return (
    <section aria-label={stage.name} className="flex w-72 shrink-0 flex-col rounded-xl bg-muted/40">
      <header className="px-3 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <span className={cn("size-2 rounded-full", ACCENT[stage.key] ?? "bg-muted-foreground")} />
          <h2 className="text-xs font-semibold tracking-wide uppercase">{stage.name}</h2>
          <span className="tabular ml-auto text-xs text-muted-foreground">{deals.length}</span>
        </div>
        <p className="tabular mt-1 text-xs text-muted-foreground">{formatCurrency(total, true)}{!stage.is_won && !stage.is_lost ? ` · weighted ${formatCurrency(weighted, true)}` : ""}</p>
      </header>
      <div ref={setNodeRef} className={cn("flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-3 transition-colors", isOver && "rounded-lg bg-brand-soft/50")}>
        <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
          {deals.map((d) => <SortableDeal key={d.id} deal={d} onOpen={() => onOpen(d)} />)}
        </SortableContext>
        {deals.length === 0 && <p className="px-2 py-6 text-center text-xs text-muted-foreground">Drop deals here</p>}
      </div>
    </section>
  );
}

/** Drag-and-drop pipeline with optimistic updates (reverted on failure). */
export function Kanban({ stages, initialDeals }: { stages: KanbanStage[]; initialDeals: KanbanDeal[] }) {
  const router = useRouter();
  const [deals, setDeals] = useState(initialDeals);
  const [active, setActive] = useState<KanbanDeal | null>(null);
  const [origin, setOrigin] = useState<{ stageId: string; snapshot: KanbanDeal[] } | null>(null);
  const [lostPrompt, setLostPrompt] = useState<{ dealId: string; stageId: string; sortOrder: number; snapshot: KanbanDeal[] } | null>(null);
  const [lostReason, setLostReason] = useState("");
  const [editing, setEditing] = useState<KanbanDeal | null>(null);
  const [, startTransition] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const byStage = useMemo(() => {
    const map = new Map<string, KanbanDeal[]>(stages.map((s) => [s.id, []]));
    for (const d of [...deals].sort((a, b) => a.sort_order - b.sort_order)) map.get(d.stage_id)?.push(d);
    return map;
  }, [deals, stages]);

  const stageOf = (id: string | number | undefined): string | null => {
    if (id === undefined) return null;
    const s = String(id);
    if (s.startsWith("column:")) return s.slice(7);
    return deals.find((d) => d.id === s)?.stage_id ?? null;
  };

  const onDragStart = (e: DragStartEvent) => {
    const deal = deals.find((d) => d.id === e.active.id) ?? null;
    setActive(deal);
    if (deal) setOrigin({ stageId: deal.stage_id, snapshot: deals });
  };

  const onDragOver = (e: DragOverEvent) => {
    const to = stageOf(e.over?.id);
    if (!to || !active) return;
    setDeals((prev) => prev.map((d) => (d.id === active.id && d.stage_id !== to ? { ...d, stage_id: to } : d)));
  };

  const commit = (dealId: string, stageId: string, sortOrder: number, snapshot: KanbanDeal[], reason?: string) =>
    startTransition(async () => {
      const stage = stages.find((s) => s.id === stageId);
      setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, stage_id: stageId, sort_order: sortOrder, probability: stage?.probability ?? d.probability, weighted_value: Math.round(d.value * (stage?.probability ?? 0)) / 100 } : d)));
      const r = await moveDeal({ dealId, stageId, sortOrder, lostReason: reason ?? null });
      if (!r.ok) {
        setDeals(snapshot);
        toast.error(r.error);
        return;
      }
      if (stage?.is_won) toast.success("Deal won — customer created");
      router.refresh();
    });

  const onDragEnd = (e: DragEndEvent) => {
    const deal = active;
    setActive(null);
    if (!deal || !origin) return;
    const to = stageOf(e.over?.id) ?? deal.stage_id;
    const column = (byStage.get(to) ?? []).filter((d) => d.id !== deal.id);
    const overIndex = e.over && !String(e.over.id).startsWith("column:") ? column.findIndex((d) => d.id === e.over?.id) : column.length;
    const index = overIndex < 0 ? column.length : overIndex;
    const before = column[index - 1]?.sort_order;
    const after = column[index]?.sort_order;
    const sortOrder = before === undefined && after === undefined ? 0 : before === undefined ? (after as number) - 1 : after === undefined ? before + 1 : (before + after) / 2;
    const sameSpot = to === origin.stageId && Math.abs(sortOrder - deal.sort_order) < 1e-9;
    if (sameSpot) return;
    const target = stages.find((s) => s.id === to);
    if (target?.is_lost && to !== origin.stageId) {
      setLostPrompt({ dealId: deal.id, stageId: to, sortOrder, snapshot: origin.snapshot });
      return;
    }
    commit(deal.id, to, sortOrder, origin.snapshot);
  };

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => { if (origin) setDeals(origin.snapshot); setActive(null); }}>
        <div className="flex gap-3 overflow-x-auto px-4 pb-6 sm:px-6 lg:px-8" style={{ minHeight: "calc(100svh - 12rem)" }}>
          {stages.map((s) => <Column key={s.id} stage={s} deals={byStage.get(s.id) ?? []} onOpen={setEditing} />)}
        </div>
        <DragOverlay>{active ? <div className="w-68"><DealCard deal={active} dragging /></div> : null}</DragOverlay>
      </DndContext>

      <Dialog open={Boolean(lostPrompt)} onOpenChange={(o) => { if (!o && lostPrompt) { setDeals(lostPrompt.snapshot); setLostPrompt(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Why was this deal lost?</DialogTitle>
            <DialogDescription>The reason feeds win/loss analytics.</DialogDescription>
          </DialogHeader>
          <Input autoFocus value={lostReason} onChange={(e) => setLostReason(e.target.value)} placeholder="e.g. Chose a cheaper provider" />
          <DialogFooter>
            <Button onClick={() => { if (lostPrompt) commit(lostPrompt.dealId, lostPrompt.stageId, lostPrompt.sortOrder, lostPrompt.snapshot, lostReason || undefined); setLostPrompt(null); setLostReason(""); }}>Mark as lost</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editing && (
        <DealEditDialog
          deal={editing}
          onClose={() => setEditing(null)}
          footerExtra={<Button variant="ghost" asChild><Link href={`/companies/${editing.company_id}`}><ExternalLink /> Open company</Link></Button>}
        />
      )}
    </>
  );
}
