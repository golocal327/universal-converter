import "server-only";
import type { ActivityType } from "@/lib/domain/constants";
import type { Json } from "@/lib/supabase/database.types";
import type { Actor } from "./types";

export type ActivityInput = {
  type: ActivityType;
  title: string;
  body?: string | null;
  companyId?: string | null;
  leadId?: string | null;
  dealId?: string | null;
  contactId?: string | null;
  metadata?: Record<string, Json>;
  occurredAt?: string;
};

/** Append to the timeline. Failures are logged, never block the main action. */
export async function logActivity(actor: Actor, input: ActivityInput | ActivityInput[]) {
  const rows = (Array.isArray(input) ? input : [input]).map((a) => ({
    workspace_id: actor.workspaceId,
    type: a.type,
    title: a.title.slice(0, 300),
    body: a.body ?? null,
    company_id: a.companyId ?? null,
    lead_id: a.leadId ?? null,
    deal_id: a.dealId ?? null,
    contact_id: a.contactId ?? null,
    metadata: (a.metadata ?? {}) as Json,
    actor_id: actor.userId,
    ...(a.occurredAt ? { occurred_at: a.occurredAt } : {}),
  }));
  if (!rows.length) return;
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await actor.db.from("activities").insert(rows.slice(i, i + 500));
    if (error) console.error("[activity] insert failed", error.message);
  }
}
