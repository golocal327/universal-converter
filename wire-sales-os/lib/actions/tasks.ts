"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActor } from "@/lib/auth/actor";
import { TASK_PRIORITIES, TASK_STATUSES, TASK_TYPES } from "@/lib/domain/constants";
import { logActivity } from "@/lib/services/activity";
import { emitEvent } from "@/lib/services/events";
import { fail, ok, type ActionResult } from "@/lib/services/types";

const uuid = z.string().uuid();

const taskSchema = z.object({
  id: uuid.optional(),
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().max(5000).nullable().optional(),
  type: z.enum(TASK_TYPES).default("other"),
  priority: z.enum(TASK_PRIORITIES).default("medium"),
  status: z.enum(TASK_STATUSES).default("todo"),
  due_at: z.string().datetime({ offset: true }).nullable().optional(),
  company_id: uuid.nullable().optional(),
  assignee_id: uuid.nullable().optional(),
});
export type TaskInput = z.input<typeof taskSchema>;

export async function saveTask(input: TaskInput): Promise<ActionResult<{ id: string }>> {
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields", parsed.error.flatten().fieldErrors as Record<string, string[]>);
  const actor = await getActor();
  const { id, ...t } = parsed.data;

  let leadId: string | null = null;
  let dealId: string | null = null;
  if (t.company_id) {
    const { data: lead } = await actor.db.from("leads").select("id").eq("company_id", t.company_id).maybeSingle();
    leadId = lead?.id ?? null;
    if (leadId) {
      const { data: deal } = await actor.db.from("deals").select("id").eq("lead_id", leadId).eq("status", "open").limit(1).maybeSingle();
      dealId = deal?.id ?? null;
    }
  }
  const row = {
    ...t,
    description: t.description ?? null,
    due_at: t.due_at ?? null,
    company_id: t.company_id ?? null,
    lead_id: leadId,
    deal_id: dealId,
    assignee_id: t.assignee_id ?? actor.userId,
    completed_at: t.status === "done" ? new Date().toISOString() : null,
  };
  const result = id
    ? await actor.db.from("tasks").update(row).eq("id", id).eq("workspace_id", actor.workspaceId).select("id").single()
    : await actor.db.from("tasks").insert({ ...row, workspace_id: actor.workspaceId, created_by: actor.userId }).select("id").single();
  if (result.error || !result.data) return fail(result.error?.message ?? "Could not save task");

  if (!id) {
    if (row.company_id) await logActivity(actor, { type: "task_created", title: `Task: ${row.title}`, companyId: row.company_id, leadId, dealId });
    await emitEvent(actor, "task.created", { type: "task", id: result.data.id }, { title: row.title, type: row.type, due_at: row.due_at, company_id: row.company_id });
  }
  revalidatePath("/tasks");
  if (row.company_id) revalidatePath(`/companies/${row.company_id}`);
  return ok({ id: result.data.id });
}

export async function setTaskStatus(taskId: string, status: (typeof TASK_STATUSES)[number]): Promise<ActionResult> {
  if (!uuid.safeParse(taskId).success || !TASK_STATUSES.includes(status)) return fail("Invalid request");
  const actor = await getActor();
  const { data: task, error } = await actor.db
    .from("tasks")
    .update({ status, completed_at: status === "done" ? new Date().toISOString() : null })
    .eq("id", taskId)
    .eq("workspace_id", actor.workspaceId)
    .select("title, company_id, lead_id, deal_id")
    .single();
  if (error || !task) return fail(error?.message ?? "Task not found");
  if (status === "done" && task.company_id) {
    await logActivity(actor, { type: "task_completed", title: `Completed: ${task.title}`, companyId: task.company_id, leadId: task.lead_id, dealId: task.deal_id });
  }
  revalidatePath("/tasks");
  if (task.company_id) revalidatePath(`/companies/${task.company_id}`);
  return ok(undefined);
}

export async function deleteTask(taskId: string): Promise<ActionResult> {
  if (!uuid.safeParse(taskId).success) return fail("Invalid task");
  const actor = await getActor();
  const { error } = await actor.db.from("tasks").delete().eq("id", taskId).eq("workspace_id", actor.workspaceId);
  if (error) return fail(error.message);
  revalidatePath("/tasks");
  return ok(undefined);
}
