"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import { Download, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteDocument, getDocumentUrl, registerDocument } from "@/lib/actions/company";
import { formatCurrency, formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

export type ProposalRow = { id: string; title: string; status: string; setup_total: number; monthly_total: number; generated_by: string; created_at: string };
export type DocumentRow = { id: string; name: string; size_bytes: number | null; created_at: string };

const MAX = 20 * 1024 * 1024;

export function DocumentsCard({ workspaceId, companyId, proposals, documents }: { workspaceId: string; companyId: string; proposals: ProposalRow[]; documents: DocumentRow[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  const upload = (file: File) =>
    startTransition(async () => {
      if (file.size > MAX) {
        toast.error("Files up to 20 MB");
        return;
      }
      const safe = file.name.normalize("NFD").replace(/[^\w.\-]+/g, "_").slice(-120);
      const path = `${workspaceId}/${companyId}/${crypto.randomUUID()}-${safe}`;
      const { error } = await createClient().storage.from("documents").upload(path, file, { contentType: file.type || undefined });
      if (error) {
        toast.error(`Upload failed: ${error.message}`);
        return;
      }
      const r = await registerDocument({ companyId, name: file.name, storagePath: path, mimeType: file.type || null, sizeBytes: file.size });
      if (r.ok) { toast.success("Document uploaded"); router.refresh(); } else toast.error(r.error);
    });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <p className="mb-2 text-sm font-semibold">Proposals</p>
        {proposals.length === 0 ? <p className="text-sm text-muted-foreground">No proposals yet — use “Generate proposal”.</p> : (
          <ul className="divide-y rounded-xl border">
            {proposals.map((p) => (
              <li key={p.id}>
                <Link href={`/proposals/${p.id}`} className="flex items-center justify-between gap-3 p-3 hover:bg-muted/40">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{p.title}</span>
                      <span className="block text-xs text-muted-foreground">{formatDate(p.created_at)} · {p.generated_by === "ai" ? "AI" : "Rules engine"} · <span className="capitalize">{p.status}</span></span>
                    </span>
                  </span>
                  <span className="tabular shrink-0 text-xs font-medium">{formatCurrency(p.setup_total)} + {formatCurrency(p.monthly_total)}/mo</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold">Files</p>
          <Button size="sm" variant="outline" onClick={() => input.current?.click()} disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : <Upload />} Upload</Button>
          <input ref={input} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
        </div>
        {documents.length === 0 ? <p className="text-sm text-muted-foreground">No files. Upload briefs, contracts or screenshots (private storage).</p> : (
          <ul className="divide-y rounded-xl border">
            {documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 p-3">
                <span className="min-w-0">
                  <span className="block truncate text-sm">{d.name}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(d.created_at)}{d.size_bytes ? ` · ${Math.ceil(d.size_bytes / 1024)} KB` : ""}</span>
                </span>
                <span className="flex">
                  <Button size="icon-xs" variant="ghost" aria-label="Download" onClick={() => startTransition(async () => { const r = await getDocumentUrl(d.id); if (r.ok) window.open(r.data.url, "_blank", "noopener"); else toast.error(r.error); })}><Download /></Button>
                  <Button size="icon-xs" variant="ghost" aria-label="Delete" onClick={() => startTransition(async () => { const r = await deleteDocument(d.id); if (r.ok) router.refresh(); else toast.error(r.error); })}><Trash2 /></Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
