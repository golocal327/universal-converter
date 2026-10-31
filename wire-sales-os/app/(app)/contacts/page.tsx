import type { Metadata } from "next";
import { Users } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { Pagination } from "@/components/app/pagination";
import { SearchInput } from "@/components/app/search-input";
import { ContactsTable, type ContactListRow } from "@/components/contacts/contacts-table";
import { getWorkspaceContext } from "@/lib/auth/session";
import { sanitizeSearch } from "@/lib/filters/leads";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Contacts" };
const PER = 50;

export default async function ContactsPage({ searchParams }: PageProps<"/contacts">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sanitizeSearch(sp.q).slice(0, 80) : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const { supabase, workspace } = await getWorkspaceContext();
  let query = supabase.from("contacts").select("id, full_name, role, email, phone, is_primary, company_id, company:companies(name)", { count: "exact" }).eq("workspace_id", workspace.id);
  if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,role.ilike.%${q}%`);
  const { data, count, error } = await query.order("created_at", { ascending: false }).range((page - 1) * PER, page * PER - 1);
  if (error) throw new Error(error.message);
  const rows: ContactListRow[] = (data ?? []).map((c) => ({ ...c, company_name: (c.company as unknown as { name: string } | null)?.name ?? null }));
  return (
    <>
      <PageHeader title="Contacts" description={`${formatNumber(count ?? 0)} people`}>
        <div className="mt-4"><SearchInput placeholder="Search name, email, phone…" /></div>
      </PageHeader>
      {rows.length || q ? (
        <>
          <ContactsTable rows={rows} />
          {!rows.length && <EmptyState icon={Users} title="No contacts match" />}
          <Pagination page={page} per={PER} total={count ?? 0} basePath="/contacts" params={{ q: q || undefined }} />
        </>
      ) : (
        <>
          <ContactsTable rows={[]} />
          <EmptyState icon={Users} title="No contacts yet" description="Add decision makers to companies so outreach is addressed to a real person." />
        </>
      )}
    </>
  );
}
