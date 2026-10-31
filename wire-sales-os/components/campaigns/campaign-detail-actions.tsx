"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2, Trash2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { addMatchingLeads, deleteCampaign, removeLeadFromCampaign } from "@/lib/actions/campaigns";

export function AddMatchingLeadsButton({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button size="sm" variant="outline" disabled={pending} onClick={() => startTransition(async () => {
      const r = await addMatchingLeads(campaignId);
      if (r.ok) { toast.success(r.data.added ? `Added ${r.data.added} matching lead(s)` : "No new matching leads"); router.refresh(); } else toast.error(r.error);
    })}>
      {pending ? <Loader2 className="animate-spin" /> : <UserPlus />} Add matching leads
    </Button>
  );
}

export function DeleteCampaignButton({ campaignId }: { campaignId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button size="sm" variant="ghost" disabled={pending} aria-label="Delete campaign" onClick={() => {
      if (!window.confirm("Delete this campaign? Leads stay in the CRM.")) return;
      startTransition(async () => { const r = await deleteCampaign(campaignId); if (r && !r.ok) toast.error(r.error); });
    }}><Trash2 /></Button>
  );
}

export function RemoveFromCampaign({ campaignId, leadId }: { campaignId: string; leadId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button size="icon-xs" variant="ghost" aria-label="Remove from campaign" disabled={pending} onClick={() => startTransition(async () => { const r = await removeLeadFromCampaign(campaignId, leadId); if (r.ok) router.refresh(); else toast.error(r.error); })}>
      <X />
    </Button>
  );
}
