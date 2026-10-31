"use client";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { createWorkspace, type OnboardingState } from "@/lib/actions/workspace";
import { AuthField } from "./field";

export function OnboardingForm({ defaultSender }: { defaultSender: string }) {
  const [state, action, pending] = useActionState<OnboardingState, FormData>(createWorkspace, null);
  return (
    <form action={action} className="grid gap-4">
      <AuthField name="name" label="Workspace name" defaultValue="WIRE" error={state?.fieldErrors?.name} />
      <AuthField name="sender_name" label="Your name (used to sign outreach)" defaultValue={defaultSender} error={state?.fieldErrors?.sender_name} />
      <div className="flex items-start gap-3 rounded-lg border p-3">
        <Checkbox id="demo" name="demo" defaultChecked />
        <div className="grid gap-0.5">
          <Label htmlFor="demo">Load demo data</Label>
          <p className="text-xs text-muted-foreground">34 fictitious businesses with audits, deals, campaigns and tasks. Remove them anytime in Settings → Data.</p>
        </div>
      </div>
      {state?.error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>}
      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        {pending ? "Setting up…" : "Create workspace"}
      </Button>
    </form>
  );
}
