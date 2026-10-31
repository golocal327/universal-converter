"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Copy, FileText, Loader2, MessageCircle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { deleteTemplate, duplicateTemplate, saveTemplate, type TemplateInput } from "@/lib/actions/templates";
import { EMAIL_VARIANT_LABELS, EMAIL_VARIANTS, TEMPLATE_CATEGORIES, TEMPLATE_CATEGORY_LABELS, type TemplateCategory } from "@/lib/domain/constants";
import { renderTemplate, TEMPLATE_VARIABLES, unknownVariables } from "@/lib/templates/render";
import { cn } from "@/lib/utils";

export type TemplateRow = { id: string; name: string; category: TemplateCategory; channel: "email" | "whatsapp" | "call" | "linkedin" | "sms"; variant: string | null; sector_id: string | null; subject: string | null; body: string };

export function TemplateManager({ templates, sectors, sample }: { templates: TemplateRow[]; sectors: { id: string; name: string }[]; sample: { company: string; values: Record<string, string> } | null }) {
  const router = useRouter();
  const params = useSearchParams();
  const [category, setCategory] = useState<TemplateCategory | "all">("all");
  const [editing, setEditing] = useState<TemplateInput | null>(() => {
    const t = templates.find((x) => x.id === params.get("template"));
    return t ? { ...t, variant: t.variant as TemplateInput["variant"] } : null;
  });
  const [pending, startTransition] = useTransition();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const visible = templates.filter((t) => category === "all" || t.category === category);

  const insertVariable = (key: string) => {
    if (!editing) return;
    const el = bodyRef.current;
    const token = `{{${key}}}`;
    const start = el?.selectionStart ?? editing.body.length;
    const end = el?.selectionEnd ?? editing.body.length;
    setEditing({ ...editing, body: editing.body.slice(0, start) + token + editing.body.slice(end) });
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + token.length, start + token.length); });
  };

  const save = () =>
    startTransition(async () => {
      if (!editing) return;
      const r = await saveTemplate(editing);
      if (!r.ok) { toast.error(Object.values(r.fieldErrors ?? {})[0]?.[0] ?? r.error); return; }
      toast.success(r.data.unknown.length ? `Saved — unknown variables: ${r.data.unknown.join(", ")}` : "Template saved");
      setEditing(null);
      router.refresh();
    });

  const unknown = editing ? unknownVariables(`${editing.subject ?? ""} ${editing.body}`) : [];
  const preview = editing && sample ? { subject: editing.subject ? renderTemplate(editing.subject, sample.values).output : null, body: renderTemplate(editing.body, sample.values).output } : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {(["all", ...TEMPLATE_CATEGORIES] as const).map((c) => (
            <button key={c} type="button" onClick={() => setCategory(c)} className={cn("h-7 rounded-md border px-2.5 text-xs font-medium", category === c ? "border-foreground bg-foreground text-background" : "hover:bg-muted")}>
              {c === "all" ? "All" : TEMPLATE_CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => setEditing({ name: "", category: "cold_outreach", channel: "email", variant: "direct", sector_id: null, subject: "", body: "" })}><Plus /> New template</Button>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={FileText} title="No templates in this category" />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((t) => (
            <li key={t.id} className="group flex flex-col rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <button type="button" className="min-w-0 text-left" onClick={() => setEditing({ ...t, variant: t.variant as TemplateInput["variant"] })}>
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium">{t.channel === "whatsapp" ? <MessageCircle className="size-3.5 text-muted-foreground" /> : <FileText className="size-3.5 text-muted-foreground" />}{t.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{TEMPLATE_CATEGORY_LABELS[t.category]}{t.variant ? ` · ${EMAIL_VARIANT_LABELS[t.variant as keyof typeof EMAIL_VARIANT_LABELS] ?? t.variant}` : ""}{t.sector_id ? ` · ${sectors.find((s) => s.id === t.sector_id)?.name ?? ""}` : ""}</p>
                </button>
                <div className="flex opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <Button size="icon-xs" variant="ghost" aria-label="Duplicate" onClick={() => startTransition(async () => { const r = await duplicateTemplate(t.id); if (r.ok) { toast.success("Duplicated"); router.refresh(); } else toast.error(r.error); })}><Copy /></Button>
                  <Button size="icon-xs" variant="ghost" aria-label="Delete" onClick={() => { if (window.confirm(`Delete “${t.name}”?`)) startTransition(async () => { const r = await deleteTemplate(t.id); if (r.ok) router.refresh(); else toast.error(r.error); }); }}><Trash2 /></Button>
                </div>
              </div>
              {t.subject && <p className="mt-3 truncate text-xs font-medium">{t.subject}</p>}
              <p className="mt-1 line-clamp-4 whitespace-pre-line text-xs text-muted-foreground">{t.body}</p>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit template" : "New template"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="grid content-start gap-3">
                <div className="grid gap-1.5"><Label htmlFor="tp-name" className="text-xs">Name</Label><Input id="tp-name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5"><Label className="text-xs">Category</Label>
                    <Select value={editing.category} onValueChange={(v) => setEditing({ ...editing, category: v as TemplateCategory })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>{TEMPLATE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{TEMPLATE_CATEGORY_LABELS[c]}</SelectItem>)}</SelectContent></Select></div>
                  <div className="grid gap-1.5"><Label className="text-xs">Channel</Label>
                    <Select value={editing.channel} onValueChange={(v) => setEditing({ ...editing, channel: v as TemplateInput["channel"] })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="email">Email</SelectItem><SelectItem value="whatsapp">WhatsApp</SelectItem><SelectItem value="linkedin">LinkedIn</SelectItem></SelectContent></Select></div>
                  <div className="grid gap-1.5"><Label className="text-xs">Variant</Label>
                    <Select value={editing.variant ?? "none"} onValueChange={(v) => setEditing({ ...editing, variant: v === "none" ? null : (v as TemplateInput["variant"]) })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="none">None</SelectItem>{EMAIL_VARIANTS.map((v) => <SelectItem key={v} value={v}>{EMAIL_VARIANT_LABELS[v]}</SelectItem>)}</SelectContent></Select></div>
                  <div className="grid gap-1.5"><Label className="text-xs">Sector</Label>
                    <Select value={editing.sector_id ?? "none"} onValueChange={(v) => setEditing({ ...editing, sector_id: v === "none" ? null : v })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="none">All sectors</SelectItem>{sectors.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
                </div>
                {editing.channel === "email" && <div className="grid gap-1.5"><Label htmlFor="tp-subject" className="text-xs">Subject</Label><Input id="tp-subject" value={editing.subject ?? ""} onChange={(e) => setEditing({ ...editing, subject: e.target.value })} /></div>}
                <div className="grid gap-1.5">
                  <Label htmlFor="tp-body" className="text-xs">Body</Label>
                  <Textarea id="tp-body" ref={bodyRef} rows={12} value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} className="font-mono text-xs leading-relaxed" />
                  <div className="flex flex-wrap gap-1">
                    {TEMPLATE_VARIABLES.map((v) => (
                      <button key={v.key} type="button" onClick={() => insertVariable(v.key)} title={v.label} className="rounded border bg-muted/50 px-1.5 py-0.5 font-mono text-[11px] hover:bg-muted">{`{{${v.key}}}`}</button>
                    ))}
                  </div>
                  {unknown.length > 0 && <p className="text-xs text-destructive">Unknown variables: {unknown.join(", ")}</p>}
                </div>
              </div>
              <div className="rounded-xl border bg-muted/30 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Preview{sample ? ` · ${sample.company}` : ""}</p>
                {preview ? (
                  <div className="mt-3 text-sm">
                    {preview.subject && <p className="font-medium">{preview.subject}</p>}
                    <p className="mt-2 whitespace-pre-line leading-relaxed">{preview.body}</p>
                  </div>
                ) : <p className="mt-3 text-sm text-muted-foreground">Add a lead to preview templates with real data.</p>}
              </div>
            </div>
          )}
          <DialogFooter><Button onClick={save} disabled={pending || !editing?.name.trim() || !editing?.body.trim()}>{pending && <Loader2 className="animate-spin" />} Save template</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
