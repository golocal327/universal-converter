import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/** Any Supabase client typed with our schema (user-scoped or service role). */
export type Db = SupabaseClient<Database>;

/** Who is acting: the workspace plus the user (null for API-key / system calls). */
export type Actor = { db: Db; workspaceId: string; userId: string | null };

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}
export function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

/** Throw on Supabase errors with a readable message. */
export function must<T>(result: { data: T | null; error: { message: string } | null }, context: string): T {
  if (result.error) throw new Error(`${context}: ${result.error.message}`);
  if (result.data === null) throw new Error(`${context}: not found`);
  return result.data;
}
