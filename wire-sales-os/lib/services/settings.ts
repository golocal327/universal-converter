import "server-only";
import { parseSettings, type WorkspaceSettings } from "@/lib/settings/schema";
import type { Db } from "./types";

export async function loadSettings(db: Db, workspaceId: string): Promise<WorkspaceSettings> {
  const { data } = await db.from("settings").select("scoring, branding, ai, automation").eq("workspace_id", workspaceId).maybeSingle();
  return parseSettings(data);
}
