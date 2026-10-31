"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronDown, FileText, Gauge, Kanban, Loader2, MoreHorizontal, Pencil, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { auditWebsite, deleteCompany, generateProposal } from "@/lib/actions/company";
import { qualifyLead, rescoreCompany } from "@/lib/actions/leads";
import { EditCompanySheet, type EditableCompany } from "./edit-company-sheet";

export function CompanyActions({ company, leadId, hasOpenDeal, aiConfigured, isAdmin, sectors }: {
  company: EditableCompany; leadId: string | null; hasOpenDeal: boolean; aiConfigured: boolean; isAdmin: boolean; sectors: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const run = (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    startTransition(async () => {
      await fn();
      setBusy(null);
    });
  };

  const audit = () => run("audit", async () => {
    const r = await auditWebsite(company.id);
    if (r.ok) toast.success(r.data.status === "completed" ? `Website audited — ${r.data.score}/100` : "Audit finished: website unreachable");
    else toast.error(r.error);
    router.refresh();
  });
  const qualify = () => run("qualify", async () => {
    if (!leadId) return;
    const r = await qualifyLead(leadId);
    if (r.ok) toast.success("Added to the pipeline with the recommended package");
    else toast.error(r.error);
    router.refresh();
  });
  const rescore = () => run("rescore", async () => {
    const r = await rescoreCompany(company.id);
    if (r.ok) toast.success(`Lead score: ${r.data.score}/100`);
    else toast.error(r.error);
    router.refresh();
  });
  const proposal = (useAI: boolean) => run("proposal", async () => {
    const r = await generateProposal({ companyId: company.id, useAI });
    if (r.ok) { toast.success("Proposal generated"); router.push(`/proposals/${r.data.proposalId}`); }
    else toast.error(r.error);
  });

  const spinner = (key: string) => (busy === key && pending ? <Loader2 className="animate-spin" /> : null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" onClick={audit} disabled={pending || !company.website} title={company.website ? undefined : "Add a website first"}>
        {spinner("audit") ?? <Gauge />} Audit website
      </Button>
      {!hasOpenDeal && leadId && (
        <Button size="sm" variant="outline" onClick={qualify} disabled={pending}>{spinner("qualify") ?? <Kanban />} Add to pipeline</Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" disabled={pending}>{spinner("proposal") ?? <FileText />} Generate proposal <ChevronDown /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => proposal(false)}><FileText /> From lead data (rules engine)</DropdownMenuItem>
          <DropdownMenuItem disabled={!aiConfigured} onSelect={() => proposal(true)}><Sparkles /> Written by AI{aiConfigured ? "" : " — not configured"}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon-sm" variant="ghost" aria-label="More actions"><MoreHorizontal /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}><Pencil /> Edit company</DropdownMenuItem>
          <DropdownMenuItem onSelect={rescore} disabled={!leadId}><RefreshCw /> Recalculate score</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => router.push(`/copilot?company=${company.id}`)}><Sparkles /> Open in AI Copilot</DropdownMenuItem>
          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}><Trash2 /> Delete company</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <EditCompanySheet open={editOpen} onOpenChange={setEditOpen} company={company} sectors={sectors} />
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {company.name}?</AlertDialogTitle>
            <AlertDialogDescription>The lead, contacts, deals, tasks, proposals and the whole timeline will be deleted. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => startTransition(async () => { const r = await deleteCompany(company.id); if (r && !r.ok) toast.error(r.error); })}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
