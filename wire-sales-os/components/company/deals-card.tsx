"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { StageBadge } from "@/components/app/badges";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createDealForCompany, moveDeal, updateDeal } from "@/lib/actions/pipeline";
import { formatCurrency, formatDate } from "@/lib/format";

export type DealRow = {
  id: string; title: string; stage_id: string; stage_key: string; stage_name: string; status: string; setup_value: number; monthly_value: number;
  value: number; probability: number | null; weighted_value: number; expected_close_date: string | null; next_action: string | null; service_name: string | null;
};
type Stage = { id: string; key: string; name: string };

export function DealsCard({ companyId, deals, stages }: { companyId: string; deals: DealRow[]; stages: Stage[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [edit, setEdit] = useState<DealRow | null>(null);

  const changeStage = (deal: DealRow, stageId: string) =>
    startTransition(async () => {
      const r = await moveDeal({ dealId: deal.id, stageId });
      if (r.ok) { toast.success("Stage updated"); router.refresh(); } else toast.error(r.error);
    });

  return (
    <div>
      {deals.length === 0 ? (
        <div className="flex items-center justify-between gap-3 py-2">
          <p className="text-sm text-muted-foreground">No deals yet.</p>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => startTransition(async () => { const r = await createDealForCompany(companyId); if (r.ok) router.refresh(); else toast.error(r.error); })}>
            {pending ? <Loader2 className="animate-spin" /> : <Plus />} Create deal
          </Button>
        </div>
      ) : (
        <ul className="divide-y">
          {deals.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <button type="button" onClick={() => setEdit(d)} className="text-left text-sm font-medium hover:underline">{d.title}</button>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(d.setup_value)} setup + {formatCurrency(d.monthly_value)}/mo · {d.probability ?? 0}% · weighted {formatCurrency(d.weighted_value)}
                  {d.expected_close_date ? ` · close ${formatDate(d.expected_close_date)}` : ""}
                </p>
                {d.next_action && <p className="text-xs">Next: {d.next_action}</p>}
              </div>
              <Select value={d.stage_id} onValueChange={(v) => changeStage(d, v)}>
                <SelectTrigger size="sm" className="w-40" aria-label="Stage"><SelectValue><StageBadge stageKey={d.stage_key} name={d.stage_name} className="border-0 px-0" /></SelectValue></SelectTrigger>
                <SelectContent>{stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </li>
          ))}
        </ul>
      )}
      {edit && <DealEditDialog deal={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

export function DealEditDialog({ deal, onClose }: { deal: Pick<DealRow, "id" | "title" | "setup_value" | "monthly_value" | "probability" | "expected_close_date" | "next_action">; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [v, setV] = useState({
    title: deal.title, setup_value: String(deal.setup_value), monthly_value: String(deal.monthly_value), probability: deal.probability === null ? "" : String(deal.probability),
    expected_close_date: deal.expected_close_date ?? "", next_action: deal.next_action ?? "",
  });
  const save = () =>
    startTransition(async () => {
      const r = await updateDeal({
        dealId: deal.id, title: v.title, setup_value: Number(v.setup_value || 0), monthly_value: Number(v.monthly_value || 0),
        probability: v.probability === "" ? null : Number(v.probability), expected_close_date: v.expected_close_date || null, next_action: v.next_action || null,
      });
      if (r.ok) { toast.success("Deal updated"); onClose(); router.refresh(); } else toast.error(r.error);
    });
  const f = (key: keyof typeof v, label: string, type = "text") => (
    <div className="grid gap-1.5">
      <Label htmlFor={`d-${key}`} className="text-xs">{label}</Label>
      <Input id={`d-${key}`} type={type} value={v[key]} onChange={(e) => setV({ ...v, [key]: e.target.value })} />
    </div>
  );
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit deal</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">{f("title", "Title")}</div>
          {f("setup_value", "Setup (€)", "number")}
          {f("monthly_value", "Monthly (€)", "number")}
          {f("probability", "Probability (%)", "number")}
          {f("expected_close_date", "Expected close", "date")}
          <div className="sm:col-span-2">{f("next_action", "Next action")}</div>
        </div>
        <DialogFooter><Button onClick={save} disabled={pending}>{pending && <Loader2 className="animate-spin" />} Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
