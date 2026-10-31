"use client";
import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { rescoreAllLeads, updateAISettings, updateScoringSettings } from "@/lib/actions/settings";
import type { AiSettings, ScoringSettings } from "@/lib/settings/schema";
import { useAction } from "./use-action";

export function ScoringForm({ settings, disabled }: { settings: ScoringSettings; disabled: boolean }) {
  const [v, setV] = useState({ ...settings, targets: settings.targetLocations.join(", ") });
  const save = useAction();
  const rescore = useAction();
  return (
    <div className="grid max-w-2xl gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="sc-targets" className="text-xs">Target cities / provinces</Label>
        <Input id="sc-targets" disabled={disabled} value={v.targets} onChange={(e) => setV({ ...v, targets: e.target.value })} placeholder="Cádiz, Sevilla, Jerez de la Frontera" />
        <p className="text-xs text-muted-foreground">Leads located here get +4 (“In target area”).</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5"><Label htmlFor="sc-hot" className="text-xs">Hot from score</Label><Input id="sc-hot" type="number" min={1} max={100} disabled={disabled} value={v.hotThreshold} onChange={(e) => setV({ ...v, hotThreshold: Number(e.target.value) })} /></div>
        <div className="grid gap-1.5"><Label htmlFor="sc-warm" className="text-xs">Warm from score</Label><Input id="sc-warm" type="number" min={1} max={100} disabled={disabled} value={v.warmThreshold} onChange={(e) => setV({ ...v, warmThreshold: Number(e.target.value) })} /></div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={disabled || save.pending} onClick={() => save.run(() => updateScoringSettings({ targetLocations: v.targets.split(",").map((t) => t.trim()).filter(Boolean), hotThreshold: v.hotThreshold, warmThreshold: v.warmThreshold }), "Scoring settings saved")}>
          {save.pending && <Loader2 className="animate-spin" />} Save
        </Button>
        <Button variant="outline" disabled={disabled || rescore.pending} onClick={() => rescore.run(() => rescoreAllLeads(), (d) => `Rescored ${d.count} leads`)}>
          {rescore.pending ? <Loader2 className="animate-spin" /> : <RefreshCw />} Rescore all leads
        </Button>
      </div>
    </div>
  );
}

export function AIForm({ settings, disabled, available }: { settings: AiSettings; disabled: boolean; available: { anthropic: boolean; openai: boolean } }) {
  const [v, setV] = useState(settings);
  const { pending, run } = useAction();
  return (
    <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <div className="grid gap-1.5">
        <Label className="text-xs">Provider</Label>
        <Select value={v.provider} disabled={disabled} onValueChange={(p) => setV({ ...v, provider: p as AiSettings["provider"] })}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Automatic (Anthropic first)</SelectItem>
            <SelectItem value="anthropic" disabled={!available.anthropic}>Anthropic Claude{available.anthropic ? "" : " — key missing"}</SelectItem>
            <SelectItem value="openai" disabled={!available.openai}>OpenAI{available.openai ? "" : " — key missing"}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="ai-model" className="text-xs">Model override (optional)</Label>
        <Input id="ai-model" disabled={disabled} value={v.model} onChange={(e) => setV({ ...v, model: e.target.value })} placeholder="Default: claude-opus-5-5" />
      </div>
      <div className="sm:col-span-2">
        <Button disabled={disabled || pending} onClick={() => run(() => updateAISettings(v), "AI settings saved")}>{pending && <Loader2 className="animate-spin" />} Save</Button>
      </div>
    </div>
  );
}
