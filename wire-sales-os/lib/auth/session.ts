import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export const WORKSPACE_COOKIE = "wire_ws";

export type WorkspaceRole = Database["public"]["Enums"]["workspace_role"];
export type Workspace = Database["public"]["Tables"]["workspaces"]["Row"];

/** Verified user (asks Supabase Auth, does not trust the cookie blindly). Cached per request. */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
});

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

export const getMemberships = cache(async () => {
  const user = await getUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspace_members")
    .select("role, workspace:workspaces(*)")
    .eq("user_id", user.id)
    .order("created_at");
  return (data ?? [])
    .filter((m) => m.workspace)
    .map((m) => ({ role: m.role, workspace: m.workspace as unknown as Workspace }));
});

export type WorkspaceContext = {
  user: NonNullable<Awaited<ReturnType<typeof getUser>>>;
  workspace: Workspace;
  role: WorkspaceRole;
  isAdmin: boolean;
  supabase: Awaited<ReturnType<typeof createClient>>;
};

/** Current user + active workspace. Redirects to /login or /onboarding when missing. */
export const getWorkspaceContext = cache(async (): Promise<WorkspaceContext> => {
  const user = await requireUser();
  const memberships = await getMemberships();
  if (!memberships.length) redirect("/onboarding");
  const preferred = (await cookies()).get(WORKSPACE_COOKIE)?.value;
  const active = memberships.find((m) => m.workspace.id === preferred) ?? memberships[0];
  return {
    user,
    workspace: active.workspace,
    role: active.role,
    isAdmin: active.role === "owner" || active.role === "admin",
    supabase: await createClient(),
  };
});
