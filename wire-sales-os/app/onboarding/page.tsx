import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WireLogo } from "@/components/app/logo";
import { OnboardingForm } from "@/components/auth/onboarding-form";
import { getMemberships, requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Set up your workspace" };

export default async function OnboardingPage() {
  const user = await requireUser();
  const memberships = await getMemberships();
  if (memberships.length) redirect("/");
  const name = (user.user_metadata?.full_name as string | undefined) ?? "";
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-6 py-16">
      <WireLogo />
      <h1 className="mt-10 text-2xl font-semibold tracking-tight">Set up your workspace</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        We install the WIRE playbook: 12 sectors with sales arguments, a service catalog, pricing rules, a 9-stage pipeline and outreach templates. Everything is editable later.
      </p>
      <div className="mt-8">
        <OnboardingForm defaultSender={name} />
      </div>
    </main>
  );
}
