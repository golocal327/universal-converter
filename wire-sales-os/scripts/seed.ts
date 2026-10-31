/**
 * Seed a demo account + workspace through the real application services.
 *
 *   npm run seed
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and
 * SUPABASE_SERVICE_ROLE_KEY (read from .env.local). Creates (or reuses)
 * SEED_EMAIL / SEED_PASSWORD, signs in as that user and runs onboarding +
 * demo data with the user's session, so RLS applies exactly as in the app.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/supabase/database.types";
import { loadDemoData } from "../lib/services/demo";
import { installDefaults } from "../lib/services/workspace-setup";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Variables may come from the environment instead.
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.SEED_EMAIL ?? "demo@wire.local";
const password = process.env.SEED_PASSWORD ?? `Wire-${crypto.randomUUID().slice(0, 12)}`;

async function main() {
  if (!url || !anon || !service) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY");
  const admin = createClient<Database>(url, service, { auth: { persistSession: false } });

  const { error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "WIRE Demo" } });
  if (createError && !/already|registered|exists/i.test(createError.message)) throw createError;
  if (createError) console.log(`User ${email} already exists — set SEED_PASSWORD to its password to sign in.`);

  const user = createClient<Database>(url, anon, { auth: { persistSession: false } });
  const { data: session, error: signInError } = await user.auth.signInWithPassword({ email, password });
  if (signInError || !session.user) throw signInError ?? new Error("Could not sign in");

  const { data: existing } = await user.from("workspace_members").select("workspace_id").eq("user_id", session.user.id).limit(1).maybeSingle();
  let workspaceId = existing?.workspace_id;
  if (!workspaceId) {
    const { data, error } = await user.rpc("create_workspace", { p_name: "WIRE Demo", p_slug: `wire-demo-${crypto.randomUUID().slice(0, 6)}` });
    if (error || !data) throw error ?? new Error("Could not create workspace");
    workspaceId = data;
  }
  const actor = { db: user, workspaceId, userId: session.user.id };
  await installDefaults(actor, { senderName: "WIRE Demo", senderEmail: email });
  try {
    const res = await loadDemoData(actor);
    console.log(`Loaded ${res.companies} demo companies and ${res.campaigns} campaigns.`);
  } catch (e) {
    console.log(`Demo data: ${(e as Error).message}`);
  }
  console.log(`\nSign in at /login with:\n  email:    ${email}\n  password: ${password}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
