"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActor } from "@/lib/auth/actor";
import { getMemberships, requireUser, WORKSPACE_COOKIE } from "@/lib/auth/session";
import { slugify } from "@/lib/lead-pipeline/normalize";
import { clearDemoData, loadDemoData } from "@/lib/services/demo";
import { fail, ok, type ActionResult } from "@/lib/services/types";
import { installDefaults } from "@/lib/services/workspace-setup";
import { createClient } from "@/lib/supabase/server";

const onboardingSchema = z.object({
  name: z.string().trim().min(2, "Name your workspace").max(80),
  sender_name: z.string().trim().min(2, "Your name appears in emails").max(80),
  demo: z.enum(["on"]).optional(),
});

export type OnboardingState = { error?: string; fieldErrors?: Record<string, string[] | undefined> } | null;

export async function createWorkspace(_: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const user = await requireUser();
  const parsed = onboardingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const slug = `${slugify(parsed.data.name).slice(0, 40) || "workspace"}-${crypto.randomUUID().slice(0, 6)}`;
  const { data: workspaceId, error } = await supabase.rpc("create_workspace", { p_name: parsed.data.name, p_slug: slug });
  if (error || !workspaceId) return { error: error?.message ?? "Could not create the workspace" };

  const actor = { db: supabase, workspaceId, userId: user.id };
  try {
    await installDefaults(actor, { senderName: parsed.data.sender_name, senderEmail: user.email ?? "" });
    if (parsed.data.demo) await loadDemoData(actor);
  } catch (e) {
    return { error: `Workspace created, but setup failed: ${(e as Error).message}` };
  }
  (await cookies()).set(WORKSPACE_COOKIE, workspaceId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect("/");
}

export async function switchWorkspace(workspaceId: string) {
  const memberships = await getMemberships();
  if (!memberships.some((m) => m.workspace.id === workspaceId)) return;
  (await cookies()).set(WORKSPACE_COOKIE, workspaceId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect("/");
}

export async function loadDemoDataAction(): Promise<ActionResult<{ companies: number }>> {
  const actor = await getActor();
  if (!actor.isAdmin) return fail("Only admins can load demo data");
  try {
    const res = await loadDemoData(actor);
    revalidatePath("/", "layout");
    return ok({ companies: res.companies });
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function clearDemoDataAction(): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor.isAdmin) return fail("Only admins can remove demo data");
  await clearDemoData(actor);
  revalidatePath("/", "layout");
  return ok(undefined);
}
