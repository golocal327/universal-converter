"use server";
import { z } from "zod";
import { getActor } from "@/lib/auth/actor";

export type SearchHit = { kind: string; id: string; title: string; subtitle: string; href: string };

export async function globalSearch(query: string): Promise<SearchHit[]> {
  const q = z.string().trim().min(1).max(80).safeParse(query);
  if (!q.success) return [];
  const actor = await getActor();
  const { data, error } = await actor.db.rpc("global_search", { p_workspace_id: actor.workspaceId, p_query: q.data, p_limit: 5 });
  if (error) {
    console.error("[search]", error.message);
    return [];
  }
  return (data ?? []) as SearchHit[];
}
