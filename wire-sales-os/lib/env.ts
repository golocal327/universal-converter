/**
 * Environment access. Public values may be inlined in client bundles; server
 * secrets are only read inside server-only modules (see lib/supabase/admin.ts,
 * lib/ai/*). Nothing here throws at import time so the app can render a clear
 * "configuration required" screen instead of crashing.
 */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  // Supabase's new "publishable" key and the legacy "anon" key are interchangeable here.
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "",
};

export function isSupabaseConfigured(): boolean {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
}
