import "server-only";
import { DEFAULT_PRICING_RULES, DEFAULT_SECTORS, DEFAULT_SERVICES, DEFAULT_TEMPLATES } from "@/lib/defaults/catalog";
import type { Json } from "@/lib/supabase/database.types";
import type { Actor } from "./types";

/** Install the default commercial configuration in a fresh workspace (idempotent per slug). */
export async function installDefaults(actor: Actor, branding: { senderName: string; senderEmail: string }) {
  const ws = actor.workspaceId;

  const { data: services, error: sErr } = await actor.db
    .from("services")
    .upsert(DEFAULT_SERVICES.map((s) => ({ ...s, workspace_id: ws })), { onConflict: "workspace_id,slug" })
    .select("id, slug");
  if (sErr) throw new Error(`Services: ${sErr.message}`);
  const serviceId = new Map((services ?? []).map((s) => [s.slug, s.id]));

  const { data: sectors, error: secErr } = await actor.db
    .from("sectors")
    .upsert(
      DEFAULT_SECTORS.map(({ services: _services, ...s }) => ({ ...s, workspace_id: ws })),
      { onConflict: "workspace_id,slug" },
    )
    .select("id, slug");
  if (secErr) throw new Error(`Sectors: ${secErr.message}`);
  const sectorId = new Map((sectors ?? []).map((s) => [s.slug, s.id]));

  const links = DEFAULT_SECTORS.flatMap((sector) =>
    sector.services
      .map((slug) => ({ workspace_id: ws, sector_id: sectorId.get(sector.slug) as string, service_id: serviceId.get(slug) as string }))
      .filter((l) => l.sector_id && l.service_id),
  );
  if (links.length) await actor.db.from("sector_services").upsert(links, { onConflict: "sector_id,service_id" });

  const { count: ruleCount } = await actor.db.from("pricing_rules").select("id", { count: "exact", head: true }).eq("workspace_id", ws);
  if (!ruleCount) {
    const { error } = await actor.db.from("pricing_rules").insert(
      DEFAULT_PRICING_RULES.map((r) => ({
        workspace_id: ws,
        name: r.name,
        priority: r.priority,
        conditions: r.conditions as Json,
        package_name: r.package_name,
        service_id: r.service_slug ? (serviceId.get(r.service_slug) ?? null) : null,
        setup_price: r.setup_price,
        monthly_price: r.monthly_price,
      })),
    );
    if (error) throw new Error(`Pricing rules: ${error.message}`);
  }

  const { count: templateCount } = await actor.db.from("email_templates").select("id", { count: "exact", head: true }).eq("workspace_id", ws);
  if (!templateCount) {
    const { error } = await actor.db.from("email_templates").insert(DEFAULT_TEMPLATES.map((t) => ({ ...t, workspace_id: ws, created_by: actor.userId })));
    if (error) throw new Error(`Templates: ${error.message}`);
  }

  await actor.db
    .from("settings")
    .update({
      branding: { senderName: branding.senderName, senderEmail: branding.senderEmail, senderPhone: "", companyName: "WIRE", website: "" } as Json,
      scoring: { targetLocations: [], hotThreshold: 75, warmThreshold: 50 } as Json,
    })
    .eq("workspace_id", ws);
}
