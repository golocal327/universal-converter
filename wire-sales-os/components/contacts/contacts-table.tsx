"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Loader2, Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveContact } from "@/lib/actions/company";
import { globalSearch, type SearchHit } from "@/lib/actions/search";

export type ContactListRow = {
  id: string; full_name: string; role: string | null; email: string | null; phone: string | null; is_primary: boolean; company_id: string | null; company_name: string | null;
};
type Draft = Partial<ContactListRow>;

export function ContactsTable({ rows }: { rows: ContactListRow[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (query.trim().length < 2) return;
    const t = setTimeout(async () => setHits((await globalSearch(query)).filter((h) => h.kind === "company")), 200);
    return () => clearTimeout(t);
  }, [query]);

  const save = () =>
    startTransition(async () => {
      if (!draft?.company_id) {
        toast.error("Choose a company");
        return;
      }
      const r = await saveContact({ id: draft.id, companyId: draft.company_id, full_name: draft.full_name ?? "", role: draft.role ?? null, email: draft.email ?? null, phone: draft.phone ?? null, is_primary: Boolean(draft.is_primary) });
      if (!r.ok) { toast.error(Object.values(r.fieldErrors ?? {})[0]?.[0] ?? r.error); return; }
      toast.success("Contact saved");
      setDraft(null);
      router.refresh();
    });

  return (
    <>
      <div className="flex justify-end px-4 pt-3 sm:px-6 lg:px-8"><Button size="sm" onClick={() => setDraft({})}><Plus /> New contact</Button></div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
            <tr><th className="px-4 py-2 text-left font-medium">Name</th><th className="px-3 py-2 text-left font-medium">Company</th><th className="px-3 py-2 text-left font-medium">Email</th><th className="px-3 py-2 text-left font-medium">Phone</th></tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-b hover:bg-muted/40">
                <td className="px-4 py-2.5">
                  <button type="button" className="font-medium hover:underline" onClick={() => setDraft(c)}>{c.full_name}</button>
                  {c.is_primary && <Star className="ml-1.5 inline size-3 fill-current text-warm" aria-label="Primary" />}
                  {c.role && <span className="block text-xs text-muted-foreground">{c.role}</span>}
                </td>
                <td className="px-3 py-2.5">{c.company_id ? <Link href={`/companies/${c.company_id}`} className="hover:underline">{c.company_name}</Link> : "—"}</td>
                <td className="px-3 py-2.5">{c.email ? <a href={`mailto:${c.email}`} className="hover:underline">{c.email}</a> : "—"}</td>
                <td className="px-3 py-2.5">{c.phone ? <a href={`tel:${c.phone}`} className="hover:underline">{c.phone}</a> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={Boolean(draft)} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{draft?.id ? "Edit contact" : "New contact"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Company</Label>
              {draft?.company_id ? (
                <div className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm">{draft.company_name}{!draft.id && <Button size="xs" variant="ghost" onClick={() => setDraft({ ...draft, company_id: null, company_name: null })}>Change</Button>}</div>
              ) : (
                <div className="relative">
                  <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search company…" />
                  {hits.length > 0 && query.length >= 2 && (
                    <ul className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md">
                      {hits.map((h) => <li key={h.id}><button type="button" className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted" onClick={() => { setDraft({ ...draft, company_id: h.id, company_name: h.title }); setQuery(""); setHits([]); }}>{h.title}</button></li>)}
                    </ul>
                  )}
                </div>
              )}
            </div>
            {(["full_name", "role", "email", "phone"] as const).map((k) => (
              <div key={k} className="grid gap-1.5">
                <Label htmlFor={`ct-${k}`} className="text-xs">{{ full_name: "Full name *", role: "Role", email: "Email", phone: "Phone" }[k]}</Label>
                <Input id={`ct-${k}`} value={draft?.[k] ?? ""} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} />
              </div>
            ))}
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={Boolean(draft?.is_primary)} onCheckedChange={(v) => setDraft({ ...draft, is_primary: v === true })} /> Primary contact for the company</label>
          </div>
          <DialogFooter><Button onClick={save} disabled={pending || !draft?.full_name?.trim()}>{pending && <Loader2 className="animate-spin" />} Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
