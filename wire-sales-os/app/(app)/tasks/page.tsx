import type { Metadata } from "next";
import Link from "next/link";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { NewTaskButton } from "@/components/tasks/new-task-button";
import { TaskList, type TaskRow } from "@/components/tasks/task-list";
import { getWorkspaceContext } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Tasks" };

const VIEWS = [
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "overdue", label: "Overdue" },
  { key: "done", label: "Completed" },
] as const;
type View = (typeof VIEWS)[number]["key"];

function bounds(now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { now: now.toISOString(), startOfDay: start.toISOString(), endOfDay: end.toISOString() };
}

export default async function TasksPage({ searchParams }: PageProps<"/tasks">) {
  const sp = await searchParams;
  const view: View = (VIEWS.find((v) => v.key === sp.view)?.key ?? "today") as View;
  const { supabase, workspace } = await getWorkspaceContext();
  const b = bounds();
  const open = ["todo", "in_progress"] as const;
  const base = () => supabase.from("tasks").select("id, title, description, type, priority, status, due_at, company_id, company:companies(name)").eq("workspace_id", workspace.id);

  const counts = await Promise.all([
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id).in("status", open).gte("due_at", b.now).lt("due_at", b.endOfDay),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id).in("status", open).or(`due_at.gte.${b.endOfDay},due_at.is.null`),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id).in("status", open).lt("due_at", b.now),
  ]);
  const query =
    view === "today" ? base().in("status", open).lte("due_at", b.endOfDay).order("due_at")
    : view === "upcoming" ? base().in("status", open).or(`due_at.gte.${b.endOfDay},due_at.is.null`).order("due_at", { nullsFirst: false })
    : view === "overdue" ? base().in("status", open).lt("due_at", b.now).order("due_at")
    : base().eq("status", "done").order("completed_at", { ascending: false }).limit(100);
  const { data, error } = await query.limit(300);
  if (error) throw new Error(error.message);
  const rows: TaskRow[] = (data ?? []).map((t) => ({ ...t, company_name: (t.company as unknown as { name: string } | null)?.name ?? null }));
  const countFor: Record<View, number | null> = { today: (counts[0].count ?? 0) + (counts[2].count ?? 0), upcoming: counts[1].count ?? 0, overdue: counts[2].count ?? 0, done: null };

  return (
    <>
      <PageHeader title="Tasks" description="Today includes anything overdue." actions={<NewTaskButton />}>
        <nav className="-mb-5 mt-4 flex gap-1" aria-label="Task views">
          {VIEWS.map((v) => (
            <Link key={v.key} href={`/tasks?view=${v.key}`} aria-current={view === v.key ? "page" : undefined}
              className={cn("border-b-2 px-3 py-2 text-sm", view === v.key ? "border-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}>
              {v.label}
              {countFor[v.key] ? <span className={cn("tabular ml-1.5 text-xs", v.key === "overdue" ? "text-destructive" : "text-muted-foreground")}>{countFor[v.key]}</span> : null}
            </Link>
          ))}
        </nav>
      </PageHeader>
      <PageBody className="max-w-4xl">
        <TaskList tasks={rows} emptyLabel={view === "overdue" ? "Nothing overdue. Nice." : view === "today" ? "Nothing due today. Pick a hot lead from the Command Center." : "No tasks."} />
      </PageBody>
    </>
  );
}
