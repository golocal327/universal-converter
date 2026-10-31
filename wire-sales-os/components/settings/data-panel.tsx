"use client";
import { Database, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearDemoDataAction, loadDemoDataAction } from "@/lib/actions/workspace";
import { useAction } from "./use-action";

export function DataPanel({ hasDemo, disabled }: { hasDemo: boolean; disabled: boolean }) {
  const load = useAction();
  const clear = useAction();
  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-xl border p-4">
        <p className="text-sm font-medium">Demo data</p>
        <p className="mt-1 text-sm text-muted-foreground">34 fictitious businesses (reserved <code className="font-mono text-xs">.example</code> domains, fictional phone numbers) across 12 sectors, with audits, deals in every stage, campaigns, proposals, tasks and a 60-day activity history. Created through the real lead pipeline.</p>
        <div className="mt-4 flex gap-2">
          {!hasDemo && <Button disabled={disabled || load.pending} onClick={() => load.run(() => loadDemoDataAction(), (d) => `Loaded ${d.companies} demo companies`)}>{load.pending ? <Loader2 className="animate-spin" /> : <Database />} Load demo data</Button>}
          {hasDemo && <Button variant="destructive" disabled={disabled || clear.pending} onClick={() => { if (window.confirm("Remove all demo companies, their deals, tasks and timeline?")) clear.run(() => clearDemoDataAction(), "Demo data removed"); }}>{clear.pending ? <Loader2 className="animate-spin" /> : <Trash2 />} Remove demo data</Button>}
        </div>
      </div>
    </div>
  );
}
