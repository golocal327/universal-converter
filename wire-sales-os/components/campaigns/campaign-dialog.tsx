"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { saveCampaign, type CampaignInput } from "@/lib/actions/campaigns";
import { CAMPAIGN_STATUSES, WEBSITE_REQUIREMENT_LABELS, WEBSITE_REQUIREMENTS } from "@/lib/domain/constants";

type Option = { id: string; name: string };
const EMPTY: CampaignInput = { name: "", description: null, target_sector_id: null, target_location: "", website_requirement: "missing_or_weak", channel: "email", status: "draft", template_id: null };

export function CampaignDialog({ sectors, templates, initial, trigger }: { sectors: Option[]; templates: Option[]; initial?: CampaignInput; trigger?: "edit" | "new" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [c, setC] = useState<CampaignInput>(initial ?? EMPTY);
  const [pending, startTransition] = useTransition();
  const sel = (key: keyof CampaignInput, options: { value: string; label: string }[], none?: string) => (
    <Select value={(c[key] as string | null) ?? "none"} onValueChange={(v) => setC({ ...c, [key]: v === "none" ? null : v })}>
      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
      <SelectContent>
        {none && <SelectItem value="none">{none}</SelectItem>}
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
  const save = () =>
    startTransition(async () => {
      const r = await saveCampaign(c);
      if (!r.ok) { toast.error(Object.values(r.fieldErrors ?? {})[0]?.[0] ?? r.error); return; }
      toast.success("Campaign saved");
      setOpen(false);
      if (!initial) router.push(`/campaigns/${r.data.id}`); else router.refresh();
    });
  return (
    <>
      <Button size="sm" variant={trigger === "edit" ? "outline" : "default"} onClick={() => setOpen(true)}>{trigger === "edit" ? "Edit" : <><Plus /> New campaign</>}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{initial ? "Edit campaign" : "New campaign"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5 sm:col-span-2"><Label htmlFor="cp-name" className="text-xs">Name</Label><Input id="cp-name" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} placeholder="Autoescuelas Cádiz" /></div>
            <div className="grid gap-1.5"><Label className="text-xs">Target sector</Label>{sel("target_sector_id", sectors.map((s) => ({ value: s.id, label: s.name })), "Any sector")}</div>
            <div className="grid gap-1.5"><Label htmlFor="cp-loc" className="text-xs">Location</Label><Input id="cp-loc" value={c.target_location ?? ""} onChange={(e) => setC({ ...c, target_location: e.target.value })} placeholder="Cádiz" /></div>
            <div className="grid gap-1.5"><Label className="text-xs">Website</Label>{sel("website_requirement", WEBSITE_REQUIREMENTS.map((w) => ({ value: w, label: WEBSITE_REQUIREMENT_LABELS[w] })))}</div>
            <div className="grid gap-1.5"><Label className="text-xs">Channel</Label>{sel("channel", [{ value: "email", label: "Email" }, { value: "whatsapp", label: "WhatsApp" }, { value: "call", label: "Phone" }, { value: "linkedin", label: "LinkedIn" }])}</div>
            <div className="grid gap-1.5"><Label className="text-xs">Status</Label>{sel("status", CAMPAIGN_STATUSES.map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) })))}</div>
            <div className="grid gap-1.5"><Label className="text-xs">Template</Label>{sel("template_id", templates.map((t) => ({ value: t.id, label: t.name })), "No template")}</div>
            <div className="grid gap-1.5 sm:col-span-2"><Label htmlFor="cp-desc" className="text-xs">Notes</Label><Textarea id="cp-desc" rows={2} value={c.description ?? ""} onChange={(e) => setC({ ...c, description: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={save} disabled={pending || !c.name.trim()}>{pending && <Loader2 className="animate-spin" />} Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
