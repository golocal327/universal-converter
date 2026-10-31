"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { runDiscovery } from "@/lib/actions/discovery";
import { WEBSITE_REQUIREMENT_LABELS, WEBSITE_REQUIREMENTS, type WebsiteRequirement } from "@/lib/domain/constants";

export function FindLeadsForm({ sectors }: { sectors: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sectorId, setSectorId] = useState<string>(sectors[0]?.id ?? "");
  const [sectorText, setSectorText] = useState("");
  const [location, setLocation] = useState("");
  const [website, setWebsite] = useState<WebsiteRequirement>("missing_or_weak");
  const [minReviews, setMinReviews] = useState("");
  const [maxReviews, setMaxReviews] = useState("");
  const [minScore, setMinScore] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const r = await runDiscovery({
        sectorId: sectorId && sectorId !== "custom" ? sectorId : null, sectorText: sectorId === "custom" ? sectorText : undefined, location,
        websiteRequirement: website, minReviews: minReviews || undefined, maxReviews: maxReviews || undefined, minScore: minScore || undefined,
      });
      if (!r.ok) { toast.error(r.error); return; }
      toast.success("Search complete");
      router.push(`/prospects?run=${r.data.runId}`);
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[1.2fr_1.2fr_1fr_0.7fr_0.7fr_0.7fr_auto] lg:items-end">
      <div className="grid gap-1.5">
        <Label className="text-xs">Sector</Label>
        <Select value={sectorId} onValueChange={setSectorId}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Sector" /></SelectTrigger>
          <SelectContent>
            {sectors.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            <SelectItem value="custom">Other (type it)…</SelectItem>
          </SelectContent>
        </Select>
        {sectorId === "custom" && <Input value={sectorText} onChange={(e) => setSectorText(e.target.value)} placeholder="e.g. clínica de podología" aria-label="Business type" />}
      </div>
      <div className="grid gap-1.5"><Label htmlFor="fl-loc" className="text-xs">Location</Label><Input id="fl-loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Sevilla" required /></div>
      <div className="grid gap-1.5">
        <Label className="text-xs">Website</Label>
        <Select value={website} onValueChange={(v) => setWebsite(v as WebsiteRequirement)}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>{WEBSITE_REQUIREMENTS.map((w) => <SelectItem key={w} value={w}>{WEBSITE_REQUIREMENT_LABELS[w]}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5"><Label htmlFor="fl-min" className="text-xs">Min reviews</Label><Input id="fl-min" type="number" min={0} value={minReviews} onChange={(e) => setMinReviews(e.target.value)} /></div>
      <div className="grid gap-1.5"><Label htmlFor="fl-max" className="text-xs">Max reviews</Label><Input id="fl-max" type="number" min={0} value={maxReviews} onChange={(e) => setMaxReviews(e.target.value)} /></div>
      <div className="grid gap-1.5"><Label htmlFor="fl-score" className="text-xs">Min score</Label><Input id="fl-score" type="number" min={0} max={100} value={minScore} onChange={(e) => setMinScore(e.target.value)} /></div>
      <Button type="submit" disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : <Search />} Find leads</Button>
    </form>
  );
}
