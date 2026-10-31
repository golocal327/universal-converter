"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { updateLead } from "@/lib/actions/leads";

export function LeadNotes({ leadId, initial }: { leadId: string; initial: string | null }) {
  const [value, setValue] = useState(initial ?? "");
  const [saved, setSaved] = useState(initial ?? "");
  const [pending, startTransition] = useTransition();
  return (
    <div>
      <Textarea value={value} onChange={(e) => setValue(e.target.value)} rows={4} placeholder="Context, decision makers, budget hints…" aria-label="Lead notes"
        onBlur={() => value !== saved && startTransition(async () => { const r = await updateLead({ leadId, notes: value || null }); if (r.ok) setSaved(value); else toast.error(r.error); })} />
      <p className="mt-1 text-[11px] text-muted-foreground">{pending ? "Saving…" : value === saved ? "Saved" : "Unsaved — click outside to save"}</p>
    </div>
  );
}
