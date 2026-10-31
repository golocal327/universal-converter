import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WireLogo } from "@/components/app/logo";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Configuration required" };

const STEPS = [
  ["Create a Supabase project", "supabase.com → New project. Copy the project URL and the anon/publishable key."],
  ["Apply the database migrations", "supabase link --project-ref <ref> && supabase db push"],
  ["Set environment variables", "NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY (and SUPABASE_SERVICE_ROLE_KEY for the public API, webhooks and seeding). See .env.example."],
  ["Restart / redeploy", "Restart `npm run dev` or redeploy on Vercel so the variables are picked up."],
];

/** Shown instead of crashing when Supabase is not configured yet. */
export default function SetupPage() {
  if (isSupabaseConfigured()) redirect("/");
  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col justify-center px-6 py-16">
      <WireLogo />
      <h1 className="mt-10 text-2xl font-semibold tracking-tight">Configuration required</h1>
      <p className="mt-2 text-sm text-muted-foreground">WIRE Sales OS needs a Supabase project for authentication and data. Nothing is faked: until it is connected, the app stays here.</p>
      <ol className="mt-8 space-y-5">
        {STEPS.map(([title, body], i) => (
          <li key={title} className="flex gap-4">
            <span className="tabular flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium">{i + 1}</span>
            <div>
              <p className="text-sm font-medium">{title}</p>
              <p className="mt-0.5 font-mono text-xs leading-relaxed text-muted-foreground">{body}</p>
            </div>
          </li>
        ))}
      </ol>
    </main>
  );
}
