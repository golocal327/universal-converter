import "server-only";
import type { Actor } from "@/lib/services/types";
import { getWorkspaceContext } from "./session";

/** The acting user in their active workspace, for service calls. */
export async function getActor(): Promise<Actor & { isAdmin: boolean }> {
  const ctx = await getWorkspaceContext();
  return { db: ctx.supabase, workspaceId: ctx.workspace.id, userId: ctx.user.id, isAdmin: ctx.isAdmin };
}

/** Durable per-user rate limit (see check_rate_limit in the security migration). */
export async function withinRateLimit(actor: Actor, bucket: string, limit: number, windowSeconds: number) {
  const { data, error } = await actor.db.rpc("check_rate_limit", { p_bucket: bucket, p_limit: limit, p_window_seconds: windowSeconds });
  if (error) {
    console.error("[rate-limit]", error.message);
    return true; // fail open on infrastructure errors; RLS still protects data
  }
  return data === true;
}
