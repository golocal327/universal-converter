"use client";
import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { deletePricingRule, savePricingRule, saveService, type PricingRuleInput } from "@/lib/actions/settings";
import { SERVICE_CATEGORIES, type ServiceCategory } from "@/lib/domain/constants";
import { formatCurrency } from "@/lib/format";
import { useAction } from "./use-action";

export type ServiceRow = { id: string; name: string; category: ServiceCategory; description: string | null; setup_price: number; monthly_price: number; is_active: boolean };
export type RuleRow = PricingRuleInput & { id: string };

const OPTIONS = {
  business_potential: ["high", "medium", "low"],
  website_quality: ["none", "low", "medium", "high"],
  sector_tier: ["high", "medium", "low"],
} as const;
const LABELS = { business_potential: "Business potential", website_quality: "Website quality", sector_tier: "Sector value" };

export function PricingPanel({ services, rules, disabled }: { services: ServiceRow[]; rules: RuleRow[]; disabled: boolean }) {
  const [svc, setSvc] = useState<Partial<ServiceRow> | null>(null);
  const [rule, setRule] = useState<PricingRuleInput | null>(null);
  const { pending, run } = useAction();
  const conditionText = (r: RuleRow) => (Object.keys(OPTIONS) as (keyof typeof OPTIONS)[]).map((k) => (r.conditions[k]?.length ? `${LABELS[k]}: ${r.conditions[k]?.join("/")}` : null)).filter(Boolean).join(" · ") || "Any lead";

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div><h3 className="text-sm font-semibold">Pricing rules</h3><p className="text-xs text-muted-foreground">Evaluated by priority (lowest first); the first match sets the package. Extras come from the service catalog based on detected opportunities.</p></div>
          <Button size="sm" disabled={disabled} onClick={() => setRule({ name: "", priority: (rules.at(-1)?.priority ?? 0) as number + 10, conditions: {}, package_name: "", service_id: null, setup_price: 1000, monthly_price: 90, is_active: true })}><Plus /> New rule</Button>
        </div>
        <ul className="divide-y rounded-xl border">
          {rules.map((r) => (
            <li key={r.id}>
              <button type="button" disabled={disabled} onClick={() => setRule(r)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40 disabled:hover:bg-transparent">
                <span className="min-w-0"><span className="block text-sm font-medium">{r.priority}. {r.package_name} {!r.is_active && <span className="text-xs text-muted-foreground">(inactive)</span>}</span><span className="block truncate text-xs text-muted-foreground">{conditionText(r)}</span></span>
                <span className="tabular shrink-0 text-sm font-medium">{formatCurrency(Number(r.setup_price))} + {formatCurrency(Number(r.monthly_price))}/mo</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div><h3 className="text-sm font-semibold">Service catalog</h3><p className="text-xs text-muted-foreground">Prices used for extras and proposals.</p></div>
          <Button size="sm" disabled={disabled} onClick={() => setSvc({ name: "", category: "other", setup_price: 0, monthly_price: 0, is_active: true })}><Plus /> New service</Button>
        </div>
        <ul className="divide-y rounded-xl border">
          {services.map((s) => (
            <li key={s.id}>
              <button type="button" disabled={disabled} onClick={() => setSvc(s)} className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-muted/40 disabled:hover:bg-transparent">
                <span className="min-w-0"><span className="block text-sm">{s.name} {!s.is_active && <span className="text-xs text-muted-foreground">(inactive)</span>}</span><span className="block truncate text-xs text-muted-foreground">{s.description}</span></span>
                <span className="tabular shrink-0 text-sm">{formatCurrency(Number(s.setup_price))}{Number(s.monthly_price) ? ` + ${formatCurrency(Number(s.monthly_price))}/mo` : ""}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <Dialog open={Boolean(rule)} onOpenChange={(o) => !o && setRule(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>{rule?.id ? "Edit pricing rule" : "New pricing rule"}</DialogTitle></DialogHeader>
          {rule && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5"><Label className="text-xs" htmlFor="pr-name">Rule name</Label><Input id="pr-name" value={rule.name} onChange={(e) => setRule({ ...rule, name: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label className="text-xs" htmlFor="pr-priority">Priority</Label><Input id="pr-priority" type="number" value={rule.priority as number} onChange={(e) => setRule({ ...rule, priority: Number(e.target.value) })} /></div>
              {(Object.keys(OPTIONS) as (keyof typeof OPTIONS)[]).map((k) => (
                <fieldset key={k} className="sm:col-span-2">
                  <legend className="mb-1.5 text-xs font-medium">{LABELS[k]} <span className="font-normal text-muted-foreground">(none = any)</span></legend>
                  <div className="flex flex-wrap gap-3">
                    {OPTIONS[k].map((o) => {
                      const current = (rule.conditions[k] ?? []) as string[];
                      return (
                        <label key={o} className="flex items-center gap-1.5 text-sm capitalize">
                          <Checkbox checked={current.includes(o)} onCheckedChange={(v) => setRule({ ...rule, conditions: { ...rule.conditions, [k]: v ? [...current, o] : current.filter((x) => x !== o) } })} />{o}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
              <div className="grid gap-1.5 sm:col-span-2"><Label className="text-xs" htmlFor="pr-pkg">Package name</Label><Input id="pr-pkg" value={rule.package_name} onChange={(e) => setRule({ ...rule, package_name: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label className="text-xs">Primary service</Label>
                <Select value={rule.service_id ?? "none"} onValueChange={(v) => setRule({ ...rule, service_id: v === "none" ? null : v })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">None</SelectItem>{services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
              <label className="flex items-center gap-2 self-end text-sm"><Switch checked={rule.is_active} onCheckedChange={(v) => setRule({ ...rule, is_active: v })} /> Active</label>
              <div className="grid gap-1.5"><Label className="text-xs" htmlFor="pr-setup">Setup (€)</Label><Input id="pr-setup" type="number" min={0} value={rule.setup_price as number} onChange={(e) => setRule({ ...rule, setup_price: Number(e.target.value) })} /></div>
              <div className="grid gap-1.5"><Label className="text-xs" htmlFor="pr-monthly">Monthly (€)</Label><Input id="pr-monthly" type="number" min={0} value={rule.monthly_price as number} onChange={(e) => setRule({ ...rule, monthly_price: Number(e.target.value) })} /></div>
            </div>
          )}
          <DialogFooter>
            {rule?.id && <Button variant="ghost" className="mr-auto" onClick={() => run(() => deletePricingRule(rule.id as string), "Rule deleted", () => setRule(null))}><Trash2 /> Delete</Button>}
            <Button disabled={pending || !rule?.name.trim() || !rule?.package_name.trim()} onClick={() => rule && run(() => savePricingRule(rule), "Pricing rule saved", () => setRule(null))}>{pending && <Loader2 className="animate-spin" />} Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(svc)} onOpenChange={(o) => !o && setSvc(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{svc?.id ? "Edit service" : "New service"}</DialogTitle></DialogHeader>
          {svc && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5 sm:col-span-2"><Label className="text-xs" htmlFor="sv-name">Name</Label><Input id="sv-name" value={svc.name ?? ""} onChange={(e) => setSvc({ ...svc, name: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label className="text-xs">Category</Label>
                <Select value={svc.category ?? "other"} onValueChange={(v) => setSvc({ ...svc, category: v as ServiceCategory })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{SERVICE_CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent></Select></div>
              <label className="flex items-center gap-2 self-end text-sm"><Switch checked={svc.is_active ?? true} onCheckedChange={(v) => setSvc({ ...svc, is_active: v })} /> Active</label>
              <div className="grid gap-1.5"><Label className="text-xs" htmlFor="sv-setup">Setup (€)</Label><Input id="sv-setup" type="number" min={0} value={svc.setup_price ?? 0} onChange={(e) => setSvc({ ...svc, setup_price: Number(e.target.value) })} /></div>
              <div className="grid gap-1.5"><Label className="text-xs" htmlFor="sv-monthly">Monthly (€)</Label><Input id="sv-monthly" type="number" min={0} value={svc.monthly_price ?? 0} onChange={(e) => setSvc({ ...svc, monthly_price: Number(e.target.value) })} /></div>
              <div className="grid gap-1.5 sm:col-span-2"><Label className="text-xs" htmlFor="sv-desc">Description</Label><Input id="sv-desc" value={svc.description ?? ""} onChange={(e) => setSvc({ ...svc, description: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter><Button disabled={pending || !svc?.name?.trim()} onClick={() => svc && run(() => saveService({ id: svc.id, name: svc.name ?? "", category: svc.category ?? "other", description: svc.description ?? null, setup_price: svc.setup_price ?? 0, monthly_price: svc.monthly_price ?? 0, is_active: svc.is_active ?? true }), "Service saved", () => setSvc(null))}>{pending && <Loader2 className="animate-spin" />} Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
