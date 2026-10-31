"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { addNote, recordOutreachAction } from "@/lib/actions/company";

const KINDS = [
  { value: "note", label: "Note" },
  { value: "call_logged", label: "Call made" },
  { value: "reply_received", label: "Reply received" },
  { value: "meeting_scheduled", label: "Meeting scheduled" },
  { value: "meeting_completed", label: "Meeting completed" },
] as const;

/** Log a note or interaction; interactions update contact status and advance the deal. */
export function LogInteraction({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [kind, setKind] = useState<(typeof KINDS)[number]["value"]>("note");
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const submit = () =>
    startTransition(async () => {
      const r = kind === "note" ? await addNote({ companyId, body }) : await recordOutreachAction({ companyId, kind, body: body || null, generatedBy: "manual" });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(kind === "note" ? "Note added" : "Interaction logged — pipeline updated");
      setBody("");
      router.refresh();
    });
  return (
    <div className="rounded-xl border p-3">
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder={kind === "note" ? "Write a note…" : "Details (optional)…"} className="resize-none border-0 p-1 shadow-none focus-visible:ring-0" />
      <div className="mt-2 flex items-center justify-between gap-2">
        <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
          <SelectTrigger size="sm" className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>{KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}</SelectContent>
        </Select>
        <Button size="sm" onClick={submit} disabled={pending || (kind === "note" && !body.trim())}>{pending && <Loader2 className="animate-spin" />} Log</Button>
      </div>
    </div>
  );
}
