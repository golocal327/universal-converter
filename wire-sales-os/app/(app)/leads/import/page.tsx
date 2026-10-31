import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { CsvImport } from "@/components/leads/csv-import";
import { getWorkspaceContext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Import leads" };

export default async function ImportPage() {
  const { supabase, workspace } = await getWorkspaceContext();
  const { data: campaigns } = await supabase.from("campaigns").select("id, name").eq("workspace_id", workspace.id).order("created_at", { ascending: false });
  return (
    <>
      <PageHeader title="Import leads" description="CSV → mapping → normalization → validation → de-duplication → scoring → CRM." />
      <PageBody className="max-w-4xl">
        <CsvImport campaigns={campaigns ?? []} />
      </PageBody>
    </>
  );
}
