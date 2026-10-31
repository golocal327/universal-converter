"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ArrowLeft, Check, Loader2, Printer, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setProposalStatus } from "@/lib/actions/company";

export function ProposalToolbar({ proposalId, companyId, status }: { proposalId: string; companyId: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const set = (s: "sent" | "accepted" | "rejected") =>
    startTransition(async () => {
      const r = await setProposalStatus({ proposalId, status: s });
      if (r.ok) { toast.success(s === "sent" ? "Marked as sent · deal moved to Proposal" : `Marked as ${s}`); router.refresh(); } else toast.error(r.error);
    });
  return (
    <div className="no-print sticky top-14 z-20 flex flex-wrap items-center gap-2 border-b bg-background/90 px-4 py-2.5 backdrop-blur sm:px-6">
      <Button size="sm" variant="ghost" asChild><Link href={`/companies/${companyId}?tab=documents`}><ArrowLeft /> Back</Link></Button>
      <span className="text-xs text-muted-foreground capitalize">Status: {status}</span>
      <div className="ml-auto flex flex-wrap gap-2">
        {pending && <Loader2 className="size-4 animate-spin self-center" />}
        {status === "draft" && <Button size="sm" variant="outline" onClick={() => set("sent")}><Send /> Mark as sent</Button>}
        {status === "sent" && <><Button size="sm" variant="outline" onClick={() => set("accepted")}><Check /> Accepted</Button><Button size="sm" variant="ghost" onClick={() => set("rejected")}><X /> Rejected</Button></>}
        <Button size="sm" onClick={() => window.print()}><Printer /> Print / Save as PDF</Button>
      </div>
    </div>
  );
}
