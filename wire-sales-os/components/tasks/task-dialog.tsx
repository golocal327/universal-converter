"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { globalSearch, type SearchHit } from "@/lib/actions/search";
import { saveTask } from "@/lib/actions/tasks";
import { TASK_PRIORITIES, TASK_TYPE_LABELS, TASK_TYPES, type TaskPriority, type TaskType } from "@/lib/domain/constants";

export type TaskDraft = {
  id?: string; title: string; description: string | null; type: TaskType; priority: TaskPriority; due_at: string | null;
  company_id: string | null; company_name?: string | null; status?: "todo" | "in_progress" | "done" | "cancelled";
};

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Create/edit a task. The company is fixed when opened from a company profile, searchable otherwise. */
export function TaskDialog({ open, onOpenChange, initial, lockCompany = false }: {
  open: boolean; onOpenChange: (open: boolean) => void; initial: TaskDraft; lockCompany?: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<TaskDraft>(initial);
  const [due, setDue] = useState(toLocalInput(initial.due_at));
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (lockCompany || query.trim().length < 2) return;
    const t = setTimeout(async () => setHits((await globalSearch(query)).filter((h) => h.kind === "company")), 200);
    return () => clearTimeout(t);
  }, [query, lockCompany]);

  const submit = () =>
    startTransition(async () => {
      const r = await saveTask({
        id: draft.id, title: draft.title, description: draft.description, type: draft.type, priority: draft.priority,
        status: draft.status ?? "todo", due_at: due ? new Date(due).toISOString() : null, company_id: draft.company_id,
      });
      if (!r.ok) {
        toast.error(Object.values(r.fieldErrors ?? {})[0]?.[0] ?? r.error);
        return;
      }
      toast.success(draft.id ? "Task updated" : "Task created");
      onOpenChange(false);
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{draft.id ? "Edit task" : "New task"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="t-title" className="text-xs">Title</Label>
            <Input id="t-title" autoFocus value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Call to present the proposal" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Type</Label>
              <Select value={draft.type} onValueChange={(v) => setDraft({ ...draft, type: v as TaskType })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{TASK_TYPES.map((t) => <SelectItem key={t} value={t}>{TASK_TYPE_LABELS[t]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Priority</Label>
              <Select value={draft.priority} onValueChange={(v) => setDraft({ ...draft, priority: v as TaskPriority })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{TASK_PRIORITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="t-due" className="text-xs">Due</Label>
            <Input id="t-due" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Company</Label>
            {lockCompany ? (
              <p className="text-sm">{draft.company_name ?? "—"}</p>
            ) : draft.company_id ? (
              <div className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm">
                {draft.company_name}
                <Button size="xs" variant="ghost" onClick={() => setDraft({ ...draft, company_id: null, company_name: null })}>Change</Button>
              </div>
            ) : (
              <div className="relative">
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search company (optional)…" />
                {hits.length > 0 && query.length >= 2 && (
                  <ul className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md">
                    {hits.map((h) => (
                      <li key={h.id}>
                        <button type="button" className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted" onClick={() => { setDraft({ ...draft, company_id: h.id, company_name: h.title }); setQuery(""); setHits([]); }}>
                          {h.title} <span className="text-xs text-muted-foreground">{h.subtitle}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="t-desc" className="text-xs">Notes</Label>
            <Textarea id="t-desc" rows={3} value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending || !draft.title.trim()}>{pending && <Loader2 className="animate-spin" />} Save task</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
