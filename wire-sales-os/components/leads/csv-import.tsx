"use client";
import Link from "next/link";
import Papa from "papaparse";
import { useRef, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, FileUp, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { commitImportChunk, finishImport, previewImport } from "@/lib/actions/import";
import { applyMapping, detectMapping, IMPORT_FIELD_LABELS, IMPORT_FIELDS, type ColumnMapping, type ImportField } from "@/lib/lead-pipeline/csv-mapping";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

type Summary = { total: number; new: number; created: number; duplicates: number; invalid: number; issues: { index: number; name: string | null; status: "duplicate" | "invalid"; detail: string }[] };
type Step = "upload" | "map" | "review" | "importing" | "done";

const MAX_ROWS = 5000;
const CHUNK = 400;

export function CsvImport({ campaigns }: { campaigns: { id: string; name: string }[] }) {
  const [step, setStep] = useState<Step>("upload");
  const [filename, setFilename] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [summary, setSummary] = useState<Summary | null>(null);
  const [result, setResult] = useState<Summary | null>(null);
  const [progress, setProgress] = useState(0);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const mapped = () => rows.map((r) => Object.fromEntries(Object.entries(applyMapping(r, mapping)).map(([k, v]) => [k, v === undefined ? null : String(v)])));

  const onFile = (file: File) => {
    if (file.size > 15 * 1024 * 1024) return toast.error("File is larger than 15 MB");
    setFilename(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
      complete: (res) => {
        const fields = (res.meta.fields ?? []).filter(Boolean);
        if (!fields.length || !res.data.length) return toast.error("The file has no header row or no data");
        if (res.data.length > MAX_ROWS) toast.warning(`Only the first ${formatNumber(MAX_ROWS)} rows will be imported`);
        setHeaders(fields);
        setRows(res.data.slice(0, MAX_ROWS));
        setMapping(detectMapping(fields));
        setStep("map");
      },
      error: (err) => toast.error(`Could not read the CSV: ${err.message}`),
    });
  };

  const analyze = () => {
    if (!Object.values(mapping).includes("company_name")) return toast.error("Map a column to “Company name” first");
    startTransition(async () => {
      const r = await previewImport(mapped());
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setSummary(r.data);
      setStep("review");
    });
  };

  const runImport = () => {
    setStep("importing");
    startTransition(async () => {
      const all = mapped();
      let jobId: string | null = null;
      const total: Summary = { total: 0, new: 0, created: 0, duplicates: 0, invalid: 0, issues: [] };
      for (let i = 0; i < all.length; i += CHUNK) {
        const r = await commitImportChunk({ rows: all.slice(i, i + CHUNK), campaignId, jobId, filename, mapping, offset: i });
        if (!r.ok) {
          toast.error(`Import stopped at row ${i + 2}: ${r.error}`);
          break;
        }
        jobId = r.data.jobId;
        total.total += r.data.total;
        total.created += r.data.created;
        total.duplicates += r.data.duplicates;
        total.invalid += r.data.invalid;
        total.issues.push(...r.data.issues);
        setProgress(Math.round(((i + CHUNK) / all.length) * 100));
      }
      if (jobId) await finishImport(jobId);
      setResult(total);
      setStep("done");
    });
  };

  const reset = () => {
    setStep("upload"); setRows([]); setHeaders([]); setSummary(null); setResult(null); setProgress(0);
  };

  if (step === "upload") {
    return (
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
        className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-16 text-center transition-colors", dragging && "border-brand bg-brand-soft/40")}
      >
        <FileUp className="size-8 text-muted-foreground" />
        <p className="mt-4 text-sm font-medium">Drop a CSV file here</p>
        <p className="mt-1 text-sm text-muted-foreground">Exports from Google Maps scrapers, Apify, spreadsheets… Columns are detected automatically.</p>
        <Button className="mt-5" variant="outline" onClick={() => input.current?.click()}>Choose file</Button>
        <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
        <p className="mt-6 font-mono text-xs text-muted-foreground">company_name, website, phone, email, city, sector, rating, reviews…</p>
      </div>
    );
  }

  if (step === "map") {
    const preview = rows.slice(0, 4);
    const used = Object.values(mapping).filter(Boolean);
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm"><span className="font-medium">{filename}</span> · {formatNumber(rows.length)} rows · {headers.length} columns</p>
          <Button variant="ghost" size="sm" onClick={reset}><RotateCcw /> Choose another file</Button>
        </div>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/30 text-xs text-muted-foreground">
              <tr><th className="px-3 py-2 text-left font-medium">CSV column</th><th className="px-3 py-2 text-left font-medium">Maps to</th><th className="px-3 py-2 text-left font-medium">Sample</th></tr>
            </thead>
            <tbody>
              {headers.map((h) => (
                <tr key={h} className="border-t">
                  <td className="px-3 py-2 font-medium">{h}</td>
                  <td className="px-3 py-2">
                    <Select value={mapping[h] ?? "skip"} onValueChange={(v) => setMapping({ ...mapping, [h]: v === "skip" ? null : (v as ImportField) })}>
                      <SelectTrigger size="sm" className="w-48"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="skip">Don’t import</SelectItem>
                        {IMPORT_FIELDS.map((f) => (
                          <SelectItem key={f} value={f} disabled={used.includes(f) && mapping[h] !== f}>{IMPORT_FIELD_LABELS[f]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="max-w-[280px] truncate px-3 py-2 text-xs text-muted-foreground">{preview.map((r) => r[h]).filter(Boolean).slice(0, 2).join(" · ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end">
          <Button onClick={analyze} disabled={pending}>{pending && <Loader2 className="animate-spin" />} Check for duplicates</Button>
        </div>
      </div>
    );
  }

  if (step === "review" && summary) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[["Records found", summary.total], ["New", summary.new], ["Duplicates", summary.duplicates], ["Invalid", summary.invalid]].map(([label, value]) => (
            <div key={label} className="rounded-xl border p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-semibold">{formatNumber(value as number)}</p>
            </div>
          ))}
        </div>
        {summary.issues.length > 0 && <IssueTable issues={summary.issues} />}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Add to campaign</span>
            <Select value={campaignId ?? "none"} onValueChange={(v) => setCampaignId(v === "none" ? null : v)}>
              <SelectTrigger size="sm" className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No campaign</SelectItem>
                {campaigns.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setStep("map")}>Back</Button>
            <Button onClick={runImport} disabled={summary.new === 0}>Import {formatNumber(summary.new)} new lead(s)</Button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "importing") {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
        <p className="mt-4 text-sm font-medium">Importing and scoring leads…</p>
        <Progress value={Math.min(progress, 100)} className="mt-4" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-xl border bg-success-soft p-4">
        <CheckCircle2 className="mt-0.5 size-5 text-success" />
        <div>
          <p className="text-sm font-medium">Imported {formatNumber(result?.created ?? 0)} lead(s)</p>
          <p className="text-sm text-muted-foreground">{formatNumber(result?.duplicates ?? 0)} duplicates and {formatNumber(result?.invalid ?? 0)} invalid rows were skipped. Every lead was scored.</p>
        </div>
      </div>
      {result && result.issues.length > 0 && <IssueTable issues={result.issues} />}
      <div className="flex gap-2">
        <Button asChild><Link href="/leads?sort=created">View imported leads</Link></Button>
        <Button variant="outline" onClick={reset}>Import another file</Button>
      </div>
    </div>
  );
}

function IssueTable({ issues }: { issues: Summary["issues"] }) {
  return (
    <div className="max-h-80 overflow-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-muted/60 text-xs text-muted-foreground backdrop-blur">
          <tr><th className="px-3 py-2 text-left font-medium">Row</th><th className="px-3 py-2 text-left font-medium">Company</th><th className="px-3 py-2 text-left font-medium">Issue</th></tr>
        </thead>
        <tbody>
          {issues.map((i) => (
            <tr key={`${i.status}-${i.index}`} className="border-t">
              <td className="tabular px-3 py-1.5 text-xs text-muted-foreground">{i.index + 2}</td>
              <td className="px-3 py-1.5">{i.name ?? "—"}</td>
              <td className="px-3 py-1.5 text-xs">
                <span className={cn("mr-2 inline-flex items-center gap-1 font-medium", i.status === "invalid" ? "text-destructive" : "text-muted-foreground")}>
                  <AlertTriangle className="size-3" /> {i.status === "invalid" ? "Invalid" : "Duplicate"}
                </span>
                {i.detail}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
