"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendMagicLink, signIn, type AuthState } from "@/lib/actions/auth";
import { AuthField } from "./field";

export function LoginForm({ next, initialError }: { next?: string; initialError?: string }) {
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [state, action, pending] = useActionState<AuthState, FormData>(mode === "password" ? signIn : sendMagicLink, initialError ? { error: initialError } : null);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="next" value={next ?? "/"} />
      <AuthField name="email" label="Email" type="email" autoComplete="email" error={state?.fieldErrors?.email} />
      {mode === "password" && <AuthField name="password" label="Password" type="password" autoComplete="current-password" error={state?.fieldErrors?.password} />}
      {state?.error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>}
      {state?.message && <p role="status" className="rounded-md bg-success-soft px-3 py-2 text-sm">{state.message}</p>}
      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        {mode === "password" ? "Sign in" : "Email me a sign-in link"}
      </Button>
      <button type="button" className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" onClick={() => setMode(mode === "password" ? "magic" : "password")}>
        {mode === "password" ? "Use a magic link instead" : "Use email and password"}
      </button>
      <p className="text-center text-sm text-muted-foreground">
        No account? <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">Create one</Link>
      </p>
    </form>
  );
}
