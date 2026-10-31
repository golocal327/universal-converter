"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Bookmark, Loader2, Search, SlidersHorizontal, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CONTACT_STATUS_LABELS, CONTACT_STATUSES, LEAD_SOURCE_LABELS, LEAD_SOURCES, LEAD_STATUS_LABELS, LEAD_STATUSES, STAGE_KEYS } from "@/lib/domain/constants";
import { deleteSavedFilter, saveLeadFilter } from "@/lib/actions/leads";
import { leadFiltersToQuery, parseLeadFilters, type LeadFilters } from "@/lib/filters/leads";

type Option = { id: string; name: string };
type Saved = { id: string; name: string; filters: Record<string, unknown>; mine: boolean };

function FilterSelect({ value, onChange, placeholder, options, width = "w-36" }: {
  value: string | undefined; onChange: (v: string | undefined) => void; placeholder: string; options: { value: string; label: string }[]; width?: string;
}) {
  return (
    <Select value={value ?? "all"} onValueChange={(v) => onChange(v === "all" ? undefined : v)}>
      <SelectTrigger size="sm" className={`${width} ${value ? "border-foreground/30" : ""}`} aria-label={placeholder}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{placeholder}: any</SelectItem>
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export function LeadFilterBar({ sectors, campaigns, saved }: { sectors: Option[]; campaigns: Option[]; saved: Saved[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const filters = parseLeadFilters(Object.fromEntries(params.entries()));
  const [q, setQ] = useState(filters.q ?? "");
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [shared, setShared] = useState(true);

  const apply = (patch: Partial<LeadFilters>) => {
    const next = { ...filters, ...patch, page: undefined };
    startTransition(() => router.replace(`${pathname}?${leadFiltersToQuery(next)}`, { scroll: false }));
  };

  useEffect(() => {
    if ((filters.q ?? "") === q) return;
    const t = setTimeout(() => apply({ q: q || undefined }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const numberField = (key: keyof LeadFilters, label: string, max: number, step = 1) => (
    <div className="grid gap-1">
      <Label className="text-xs text-muted-foreground" htmlFor={`f-${key}`}>{label}</Label>
      <Input id={`f-${key}`} type="number" min={0} max={max} step={step} defaultValue={(filters[key] as number | undefined) ?? ""} className="h-8"
        onBlur={(e) => apply({ [key]: e.target.value === "" ? undefined : Number(e.target.value) } as Partial<LeadFilters>)} />
    </div>
  );
  const advancedCount = ["min_score", "max_score", "max_website_score", "min_reviews", "max_reviews", "min_rating", "city", "province", "source", "status"].filter((k) => filters[k as keyof LeadFilters] !== undefined).length;
  const hasFilters = Object.entries(filters).some(([k, v]) => !["sort", "dir", "page", "per"].includes(k) && v !== undefined);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-64">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search company, city, domain…" className="h-8 pl-8" aria-label="Search leads" />
      </div>
      <FilterSelect placeholder="Priority" value={filters.priority} onChange={(v) => apply({ priority: v as LeadFilters["priority"] })} width="w-32"
        options={[{ value: "hot", label: "Hot" }, { value: "warm", label: "Warm" }, { value: "cold", label: "Cold" }]} />
      <FilterSelect placeholder="Sector" value={filters.sector} onChange={(v) => apply({ sector: v })} width="w-40" options={sectors.map((s) => ({ value: s.id, label: s.name }))} />
      <FilterSelect placeholder="Website" value={filters.website} onChange={(v) => apply({ website: v as LeadFilters["website"] })}
        options={[{ value: "missing", label: "No website" }, { value: "weak", label: "Weak (<50)" }, { value: "unknown", label: "Not audited" }, { value: "good", label: "Good" }]} />
      <FilterSelect placeholder="Stage" value={filters.stage} onChange={(v) => apply({ stage: v as LeadFilters["stage"] })}
        options={[{ value: "none", label: "Not in pipeline" }, ...STAGE_KEYS.map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))]} />
      <FilterSelect placeholder="Contact" value={filters.contact} onChange={(v) => apply({ contact: v as LeadFilters["contact"] })} width="w-40"
        options={CONTACT_STATUSES.map((s) => ({ value: s, label: CONTACT_STATUS_LABELS[s] }))} />
      {campaigns.length > 0 && (
        <FilterSelect placeholder="Campaign" value={filters.campaign} onChange={(v) => apply({ campaign: v })} width="w-40" options={campaigns.map((c) => ({ value: c.id, label: c.name }))} />
      )}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm"><SlidersHorizontal /> More{advancedCount ? ` (${advancedCount})` : ""}</Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80">
          <div className="grid grid-cols-2 gap-3">
            {numberField("min_score", "Min lead score", 100)}
            {numberField("max_score", "Max lead score", 100)}
            {numberField("max_website_score", "Max website score", 100)}
            {numberField("min_rating", "Min rating", 5, 0.1)}
            {numberField("min_reviews", "Min reviews", 1_000_000)}
            {numberField("max_reviews", "Max reviews", 1_000_000)}
            <div className="grid gap-1">
              <Label className="text-xs text-muted-foreground" htmlFor="f-city">City</Label>
              <Input id="f-city" defaultValue={filters.city ?? ""} className="h-8" onBlur={(e) => apply({ city: e.target.value || undefined })} />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs text-muted-foreground" htmlFor="f-province">Province</Label>
              <Input id="f-province" defaultValue={filters.province ?? ""} className="h-8" onBlur={(e) => apply({ province: e.target.value || undefined })} />
            </div>
            <div className="col-span-2 grid grid-cols-2 gap-3">
              <FilterSelect placeholder="Source" value={filters.source} onChange={(v) => apply({ source: v as LeadFilters["source"] })} width="w-full"
                options={LEAD_SOURCES.map((s) => ({ value: s, label: LEAD_SOURCE_LABELS[s] }))} />
              <FilterSelect placeholder="Status" value={filters.status} onChange={(v) => apply({ status: v as LeadFilters["status"] })} width="w-full"
                options={LEAD_STATUSES.map((s) => ({ value: s, label: LEAD_STATUS_LABELS[s] }))} />
            </div>
          </div>
        </PopoverContent>
      </Popover>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm"><Bookmark /> Saved</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-xs text-muted-foreground">Saved filters</DropdownMenuLabel>
          {saved.length === 0 && <p className="px-2 py-1.5 text-xs text-muted-foreground">No saved filters yet.</p>}
          {saved.map((s) => (
            <DropdownMenuItem key={s.id} onSelect={() => startTransition(() => router.replace(`${pathname}?${leadFiltersToQuery(s.filters as Partial<LeadFilters>)}`))}>
              <span className="flex-1 truncate">{s.name}</span>
              {s.mine && (
                <button type="button" aria-label={`Delete ${s.name}`} className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                  onClick={async (e) => { e.preventDefault(); e.stopPropagation(); const r = await deleteSavedFilter(s.id); if (r.ok) toast.success("Filter deleted"); }}>
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={!hasFilters} onSelect={() => setSaveOpen(true)}>Save current filters…</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => { setQ(""); startTransition(() => router.replace(pathname)); }}>
          <X /> Clear
        </Button>
      )}
      {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save filter</DialogTitle>
            <DialogDescription>Reuse this view in one click, e.g. “High value leads — Sevilla”.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Input autoFocus value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Filter name" maxLength={80} />
            <label className="flex items-center gap-2 text-sm"><Switch checked={shared} onCheckedChange={setShared} /> Share with the workspace</label>
          </div>
          <DialogFooter>
            <Button disabled={!saveName.trim()} onClick={async () => {
              const { page: _page, ...rest } = filters;
              const r = await saveLeadFilter({ name: saveName, filters: rest, isShared: shared });
              if (r.ok) { toast.success("Filter saved"); setSaveOpen(false); setSaveName(""); router.refresh(); } else toast.error(r.error);
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
