import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  auth_callback: "That sign-in link is invalid or expired. Request a new one.",
  auth_confirm: "That confirmation link is invalid or expired.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;
  return (
    <AuthShell title="Sign in to WIRE Sales OS" subtitle="Your commercial command center.">
      <LoginForm next={next} initialError={error} />
    </AuthShell>
  );
}
