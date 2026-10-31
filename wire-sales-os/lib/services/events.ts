import "server-only";
import { after } from "next/server";
import type { EventType } from "@/lib/events/types";
import { signPayload } from "@/lib/events/sign";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { parseSettings } from "@/lib/settings/schema";
import type { Actor, Db } from "./types";

/**
 * Transactional-outbox events for automation (n8n, Make, Zapier…).
 * 1. emitEvent() inserts into public.events as the acting user (RLS).
 * 2. After the response is sent, pending events are POSTed to the workspace
 *    webhook with an HMAC signature. Undelivered events are retried by
 *    /api/cron/deliver-events.
 */
export async function emitEvent(
  actor: Actor,
  type: EventType,
  entity: { type: string; id: string | null },
  payload: Record<string, Json | undefined>,
) {
  const { error } = await actor.db.from("events").insert({
    workspace_id: actor.workspaceId,
    type,
    entity_type: entity.type,
    entity_id: entity.id,
    payload: payload as Json,
  });
  if (error) {
    console.error("[events] insert failed", error.message);
    return;
  }
  scheduleDelivery(actor.workspaceId);
}

function scheduleDelivery(workspaceId: string) {
  try {
    after(() => deliverPendingEvents(workspaceId).catch((e) => console.error("[events] delivery failed", e)));
  } catch {
    // Outside a request scope (scripts/tests): the cron job will deliver.
  }
}

const MAX_ATTEMPTS = 8;

/** Deliver pending events for one workspace (or all, when workspaceId is null). Requires the service role. */
export async function deliverPendingEvents(workspaceId: string | null, limit = 50): Promise<{ delivered: number; failed: number; skipped: boolean }> {
  if (!isAdminConfigured()) return { delivered: 0, failed: 0, skipped: true };
  const admin: Db = createAdminClient();

  let query = admin
    .from("events")
    .select("id, workspace_id, type, entity_type, entity_id, payload, created_at, attempts")
    .is("delivered_at", null)
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at")
    .limit(limit);
  if (workspaceId) query = query.eq("workspace_id", workspaceId);
  const { data: events } = await query;
  if (!events?.length) return { delivered: 0, failed: 0, skipped: false };

  const workspaceIds = [...new Set(events.map((e) => e.workspace_id))];
  const [{ data: settingsRows }, { data: secrets }] = await Promise.all([
    admin.from("settings").select("workspace_id, automation").in("workspace_id", workspaceIds),
    admin.from("workspace_secrets").select("workspace_id, webhook_secret").in("workspace_id", workspaceIds),
  ]);
  const config = new Map(
    workspaceIds.map((id) => {
      const automation = parseSettings({ automation: settingsRows?.find((s) => s.workspace_id === id)?.automation }).automation;
      return [id, { ...automation, secret: secrets?.find((s) => s.workspace_id === id)?.webhook_secret ?? null }];
    }),
  );

  let delivered = 0;
  let failed = 0;
  for (const event of events) {
    const cfg = config.get(event.workspace_id);
    if (!cfg?.webhookUrl || !/^https:\/\//.test(cfg.webhookUrl)) continue; // not configured: keep in outbox
    if (cfg.enabledEvents.length && !cfg.enabledEvents.includes(event.type)) {
      await admin.from("events").update({ delivered_at: new Date().toISOString(), last_error: "filtered" }).eq("id", event.id);
      continue;
    }
    const body = JSON.stringify({
      id: event.id,
      type: event.type,
      created_at: event.created_at,
      workspace_id: event.workspace_id,
      entity: { type: event.entity_type, id: event.entity_id },
      data: event.payload,
    });
    try {
      const res = await fetch(cfg.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "WIRE-SalesOS-Webhooks/1.0",
          "X-Wire-Event": event.type,
          ...(cfg.secret ? { "X-Wire-Signature": signPayload(cfg.secret, body) } : {}),
        },
        body,
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await admin.from("events").update({ delivered_at: new Date().toISOString(), attempts: event.attempts + 1, last_error: null }).eq("id", event.id);
      delivered++;
    } catch (error) {
      await admin.from("events").update({ attempts: event.attempts + 1, last_error: String(error).slice(0, 300) }).eq("id", event.id);
      failed++;
    }
  }
  return { delivered, failed, skipped: false };
}
