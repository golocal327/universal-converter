import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { NewLeadForm } from "@/components/leads/new-lead-form";
import { getWorkspaceContext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "New lead" };

export default async function NewLeadPage() {
  const { supabase, workspace } = await getWorkspaceContext();
  const { data: sectors } = await supabase.from("sectors").select("id, name").eq("workspace_id", workspace.id).order("name");
  return (
    <>
      <PageHeader title="New lead" description="The lead is normalized, checked for duplicates and scored automatically." />
      <PageBody className="max-w-3xl">
        <NewLeadForm sectors={sectors ?? []} />
      </PageBody>
    </>
  );
}
