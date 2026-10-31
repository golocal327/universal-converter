"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signUp, type AuthState } from "@/lib/actions/auth";
import { AuthField } from "./field";

export function SignupForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(signUp, null);
  if (state?.message) return <p role="status" className="rounded-md bg-success-soft px-3 py-3 text-sm">{state.message}</p>;
  return (
    <form action={action} className="grid gap-4">
      <AuthField name="full_name" label="Full name" autoComplete="name" error={state?.fieldErrors?.full_name} />
      <AuthField name="email" label="Work email" type="email" autoComplete="email" error={state?.fieldErrors?.email} />
      <AuthField name="password" label="Password" type="password" autoComplete="new-password" error={state?.fieldErrors?.password} />
      {state?.error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>}
      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Create account
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account? <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">Sign in</Link>
      </p>
    </form>
  );
}
