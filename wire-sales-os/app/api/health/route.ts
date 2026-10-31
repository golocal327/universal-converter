import { NextResponse } from "next/server";
import { isAIConfigured } from "@/lib/ai";
import { isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Liveness + configuration flags (booleans only, never values). */
export function GET() {
  return NextResponse.json({ ok: true, supabase: isSupabaseConfigured(), ai: isAIConfigured() });
}
