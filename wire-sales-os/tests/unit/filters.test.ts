import { describe, expect, it } from "vitest";
import { activeFilterCount, applyLeadFilters, leadFiltersToQuery, parseLeadFilters, sanitizeSearch } from "@/lib/filters/leads";

function recorder() {
  const calls: [string, ...unknown[]][] = [];
  const q: Record<string, (...args: unknown[]) => unknown> = {};
  for (const m of ["eq", "gte", "lte", "ilike", "or", "is", "contains", "order", "range"]) {
    q[m] = (...args: unknown[]) => { calls.push([m, ...args]); return q; };
  }
  return { q: q as never, calls };
}

describe("lead filters", () => {
  it("parses search params, coercing numbers and ignoring invalid keys", () => {
    const f = parseLeadFilters({ min_score: "75", max_website_score: "50", sector: "not-a-uuid", priority: "hot", page: "2", per: "25", stage: "all" });
    expect(f).toMatchObject({ min_score: 75, max_website_score: 50, priority: "hot", page: 2, per: 25 });
    expect(f.sector).toBeUndefined();
    expect(f.stage).toBeUndefined();
    expect(activeFilterCount(f)).toBe(3);
  });

  it("builds the saved-filter example: Score > 75, Website Score < 50, Sector = Healthcare", () => {
    const sector = "7c1e8a40-5d1b-4b8f-9a0e-2f1a3b4c5d6e";
    const f = parseLeadFilters({ min_score: "76", max_website_score: "49", sector, city: "Sevilla" });
    const { q, calls } = recorder();
    applyLeadFilters(q, f);
    expect(calls).toContainEqual(["gte", "score", 76]);
    expect(calls).toContainEqual(["lte", "website_score", 49]);
    expect(calls).toContainEqual(["eq", "sector_id", sector]);
    expect(calls).toContainEqual(["ilike", "city", "Sevilla"]);
    expect(calls.at(-1)).toEqual(["range", 0, 49]);
  });

  it("sanitizes free-text search so it cannot inject PostgREST filter syntax", () => {
    expect(sanitizeSearch("acme),id.eq.(1")).toBe("acme id.eq. 1");
    const { q, calls } = recorder();
    applyLeadFilters(q, parseLeadFilters({ q: "foo,bar" }));
    const or = calls.find((c) => c[0] === "or");
    expect(String(or?.[1])).not.toContain("foo,bar");
  });

  it("round-trips to a query string", () => {
    expect(leadFiltersToQuery({ min_score: 75, priority: "hot", q: undefined })).toBe("min_score=75&priority=hot");
  });
});
