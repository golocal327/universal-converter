"use client";
import { useState } from "react";
import { Check, Copy, KeyRound, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createApiKey, revokeApiKey, rotateWebhookSecret, sendTestWebhook, updateAutomationSettings } from "@/lib/actions/settings";
import { EVENT_TYPES } from "@/lib/events/types";
import { formatRelative } from "@/lib/format";
import type { AutomationSettings } from "@/lib/settings/schema";
import { cn } from "@/lib/utils";
import { useAction } from "./use-action";

type EventRow = { id: string; type: string; created_at: string; delivered_at: string | null; attempts: number; last_error: string | null };
type KeyRow = { id: string; name: string; prefix: string; last_used_at: string | null; revoked_at: string | null; created_at: string };

function Secret({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-lg border border-warm/40 bg-warm-soft p-3">
      <p className="text-xs font-medium">{label} — copy it now, it will not be shown again.</p>
      <div className="mt-2 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded bg-background px-2 py-1 font-mono text-xs">{value}</code>
        <Button size="icon-sm" variant="outline" aria-label="Copy" onClick={async () => { await navigator.clipboard.writeText(value); setCopied(true); }}>{copied ? <Check /> : <Copy />}</Button>
      </div>
    </div>
  );
}

export function AutomationPanel({ settings, events, keys, disabled, adminConfigured, siteUrl }: {
  settings: AutomationSettings; events: EventRow[]; keys: KeyRow[]; disabled: boolean; adminConfigured: boolean; siteUrl: string;
}) {
  const [v, setV] = useState(settings);
  const [secret, setSecret] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [keyName, setKeyName] = useState("");
  const save = useAction();
  const misc = useAction();

  return (
    <div className="space-y-10">
      <section className="grid max-w-3xl gap-4">
        <div><h3 className="text-sm font-semibold">Webhooks</h3><p className="text-xs text-muted-foreground">Events are written to an outbox and POSTed to your endpoint (n8n, Make, Zapier) with an <code className="font-mono">X-Wire-Signature: t=…,v1=HMAC-SHA256</code> header. Failed deliveries retry via <code className="font-mono">/api/cron/deliver-events</code>.</p></div>
        {!adminConfigured && <p className="rounded-md bg-warm-soft px-3 py-2 text-xs">Delivery requires <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> on the server. Until then events stay in the outbox (visible below).</p>}
        <div className="grid gap-1.5"><Label htmlFor="wh-url" className="text-xs">Endpoint URL (https)</Label><Input id="wh-url" disabled={disabled} value={v.webhookUrl} onChange={(e) => setV({ ...v, webhookUrl: e.target.value })} placeholder="https://n8n.example.com/webhook/wire" /></div>
        <fieldset>
          <legend className="mb-2 text-xs font-medium">Events to send <span className="font-normal text-muted-foreground">(none selected = all)</span></legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {EVENT_TYPES.map((e) => (
              <label key={e} className="flex items-center gap-2 font-mono text-xs">
                <Checkbox disabled={disabled} checked={v.enabledEvents.includes(e)} onCheckedChange={(c) => setV({ ...v, enabledEvents: c ? [...v.enabledEvents, e] : v.enabledEvents.filter((x) => x !== e) })} />{e}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap gap-2">
          <Button disabled={disabled || save.pending} onClick={() => save.run(() => updateAutomationSettings(v), "Automation settings saved")}>{save.pending && <Loader2 className="animate-spin" />} Save</Button>
          <Button variant="outline" disabled={disabled || misc.pending || !adminConfigured} onClick={() => misc.run(() => rotateWebhookSecret(), undefined, (d) => setSecret(d.secret))}><KeyRound /> Generate signing secret</Button>
          <Button variant="outline" disabled={disabled || misc.pending} onClick={() => misc.run(() => sendTestWebhook(), (d) => `Test delivered (HTTP ${d.status})`)}><Send /> Send test event</Button>
        </div>
        {secret && <Secret value={secret} label="Webhook signing secret" />}
      </section>

      <section className="max-w-3xl">
        <h3 className="text-sm font-semibold">Recent events</h3>
        {events.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No events yet.</p> : (
          <ul className="mt-3 divide-y rounded-xl border text-sm">
            {events.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                <span className="font-mono text-xs">{e.type}</span>
                <span className={cn("text-xs", e.delivered_at ? "text-success" : e.last_error ? "text-destructive" : "text-muted-foreground")}>
                  {e.delivered_at ? (e.last_error === "filtered" ? "Filtered" : "Delivered") : e.last_error ? `Failed ×${e.attempts}: ${e.last_error}` : "Pending"} · {formatRelative(e.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid max-w-3xl gap-3">
        <div><h3 className="text-sm font-semibold">Public Lead API</h3><p className="text-xs text-muted-foreground">Push leads from Apify, n8n or any scraper. They go through normalize → validate → dedupe → score.</p></div>
        <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">{`curl -X POST ${siteUrl || "https://your-app.vercel.app"}/api/v1/leads \\
  -H "Authorization: Bearer wire_…" -H "Content-Type: application/json" \\
  -d '{"source":"api","leads":[{"company_name":"Clínica Ejemplo","website":"example.com","city":"Sevilla","sector":"Clínicas","phone":"954000000"}]}'`}</pre>
        <div className="flex gap-2">
          <Input value={keyName} disabled={disabled} onChange={(e) => setKeyName(e.target.value)} placeholder="Key name (e.g. n8n production)" className="max-w-xs" />
          <Button variant="outline" disabled={disabled || misc.pending || !keyName.trim()} onClick={() => misc.run(() => createApiKey(keyName), "API key created", (d) => { setNewKey(d.key); setKeyName(""); })}>Create API key</Button>
        </div>
        {newKey && <Secret value={newKey} label="API key" />}
        {keys.length > 0 && (
          <ul className="divide-y rounded-xl border text-sm">
            {keys.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                <span><span className="font-medium">{k.name}</span> <code className="ml-2 font-mono text-xs text-muted-foreground">{k.prefix}…</code></span>
                <span className="flex items-center gap-3 text-xs text-muted-foreground">
                  {k.revoked_at ? "Revoked" : k.last_used_at ? `Used ${formatRelative(k.last_used_at)}` : "Never used"}
                  {!k.revoked_at && <Button size="xs" variant="ghost" disabled={disabled} onClick={() => misc.run(() => revokeApiKey(k.id), "Key revoked")}>Revoke</Button>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
