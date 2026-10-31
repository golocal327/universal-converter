import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { TemplateManager, type TemplateRow } from "@/components/templates/template-manager";
import { getActor } from "@/lib/auth/actor";
import { getWorkspaceContext } from "@/lib/auth/session";
import { buildLeadContext } from "@/lib/services/lead-context";
import { buildTemplateValues } from "@/lib/templates/render";

export const metadata: Metadata = { title: "Templates" };

export default async function TemplatesPage() {
  const { supabase, workspace } = await getWorkspaceContext();
  const [{ data: templates }, { data: sectors }, { data: top }] = await Promise.all([
    supabase.from("email_templates").select("id, name, category, channel, variant, sector_id, subject, body").eq("workspace_id", workspace.id).eq("is_archived", false).order("category").order("name"),
    supabase.from("sectors").select("id, name").eq("workspace_id", workspace.id).order("name"),
    supabase.from("leads").select("company_id").eq("workspace_id", workspace.id).order("score", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const ctx = top ? await buildLeadContext(await getActor(), top.company_id) : null;
  return (
    <>
      <PageHeader title="Templates" description="Reusable outreach with variables filled from real lead data." />
      <PageBody>
        <TemplateManager templates={(templates ?? []) as TemplateRow[]} sectors={sectors ?? []} sample={ctx ? { company: ctx.company.name, values: buildTemplateValues(ctx) } : null} />
      </PageBody>
    </>
  );
}
