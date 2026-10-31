import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupDatabase, type Db } from "./harness";

let db: Db;
let alice: string; // owner of workspace A
let bob: string; // owner of workspace B
let carol: string; // plain member of workspace A
let wsA: string;
let wsB: string;

async function stage(userId: string, ws: string, key: string) {
  const [row] = await db.asUser<{ id: string }>(userId, "select id from pipeline_stages where workspace_id = $1 and key = $2", [ws, key]);
  return row.id;
}

async function createCompanyWithLead(userId: string, ws: string, name: string) {
  const [company] = await db.asUser<{ id: string }>(
    userId,
    "insert into companies (workspace_id, name, city, website, domain) values ($1, $2, 'Sevilla', 'https://example.com', 'example.com') returning id",
    [ws, name],
  );
  const [lead] = await db.asUser<{ id: string }>(
    userId,
    "insert into leads (workspace_id, company_id, score, priority) values ($1, $2, 80, 'hot') returning id",
    [ws, company.id],
  );
  return { companyId: company.id, leadId: lead.id };
}

beforeAll(async () => {
  db = await setupDatabase();
  alice = await db.createUser("alice@example.test", "Alice Owner");
  bob = await db.createUser("bob@example.test");
  carol = await db.createUser("carol@example.test");
  [{ create_workspace: wsA }] = await db.asUser<{ create_workspace: string }>(alice, "select create_workspace('WIRE', 'wire')");
  [{ create_workspace: wsB }] = await db.asUser<{ create_workspace: string }>(bob, "select create_workspace('Other Agency', 'other')");
  await db.admin("insert into workspace_members (workspace_id, user_id, role) values ($1, $2, 'member')", [wsA, carol]);
});

afterAll(async () => {
  await db?.close();
});

describe("auth integration", () => {
  it("creates a profile for every new auth user", async () => {
    const rows = await db.admin<{ full_name: string; email: string }>("select full_name, email from profiles where id = $1", [alice]);
    expect(rows[0]).toEqual({ full_name: "Alice Owner", email: "alice@example.test" });
    const fallback = await db.admin<{ full_name: string }>("select full_name from profiles where id = $1", [bob]);
    expect(fallback[0].full_name).toBe("bob");
  });

  it("create_workspace provisions membership, settings and the default pipeline", async () => {
    const members = await db.asUser(alice, "select role from workspace_members where workspace_id = $1 and user_id = $2", [wsA, alice]);
    expect(members[0].role).toBe("owner");
    const stages = await db.asUser<{ key: string }>(alice, "select key from pipeline_stages where workspace_id = $1 order by position", [wsA]);
    expect(stages.map((s) => s.key)).toEqual(["new", "qualified", "contacted", "replied", "meeting", "proposal", "negotiation", "won", "lost"]);
    const settings = await db.asUser(alice, "select workspace_id from settings where workspace_id = $1", [wsA]);
    expect(settings).toHaveLength(1);
  });

  it("rejects create_workspace without an authenticated user", async () => {
    await expect(db.asAnon("select create_workspace('X', 'x-ws')")).rejects.toThrow(/permission denied for function/);
  });

  it("does not allow inserting workspaces directly", async () => {
    await expect(db.asUser(alice, "insert into workspaces (name, slug) values ('Hack', 'hack')")).rejects.toThrow(/permission denied/);
  });
});

describe("row level security", () => {
  it("isolates workspaces from each other", async () => {
    const { companyId } = await createCompanyWithLead(alice, wsA, "Clínica Alfa");
    const asBob = await db.asUser(bob, "select id from companies where id = $1", [companyId]);
    expect(asBob).toHaveLength(0);
    const asCarol = await db.asUser(carol, "select id from companies where id = $1", [companyId]);
    expect(asCarol).toHaveLength(1);
    const bobLeads = await db.asUser(bob, "select id from lead_overview where workspace_id = $1", [wsA]);
    expect(bobLeads).toHaveLength(0);
  });

  it("blocks writes into a workspace the user does not belong to", async () => {
    await expect(
      db.asUser(bob, "insert into companies (workspace_id, name) values ($1, 'Intruder')", [wsA]),
    ).rejects.toThrow(/row-level security/);
    const updated = await db.asUser(bob, "update companies set name = 'pwned' where workspace_id = $1 returning id", [wsA]);
    expect(updated).toHaveLength(0);
  });

  it("composite keys stop cross-workspace references even with a known UUID", async () => {
    const [foreign] = await db.asUser<{ id: string }>(alice, "select id from companies where workspace_id = $1 limit 1", [wsA]);
    await expect(
      db.asUser(bob, "insert into leads (workspace_id, company_id) values ($1, $2)", [wsB, foreign.id]),
    ).rejects.toThrow(/foreign key/);
  });

  it("gives the anon role no access to business data", async () => {
    await expect(db.asAnon("select * from companies")).rejects.toThrow(/permission denied/);
    await expect(db.asAnon("select * from lead_overview")).rejects.toThrow(/permission denied/);
  });

  it("only lets admins change configuration tables", async () => {
    await expect(
      db.asUser(carol, "insert into services (workspace_id, name, slug, setup_price) values ($1, 'SEO', 'seo', 500)", [wsA]),
    ).rejects.toThrow(/row-level security/);
    const rows = await db.asUser(alice, "insert into services (workspace_id, name, slug, setup_price) values ($1, 'SEO', 'seo', 500) returning id", [wsA]);
    expect(rows).toHaveLength(1);
    const visible = await db.asUser(carol, "select id from services where workspace_id = $1", [wsA]);
    expect(visible).toHaveLength(1);
  });

  it("keeps workspace secrets and rate-limit state away from clients", async () => {
    await db.admin("insert into workspace_secrets (workspace_id, webhook_secret) values ($1, 'shh')", [wsA]);
    await expect(db.asUser(alice, "select * from workspace_secrets")).rejects.toThrow(/permission denied/);
    await expect(db.asUser(alice, "select * from rate_limits")).rejects.toThrow(/permission denied/);
  });

  it("keeps private saved filters private", async () => {
    await db.asUser(alice, "insert into saved_filters (workspace_id, user_id, entity, name, filters, is_shared) values ($1, $2, 'leads', 'Mine', '{}', false)", [wsA, alice]);
    await db.asUser(alice, "insert into saved_filters (workspace_id, user_id, entity, name, filters, is_shared) values ($1, $2, 'leads', 'Team', '{}', true)", [wsA, alice]);
    const carolView = await db.asUser<{ name: string }>(carol, "select name from saved_filters where workspace_id = $1", [wsA]);
    expect(carolView.map((r) => r.name)).toEqual(["Team"]);
    await expect(
      db.asUser(carol, "insert into saved_filters (workspace_id, user_id, entity, name) values ($1, $2, 'leads', 'Spoof')", [wsA, alice]),
    ).rejects.toThrow(/row-level security/);
  });

  it("keeps the stage history append-only", async () => {
    const { companyId, leadId } = await createCompanyWithLead(alice, wsA, "Append Only SL");
    const [deal] = await db.asUser<{ id: string }>(
      alice,
      "insert into deals (workspace_id, company_id, lead_id, title, stage_id) values ($1, $2, $3, 'Web', $4) returning id",
      [wsA, companyId, leadId, await stage(alice, wsA, "qualified")],
    );
    const deleted = await db.asUser(alice, "delete from deal_stage_history where deal_id = $1 returning id", [deal.id]);
    expect(deleted).toHaveLength(0);
  });
});

describe("pipeline triggers", () => {
  it("derives status, probability, funnel progress and history from the stage", async () => {
    const { companyId, leadId } = await createCompanyWithLead(alice, wsA, "Autoescuela Beta");
    const [deal] = await db.asUser<{ id: string; probability: number; status: string; value: string; max_stage_position: number }>(
      alice,
      "insert into deals (workspace_id, company_id, lead_id, title, stage_id, setup_value, monthly_value) values ($1, $2, $3, 'Redesign', $4, 2500, 200) returning *",
      [wsA, companyId, leadId, await stage(alice, wsA, "proposal")],
    );
    expect(deal.status).toBe("open");
    expect(deal.probability).toBe(60);
    expect(Number(deal.value)).toBe(2500 + 200 * 12);
    expect(deal.max_stage_position).toBe(6);

    const [won] = await db.asUser<{ status: string; won_at: string | null; probability: number; max_stage_position: number }>(
      alice,
      "update deals set stage_id = $2 where id = $1 returning status, won_at, probability, max_stage_position",
      [deal.id, await stage(alice, wsA, "won")],
    );
    expect(won.status).toBe("won");
    expect(won.won_at).not.toBeNull();
    expect(won.probability).toBe(100);
    expect(won.max_stage_position).toBe(8);

    const history = await db.asUser(alice, "select to_stage_id, changed_by from deal_stage_history where deal_id = $1 order by changed_at", [deal.id]);
    expect(history).toHaveLength(2);
    expect(history[1].changed_by).toBe(alice);
  });

  it("keeps the furthest stage when a deal is lost and honours explicit probabilities", async () => {
    const { companyId, leadId } = await createCompanyWithLead(alice, wsA, "Taller Gamma");
    const [deal] = await db.asUser<{ id: string }>(
      alice,
      "insert into deals (workspace_id, company_id, lead_id, title, stage_id, probability) values ($1, $2, $3, 'SEO', $4, 33) returning id",
      [wsA, companyId, leadId, await stage(alice, wsA, "meeting")],
    );
    const [check] = await db.asUser<{ probability: number }>(alice, "select probability from deals where id = $1", [deal.id]);
    expect(check.probability).toBe(33);
    const [lost] = await db.asUser<{ status: string; max_stage_position: number; probability: number }>(
      alice,
      "update deals set stage_id = $2 where id = $1 returning status, max_stage_position, probability",
      [deal.id, await stage(alice, wsA, "lost")],
    );
    expect(lost).toEqual({ status: "lost", max_stage_position: 5, probability: 0 });
  });

  it("rejects a stage from another workspace", async () => {
    const { companyId } = await createCompanyWithLead(alice, wsA, "Cross Stage SL");
    const foreignStage = (await db.admin<{ id: string }>("select id from pipeline_stages where workspace_id = $1 limit 1", [wsB]))[0].id;
    await expect(
      db.asUser(alice, "insert into deals (workspace_id, company_id, title, stage_id) values ($1, $2, 'x', $3)", [wsA, companyId, foreignStage]),
    ).rejects.toThrow();
  });
});

describe("website audit cache", () => {
  it("copies the latest completed audit onto the company", async () => {
    const { companyId } = await createCompanyWithLead(alice, wsA, "Restaurante Delta");
    await db.asUser(
      alice,
      `insert into website_audits (workspace_id, company_id, url, status, overall_score, opportunities)
       values ($1, $2, 'https://example.com', 'completed', 37, '[{"title":"No online booking"}]')`,
      [wsA, companyId],
    );
    const [company] = await db.asUser<{ website_score: number; website_top_issue: string }>(
      alice, "select website_score, website_top_issue from companies where id = $1", [companyId]);
    expect(company).toEqual({ website_score: 37, website_top_issue: "No online booking" });
    const [overview] = await db.asUser<{ website_state: string }>(alice, "select website_state from lead_overview where company_id = $1", [companyId]);
    expect(overview.website_state).toBe("weak");
  });
});

describe("analytics functions", () => {
  it("computes funnel, revenue and rates for the workspace only", async () => {
    // Fresh workspace for deterministic numbers.
    const dana = await db.createUser("dana@example.test");
    const [{ create_workspace: ws }] = await db.asUser<{ create_workspace: string }>(dana, "select create_workspace('Metrics', 'metrics')");
    const a = await createCompanyWithLead(dana, ws, "A");
    const b = await createCompanyWithLead(dana, ws, "B");
    await createCompanyWithLead(dana, ws, "C"); // stays NEW
    await db.asUser(dana, "update leads set contact_status = 'contacted' where id = $1", [b.leadId]);
    await db.asUser(
      dana,
      "insert into deals (workspace_id, company_id, lead_id, title, stage_id, setup_value, monthly_value) values ($1, $2, $3, 'Won deal', $4, 2000, 100)",
      [ws, a.companyId, a.leadId, await stage(dana, ws, "won")],
    );
    await db.asUser(
      dana,
      "insert into deals (workspace_id, company_id, lead_id, title, stage_id, setup_value) values ($1, $2, $3, 'Open deal', $4, 1000)",
      [ws, b.companyId, b.leadId, await stage(dana, ws, "proposal")],
    );

    const [{ get_dashboard_metrics: m }] = await db.asUser<{ get_dashboard_metrics: Record<string, unknown> }>(
      dana, "select get_dashboard_metrics($1)", [ws]);
    expect(m.leads_found).toBe(3);
    expect(m.leads_contacted).toBe(2);
    expect(m.proposals).toBe(2);
    expect(m.won).toBe(1);
    expect(Number(m.closed_revenue)).toBe(3200);
    expect(Number(m.mrr)).toBe(100);
    expect(Number(m.pipeline_value)).toBe(1000);
    expect(Number(m.weighted_pipeline)).toBe(600);
    expect(Number(m.conversion_rate)).toBeCloseTo(33.3, 1);
    expect(Number(m.win_rate)).toBe(100);

    const [{ get_analytics: an }] = await db.asUser<{ get_analytics: { revenue_by_city: { label: string }[]; series: unknown[]; arr: number } }>(
      dana, "select get_analytics($1, now() - interval '7 days', now() + interval '1 day')", [ws]);
    expect(an.revenue_by_city[0].label).toBe("Sevilla");
    expect(an.series.length).toBeGreaterThanOrEqual(8);
    expect(Number(an.arr)).toBe(1200);

    // Another user sees nothing for this workspace.
    const [{ get_dashboard_metrics: other }] = await db.asUser<{ get_dashboard_metrics: Record<string, unknown> }>(
      bob, "select get_dashboard_metrics($1)", [ws]);
    expect(other.leads_found).toBe(0);
    expect(Number(other.closed_revenue)).toBe(0);
  });

  it("global search finds companies by fuzzy name and respects RLS", async () => {
    const hits = await db.asUser<{ kind: string; title: string }>(alice, "select * from global_search($1, 'alfa')", [wsA]);
    expect(hits.some((h) => h.kind === "company" && h.title === "Clínica Alfa")).toBe(true);
    const none = await db.asUser(bob, "select * from global_search($1, 'alfa')", [wsA]);
    expect(none).toHaveLength(0);
    const escaped = await db.asUser(alice, "select * from global_search($1, '%')", [wsA]);
    expect(escaped).toHaveLength(0);
  });
});

describe("rate limiting", () => {
  it("allows up to the limit per user and window", async () => {
    const results: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      const [{ check_rate_limit }] = await db.asUser<{ check_rate_limit: boolean }>(alice, "select check_rate_limit('audit', 3, 60)");
      results.push(check_rate_limit);
    }
    expect(results).toEqual([true, true, true, false]);
    const [{ check_rate_limit: bobOk }] = await db.asUser<{ check_rate_limit: boolean }>(bob, "select check_rate_limit('audit', 3, 60)");
    expect(bobOk).toBe(true);
  });
});
