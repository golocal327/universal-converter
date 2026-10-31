"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Mail, Pencil, Phone, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteContact, saveContact } from "@/lib/actions/company";

export type ContactRow = { id: string; full_name: string; role: string | null; email: string | null; phone: string | null; whatsapp: string | null; linkedin_url: string | null; is_primary: boolean };

export function ContactsCard({ companyId, contacts }: { companyId: string; contacts: ContactRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Partial<ContactRow> | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      if (!editing) return;
      const r = await saveContact({
        id: editing.id, companyId, full_name: editing.full_name ?? "", role: editing.role ?? null, email: editing.email ?? null,
        phone: editing.phone ?? null, whatsapp: editing.whatsapp ?? null, linkedin_url: editing.linkedin_url ?? null, is_primary: Boolean(editing.is_primary),
      });
      if (!r.ok) {
        toast.error(Object.values(r.fieldErrors ?? {})[0]?.[0] ?? r.error);
        return;
      }
      toast.success("Contact saved");
      setEditing(null);
      router.refresh();
    });

  const field = (key: keyof ContactRow, label: string, type = "text") => (
    <div className="grid gap-1.5">
      <Label htmlFor={`c-${key}`} className="text-xs">{label}</Label>
      <Input id={`c-${key}`} type={type} value={(editing?.[key] as string | undefined) ?? ""} onChange={(e) => setEditing({ ...editing, [key]: e.target.value })} />
    </div>
  );

  return (
    <div>
      <ul className="divide-y">
        {contacts.map((c) => (
          <li key={c.id} className="group flex items-start justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                {c.full_name} {c.is_primary && <Star className="size-3 fill-current text-warm" aria-label="Primary contact" />}
              </p>
              {c.role && <p className="text-xs text-muted-foreground">{c.role}</p>}
              <div className="mt-1 flex flex-wrap gap-x-3 text-xs">
                {c.email && <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"><Mail className="size-3" />{c.email}</a>}
                {c.phone && <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"><Phone className="size-3" />{c.phone}</a>}
              </div>
            </div>
            <div className="flex opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              <Button size="icon-xs" variant="ghost" aria-label={`Edit ${c.full_name}`} onClick={() => setEditing(c)}><Pencil /></Button>
              <Button size="icon-xs" variant="ghost" aria-label={`Delete ${c.full_name}`} onClick={() => startTransition(async () => { const r = await deleteContact(c.id); if (r.ok) { toast.success("Contact deleted"); router.refresh(); } else toast.error(r.error); })}><Trash2 /></Button>
            </div>
          </li>
        ))}
      </ul>
      {contacts.length === 0 && <p className="py-2 text-sm text-muted-foreground">No contacts yet.</p>}
      <Button size="sm" variant="ghost" className="mt-1 -ml-2" onClick={() => setEditing({ is_primary: contacts.length === 0 })}><Plus /> Add contact</Button>

      <Dialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Edit contact" : "New contact"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {field("full_name", "Full name *")}
            {field("role", "Role")}
            {field("email", "Email", "email")}
            {field("phone", "Phone", "tel")}
            {field("whatsapp", "WhatsApp", "tel")}
            {field("linkedin_url", "LinkedIn")}
          </div>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={Boolean(editing?.is_primary)} onCheckedChange={(v) => setEditing({ ...editing, is_primary: v === true })} /> Primary contact</label>
          <DialogFooter>
            <Button onClick={save} disabled={pending || !editing?.full_name?.trim()}>{pending && <Loader2 className="animate-spin" />} Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
