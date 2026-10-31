import { afterEach, describe, expect, it, vi } from "vitest";
import { signPayload, verifySignature } from "@/lib/events/sign";
import { matchSector } from "@/lib/lead-pipeline/sector-match";
import { prospectInsights } from "@/lib/lead-pipeline/prospect-insights";
import { formatNumberEs } from "@/lib/outreach/context";
import { scoreLead } from "@/lib/scoring/engine";
import { safeNextPath } from "@/lib/safe-redirect";
import { parseSettings } from "@/lib/settings/schema";

describe("webhook signatures", () => {
  it("signs and verifies with timestamp tolerance", () => {
    const body = JSON.stringify({ type: "deal.won" });
    const header = signPayload("whsec_test", body, 1_700_000_000);
    expect(verifySignature("whsec_test", body, header, 300, 1_700_000_100)).toBe(true);
    expect(verifySignature("whsec_test", `${body} `, header, 300, 1_700_000_100)).toBe(false);
    expect(verifySignature("other", body, header, 300, 1_700_000_100)).toBe(false);
    expect(verifySignature("whsec_test", body, header, 300, 1_700_001_000)).toBe(false);
  });
});

describe("sector matching", () => {
  const sectors = [
    { id: "1", name: "Autoescuelas", slug: "autoescuelas", keywords: ["autoescuela", "driving school"] },
    { id: "2", name: "Clínicas", slug: "clinicas", keywords: ["clinica", "dentista", "dentist"] },
  ];
  it("matches names, slugs, plurals and Google-style categories", () => {
    expect(matchSector("Autoescuela", sectors)?.id).toBe("1");
    expect(matchSector("driving_school", sectors)?.id).toBe("1");
    expect(matchSector("Clínica dental", sectors)?.id).toBe("2");
    expect(matchSector("dentist", sectors)?.id).toBe("2");
    expect(matchSector("Ferretería", sectors)).toBeNull();
    expect(matchSector(null, sectors)).toBeNull();
  });
});

describe("prospect insights", () => {
  it("summarizes the opportunity and next action", () => {
    const lead = { website: null, phone: "+34600000000", email: null, google_reviews_count: 320, google_rating: 4.6 };
    const score = scoreLead({ company: lead, sector: { value_tier: "high" } });
    const i = prospectInsights(lead, score);
    expect(i.biggestOpportunity).toBe("No website despite 320 reviews");
    expect(i.recommendedAction).toMatch(/^Call/);
  });
});

describe("formatting and safety helpers", () => {
  it("formats numbers the Spanish way for client-facing copy", () => {
    expect(formatNumberEs(1240)).toBe("1.240");
    expect(formatNumberEs(4.5)).toBe("4,5");
    expect(formatNumberEs(12000)).toBe("12.000");
  });

  it("only allows same-origin relative redirects", () => {
    expect(safeNextPath("/leads?priority=hot")).toBe("/leads?priority=hot");
    expect(safeNextPath("//evil.com")).toBe("/");
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(safeNextPath("/\\evil.com")).toBe("/");
    expect(safeNextPath("/login")).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
  });

  it("parses settings documents with safe defaults", () => {
    const s = parseSettings({ scoring: { hotThreshold: 80 }, ai: { provider: "nope" }, automation: null });
    expect(s.scoring).toEqual({ targetLocations: [], hotThreshold: 80, warmThreshold: 50 });
    expect(s.ai.provider).toBe("auto");
    expect(s.automation.webhookUrl).toBe("");
  });
});

describe("AI provider selection", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("throws a configuration error without keys and prefers Anthropic when both exist", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    const ai = await import("@/lib/ai");
    expect(ai.isAIConfigured()).toBe(false);
    expect(() => ai.getAIProvider()).toThrow(ai.AINotConfiguredError);

    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    expect(ai.getAIProvider().id).toBe("anthropic");
    expect(ai.getAIProvider().model).toBe("claude-opus-5-5");
    expect(ai.getAIProvider("openai").id).toBe("openai");
    expect(ai.getAIProvider("anthropic", "claude-sonnet-5-5").model).toBe("claude-sonnet-5-5");
  });
});
