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
import { Textarea } from "@/components/ui/textarea";
import { deleteSector, saveSector, type SectorInput } from "@/lib/actions/settings";
import { VALUE_TIERS } from "@/lib/domain/constants";
import { formatCurrency } from "@/lib/format";
import { useAction } from "./use-action";

export type SectorRow = SectorInput & { id: string; templates: number; leads: number };
type Service = { id: string; name: string };

const lines = (v: string) => v.split("\n").map((s) => s.trim()).filter(Boolean);

export function SectorsPanel({ sectors, services, disabled }: { sectors: SectorRow[]; services: Service[]; disabled: boolean }) {
  const [edit, setEdit] = useState<SectorInput | null>(null);
  const [text, setText] = useState({ problems: "", arguments: "", keywords: "" });
  const { pending, run } = useAction();
  const open = (s: SectorInput) => {
    setEdit(s);
    setText({ problems: s.common_problems.join("\n"), arguments: s.sales_arguments.join("\n"), keywords: s.keywords.join(", ") });
  };
  const blank: SectorInput = { name: "", value_tier: "medium", avg_ticket: null, booking_relevant: false, whatsapp_relevant: true, score_weights: { website: 1, google: 1, social: 1, business: 1 }, setup_price_min: null, setup_price_max: null, monthly_price: null, common_problems: [], sales_arguments: [], keywords: [], service_ids: [] };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">Each sector tunes the lead score (weights), the pricing fallback, the problems the generators mention and the sales arguments they use.</p>
        <Button size="sm" disabled={disabled} onClick={() => open(blank)}><Plus /> New sector</Button>
      </div>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/30 text-xs text-muted-foreground"><tr><th className="px-4 py-2 text-left font-medium">Sector</th><th className="px-3 py-2 text-left font-medium">Value</th><th className="px-3 py-2 text-left font-medium">Booking</th><th className="px-3 py-2 text-left font-medium">Pricing</th><th className="px-3 py-2 text-left font-medium">Weights W/G/S/B</th><th className="px-3 py-2 text-right font-medium">Leads</th></tr></thead>
          <tbody>
            {sectors.map((s) => (
              <tr key={s.id} className="border-t hover:bg-muted/40">
                <td className="px-4 py-2.5"><button type="button" className="font-medium hover:underline disabled:no-underline" disabled={disabled} onClick={() => open(s)}>{s.name}</button><span className="block text-xs text-muted-foreground">{s.sales_arguments.length} arguments · {s.common_problems.length} problems · {s.service_ids.length} services · {s.templates} templates</span></td>
                <td className="px-3 py-2.5 capitalize">{s.value_tier}</td>
                <td className="px-3 py-2.5">{s.booking_relevant ? "Relevant" : "—"}</td>
                <td className="tabular px-3 py-2.5 text-xs">{s.setup_price_min ? `${formatCurrency(Number(s.setup_price_min))}–${formatCurrency(Number(s.setup_price_max ?? s.setup_price_min))}` : "—"}{s.monthly_price ? ` · ${formatCurrency(Number(s.monthly_price))}/mo` : ""}</td>
                <td className="tabular px-3 py-2.5 text-xs">{[s.score_weights.website, s.score_weights.google, s.score_weights.social, s.score_weights.business].map((w) => Number(w ?? 1).toFixed(1)).join(" / ")}</td>
                <td className="tabular px-3 py-2.5 text-right">{s.leads}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={Boolean(edit)} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{edit?.id ? `Edit ${edit.name}` : "New sector"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5"><Label className="text-xs" htmlFor="sc-name">Name</Label><Input id="sc-name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label className="text-xs">Value tier</Label>
                <Select value={edit.value_tier} onValueChange={(v) => setEdit({ ...edit, value_tier: v as SectorInput["value_tier"] })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{VALUE_TIERS.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent></Select></div>
              {(["setup_price_min", "setup_price_max", "monthly_price", "avg_ticket"] as const).map((k) => (
                <div key={k} className="grid gap-1.5"><Label className="text-xs" htmlFor={`sc-${k}`}>{{ setup_price_min: "Setup from (€)", setup_price_max: "Setup up to (€)", monthly_price: "Monthly (€)", avg_ticket: "Customer avg. ticket (€)" }[k]}</Label>
                  <Input id={`sc-${k}`} type="number" min={0} value={(edit[k] as number | null | undefined) ?? ""} onChange={(e) => setEdit({ ...edit, [k]: e.target.value === "" ? null : Number(e.target.value) })} /></div>
              ))}
              <label className="flex items-center gap-2 text-sm"><Switch checked={edit.booking_relevant} onCheckedChange={(v) => setEdit({ ...edit, booking_relevant: v })} /> Online booking matters</label>
              <label className="flex items-center gap-2 text-sm"><Switch checked={edit.whatsapp_relevant} onCheckedChange={(v) => setEdit({ ...edit, whatsapp_relevant: v })} /> WhatsApp matters</label>
              <fieldset className="grid grid-cols-4 gap-2 sm:col-span-2">
                <legend className="mb-1 text-xs font-medium">Score weights (×, 0–3)</legend>
                {(["website", "google", "social", "business"] as const).map((k) => (
                  <div key={k} className="grid gap-1"><Label className="text-[11px] capitalize text-muted-foreground" htmlFor={`sw-${k}`}>{k}</Label>
                    <Input id={`sw-${k}`} type="number" step={0.1} min={0} max={3} value={edit.score_weights[k] as number} onChange={(e) => setEdit({ ...edit, score_weights: { ...edit.score_weights, [k]: Number(e.target.value) } })} /></div>
                ))}
              </fieldset>
              <div className="grid gap-1.5 sm:col-span-2"><Label className="text-xs" htmlFor="sc-p">Common problems (one per line)</Label><Textarea id="sc-p" rows={3} value={text.problems} onChange={(e) => setText({ ...text, problems: e.target.value })} /></div>
              <div className="grid gap-1.5 sm:col-span-2"><Label className="text-xs" htmlFor="sc-a">Sales arguments (one per line)</Label><Textarea id="sc-a" rows={3} value={text.arguments} onChange={(e) => setText({ ...text, arguments: e.target.value })} /></div>
              <div className="grid gap-1.5 sm:col-span-2"><Label className="text-xs" htmlFor="sc-k">Keywords for matching & discovery (comma separated)</Label><Input id="sc-k" value={text.keywords} onChange={(e) => setText({ ...text, keywords: e.target.value })} /></div>
              <fieldset className="sm:col-span-2">
                <legend className="mb-2 text-xs font-medium">Recommended services</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {services.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={edit.service_ids.includes(s.id)} onCheckedChange={(v) => setEdit({ ...edit, service_ids: v ? [...edit.service_ids, s.id] : edit.service_ids.filter((x) => x !== s.id) })} />{s.name}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          )}
          <DialogFooter>
            {edit?.id && <Button variant="ghost" className="mr-auto" disabled={pending} onClick={() => { if (window.confirm("Delete this sector? Companies keep their data but lose the sector.")) run(() => deleteSector(edit.id as string), "Sector deleted", () => setEdit(null)); }}><Trash2 /> Delete</Button>}
            <Button disabled={pending || !edit?.name.trim()} onClick={() => edit && run(() => saveSector({ ...edit, common_problems: lines(text.problems), sales_arguments: lines(text.arguments), keywords: text.keywords.split(",").map((k) => k.trim()).filter(Boolean) }), "Sector saved — rescore leads to apply new weights", () => setEdit(null))}>
              {pending && <Loader2 className="animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
