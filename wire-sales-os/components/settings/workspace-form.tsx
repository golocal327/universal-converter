"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateWorkspaceSettings } from "@/lib/actions/settings";
import type { BrandingSettings } from "@/lib/settings/schema";
import { useAction } from "./use-action";

export function WorkspaceForm({ name, branding, disabled }: { name: string; branding: BrandingSettings; disabled: boolean }) {
  const [v, setV] = useState({ name, ...branding });
  const { pending, run } = useAction();
  const field = (key: keyof typeof v, label: string, hint?: string) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`ws-${key}`} className="text-xs">{label}</Label>
      <Input id={`ws-${key}`} value={v[key]} disabled={disabled} onChange={(e) => setV({ ...v, [key]: e.target.value })} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
  return (
    <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
      {field("name", "Workspace name")}
      {field("companyName", "Company name (proposals)")}
      {field("senderName", "Sender name", "Signs emails and WhatsApp messages")}
      {field("senderEmail", "Sender / reply-to email")}
      {field("senderPhone", "Sender phone")}
      {field("website", "Company website")}
      <div className="sm:col-span-2">
        <Button disabled={disabled || pending} onClick={() => run(() => updateWorkspaceSettings({ name: v.name, branding: { companyName: v.companyName, senderName: v.senderName, senderEmail: v.senderEmail, senderPhone: v.senderPhone, website: v.website } }), "Settings saved")}>
          {pending && <Loader2 className="animate-spin" />} Save
        </Button>
      </div>
    </div>
  );
}
