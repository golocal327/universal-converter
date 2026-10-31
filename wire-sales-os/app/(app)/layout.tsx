import { AppFrame } from "@/components/app/app-frame";
import { getMemberships, getWorkspaceContext } from "@/lib/auth/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const ctx = await getWorkspaceContext();
  const memberships = await getMemberships();
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const { count: dueTasks } = await ctx.supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", ctx.workspace.id)
    .in("status", ["todo", "in_progress"])
    .lte("due_at", endOfToday.toISOString());
  const name = (ctx.user.user_metadata?.full_name as string | undefined) ?? ctx.user.email?.split("@")[0] ?? "User";

  return (
    <AppFrame
      workspace={{ id: ctx.workspace.id, name: ctx.workspace.name }}
      workspaces={memberships.map((m) => ({ id: m.workspace.id, name: m.workspace.name }))}
      user={{ name, email: ctx.user.email ?? "" }}
      badges={{ "/tasks": dueTasks ?? 0 }}
    >
      {children}
    </AppFrame>
  );
}
