import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";

export type FunnelRow = { key: string; name: string; count: number };
export type RevenueRow = { label: string; revenue: number; mrr: number; deals: number };
export type SeriesRow = { day: string; contacts: number; replies: number; meetings: number; proposals: number; sales: number };

export type Analytics = {
  funnel: FunnelRow[];
  revenue_by_sector: RevenueRow[];
  revenue_by_campaign: RevenueRow[];
  revenue_by_city: RevenueRow[];
  revenue_by_service: RevenueRow[];
  closed_revenue: number;
  one_time_revenue: number;
  avg_deal_size: number;
  deals_won: number;
  deals_lost: number;
  win_rate: number;
  mrr: number;
  arr: number;
  series: SeriesRow[];
};

export type DashboardMetrics = {
  leads_found: number; leads_qualified: number; leads_contacted: number; replies: number; meetings: number; proposals: number;
  won: number; lost: number; open_deals: number; pipeline_value: number; weighted_pipeline: number; closed_revenue: number;
  one_time_revenue: number; new_mrr: number; mrr: number; avg_deal_size: number; conversion_rate: number; win_rate: number; funnel: FunnelRow[];
};

const num = (v: unknown) => Number(v ?? 0);

export async function getAnalytics(supabase: ServerSupabase, workspaceId: string, from: Date, to: Date): Promise<Analytics> {
  const { data, error } = await supabase.rpc("get_analytics", { p_workspace_id: workspaceId, p_from: from.toISOString(), p_to: to.toISOString() });
  if (error) throw new Error(error.message);
  const a = data as unknown as Analytics;
  const rev = (rows: RevenueRow[]) => (rows ?? []).map((r) => ({ ...r, revenue: num(r.revenue), mrr: num(r.mrr), deals: num(r.deals) }));
  return {
    ...a,
    revenue_by_sector: rev(a.revenue_by_sector), revenue_by_campaign: rev(a.revenue_by_campaign), revenue_by_city: rev(a.revenue_by_city), revenue_by_service: rev(a.revenue_by_service),
    closed_revenue: num(a.closed_revenue), one_time_revenue: num(a.one_time_revenue), avg_deal_size: num(a.avg_deal_size), win_rate: num(a.win_rate), mrr: num(a.mrr), arr: num(a.arr),
  };
}

export async function getDashboardMetrics(supabase: ServerSupabase, workspaceId: string, from?: Date): Promise<DashboardMetrics> {
  const { data, error } = await supabase.rpc("get_dashboard_metrics", { p_workspace_id: workspaceId, ...(from ? { p_from: from.toISOString() } : {}) });
  if (error) throw new Error(error.message);
  const m = data as unknown as Record<string, unknown>;
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, k === "funnel" ? v : num(v)])) as unknown as DashboardMetrics;
}

export const RANGES = { "7d": 7, "30d": 30, "90d": 90, "365d": 365 } as const;
export type RangeKey = keyof typeof RANGES;

export function resolveRange(value: unknown): { key: RangeKey; from: Date; to: Date } {
  const key = (typeof value === "string" && value in RANGES ? value : "30d") as RangeKey;
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  const from = new Date(to.getTime() - RANGES[key] * 86_400_000 + 1);
  from.setHours(0, 0, 0, 0);
  return { key, from, to };
}
