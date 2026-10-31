"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { deleteTask, setTaskStatus } from "@/lib/actions/tasks";
import { TASK_TYPE_LABELS, type TaskPriority, type TaskType } from "@/lib/domain/constants";
import { formatDateTime, formatRelative, isOverdue } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TaskDialog, type TaskDraft } from "./task-dialog";

export type TaskRow = {
  id: string; title: string; description: string | null; type: TaskType; priority: TaskPriority; status: "todo" | "in_progress" | "done" | "cancelled";
  due_at: string | null; company_id: string | null; company_name: string | null;
};

const PRIORITY_DOT: Record<TaskPriority, string> = { urgent: "bg-destructive", high: "bg-hot", medium: "bg-warm", low: "bg-cold" };

export function TaskList({ tasks, showCompany = true, newTaskDefaults, emptyLabel = "Nothing here." }: {
  tasks: TaskRow[]; showCompany?: boolean; newTaskDefaults?: Partial<TaskDraft>; emptyLabel?: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(tasks, (state, id: string) => state.map((t) => (t.id === id ? { ...t, status: t.status === "done" ? "todo" : "done" } as TaskRow : t)));
  const [editing, setEditing] = useState<TaskDraft | null>(null);

  const toggle = (t: TaskRow) =>
    startTransition(async () => {
      setOptimistic(t.id);
      const r = await setTaskStatus(t.id, t.status === "done" ? "todo" : "done");
      if (!r.ok) toast.error(r.error);
      router.refresh();
    });

  const blank: TaskDraft = { title: "", description: null, type: "follow_up", priority: "medium", due_at: new Date(Date.now() + 86_400_000).toISOString(), company_id: null, ...newTaskDefaults };

  return (
    <div>
      {optimistic.length === 0 ? <p className="px-1 py-4 text-sm text-muted-foreground">{emptyLabel}</p> : (
        <ul className="divide-y">
          {optimistic.map((t) => {
            const overdue = t.status !== "done" && isOverdue(t.due_at);
            return (
              <li key={t.id} className="group flex items-start gap-3 px-1 py-2.5">
                <Checkbox className="mt-0.5" checked={t.status === "done"} onCheckedChange={() => toggle(t)} aria-label={`Complete ${t.title}`} />
                <div className="min-w-0 flex-1">
                  <p className={cn("flex items-center gap-2 text-sm", t.status === "done" && "text-muted-foreground line-through")}>
                    <span className={cn("size-1.5 shrink-0 rounded-full", PRIORITY_DOT[t.priority])} aria-label={`${t.priority} priority`} />
                    <span className="truncate">{t.title}</span>
                  </p>
                  <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                    <span>{TASK_TYPE_LABELS[t.type]}</span>
                    {t.due_at && <span className={cn(overdue && "font-medium text-destructive")} title={formatDateTime(t.due_at)}>{overdue ? "Overdue · " : ""}{formatRelative(t.due_at)}</span>}
                    {showCompany && t.company_id && <Link href={`/companies/${t.company_id}`} className="hover:text-foreground hover:underline">{t.company_name}</Link>}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon-xs" variant="ghost" className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100" aria-label="Task actions"><MoreHorizontal /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setEditing({ ...t })}>Edit</DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onSelect={() => startTransition(async () => { const r = await deleteTask(t.id); if (r.ok) router.refresh(); else toast.error(r.error); })}>Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            );
          })}
        </ul>
      )}
      {newTaskDefaults && <Button size="sm" variant="ghost" className="mt-1" onClick={() => setEditing(blank)}><Plus /> Add task</Button>}
      {editing && <TaskDialog key={editing.id ?? "new"} open onOpenChange={(o) => !o && setEditing(null)} initial={editing} lockCompany={Boolean(newTaskDefaults?.company_id)} />}
    </div>
  );
}
