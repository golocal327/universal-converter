"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActor } from "@/lib/auth/actor";
import { CHANNELS, EMAIL_VARIANTS, TEMPLATE_CATEGORIES } from "@/lib/domain/constants";
import { fail, ok, type ActionResult } from "@/lib/services/types";
import { unknownVariables } from "@/lib/templates/render";

const uuid = z.string().uuid();
const templateSchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(1, "Name is required").max(120),
  category: z.enum(TEMPLATE_CATEGORIES),
  channel: z.enum(CHANNELS),
  variant: z.enum(EMAIL_VARIANTS).nullable().optional(),
  sector_id: uuid.nullable().optional(),
  subject: z.string().max(300).nullable().optional(),
  body: z.string().trim().min(1, "Body is required").max(20_000),
});
export type TemplateInput = z.input<typeof templateSchema>;

export async function saveTemplate(input: TemplateInput): Promise<ActionResult<{ id: string; unknown: string[] }>> {
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields", parsed.error.flatten().fieldErrors as Record<string, string[]>);
  const actor = await getActor();
  const { id, ...t } = parsed.data;
  const row = { ...t, variant: t.variant ?? null, sector_id: t.sector_id ?? null, subject: t.channel === "email" ? t.subject || null : null };
  const result = id
    ? await actor.db.from("email_templates").update(row).eq("id", id).eq("workspace_id", actor.workspaceId).select("id").single()
    : await actor.db.from("email_templates").insert({ ...row, workspace_id: actor.workspaceId, created_by: actor.userId }).select("id").single();
  if (result.error || !result.data) return fail(result.error?.message ?? "Could not save template");
  revalidatePath("/templates");
  return ok({ id: result.data.id, unknown: unknownVariables(`${row.subject ?? ""} ${row.body}`) });
}

export async function duplicateTemplate(id: string): Promise<ActionResult<{ id: string }>> {
  if (!uuid.safeParse(id).success) return fail("Invalid template");
  const actor = await getActor();
  const { data: t } = await actor.db.from("email_templates").select("name, category, channel, variant, sector_id, subject, body").eq("id", id).single();
  if (!t) return fail("Template not found");
  const { data, error } = await actor.db.from("email_templates").insert({ ...t, name: `${t.name} (copy)`.slice(0, 120), workspace_id: actor.workspaceId, created_by: actor.userId }).select("id").single();
  if (error || !data) return fail(error?.message ?? "Could not duplicate");
  revalidatePath("/templates");
  return ok({ id: data.id });
}

export async function deleteTemplate(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return fail("Invalid template");
  const actor = await getActor();
  const { error } = await actor.db.from("email_templates").delete().eq("id", id).eq("workspace_id", actor.workspaceId);
  if (error) return fail(error.message);
  revalidatePath("/templates");
  return ok(undefined);
}
