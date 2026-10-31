"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActor } from "@/lib/auth/actor";
import { ensureDealForLead, moveDealToStage } from "@/lib/services/pipeline";
import { fail, ok, type ActionResult } from "@/lib/services/types";

const uuid = z.string().uuid();

const moveSchema = z.object({ dealId: uuid, stageId: uuid, sortOrder: z.number().finite().optional(), lostReason: z.string().max(300).nullable().optional() });

export async function moveDeal(input: z.input<typeof moveSchema>): Promise<ActionResult> {
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid move");
  const actor = await getActor();
  try {
    await moveDealToStage(actor, parsed.data.dealId, parsed.data.stageId, parsed.data.sortOrder, parsed.data.lostReason);
  } catch (e) {
    return fail((e as Error).message);
  }
  revalidatePath("/pipeline");
  return ok(undefined);
}

const money = z.coerce.number().min(0).max(10_000_000);
const updateSchema = z.object({
  dealId: uuid,
  title: z.string().trim().min(1).max(200).optional(),
  setup_value: money.optional(),
  monthly_value: money.optional(),
  probability: z.coerce.number().int().min(0).max(100).nullable().optional(),
  expected_close_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  next_action: z.string().max(300).nullable().optional(),
  next_action_at: z.string().datetime({ offset: true }).nullable().optional(),
  notes: z.string().max(10_000).nullable().optional(),
});

export async function updateDeal(input: z.input<typeof updateSchema>): Promise<ActionResult> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid deal");
  const actor = await getActor();
  const { dealId, ...patch } = parsed.data;
  const { data, error } = await actor.db.from("deals").update(patch).eq("id", dealId).eq("workspace_id", actor.workspaceId).select("company_id").single();
  if (error || !data) return fail(error?.message ?? "Deal not found");
  revalidatePath("/pipeline");
  revalidatePath(`/companies/${data.company_id}`);
  return ok(undefined);
}

export async function createDealForCompany(companyId: string): Promise<ActionResult<{ dealId: string }>> {
  if (!uuid.safeParse(companyId).success) return fail("Invalid company");
  const actor = await getActor();
  const { data: lead } = await actor.db.from("leads").select("id").eq("company_id", companyId).maybeSingle();
  if (!lead) return fail("This company has no lead record");
  try {
    const { dealId } = await ensureDealForLead(actor, lead.id, { stageKey: "qualified" });
    revalidatePath("/pipeline");
    revalidatePath(`/companies/${companyId}`);
    return ok({ dealId });
  } catch (e) {
    return fail((e as Error).message);
  }
}
