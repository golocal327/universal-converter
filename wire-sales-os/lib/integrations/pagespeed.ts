import "server-only";

/**
 * Google PageSpeed Insights v5 adapter (optional).
 * Docs: https://developers.google.com/speed/docs/insights/rest/v5/pagespeedapi/runpagespeed
 * Returns the Lighthouse mobile performance score as 0–100, or null when the
 * integration is not configured or the call fails (the audit then falls back
 * to its own server-side performance heuristics).
 */
const ENDPOINT = "https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed";

export function isPagespeedConfigured() {
  return Boolean(process.env.GOOGLE_PAGESPEED_API_KEY);
}

export async function fetchLighthousePerformance(url: string, timeoutMs = 25_000): Promise<number | null> {
  const key = process.env.GOOGLE_PAGESPEED_API_KEY;
  if (!key) return null;
  const params = new URLSearchParams({ url, strategy: "mobile", category: "performance", key });
  try {
    const res = await fetch(`${ENDPOINT}?${params}`, { signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as { lighthouseResult?: { categories?: { performance?: { score?: number | null } } } };
    const score = json.lighthouseResult?.categories?.performance?.score;
    return typeof score === "number" ? Math.round(score * 100) : null;
  } catch {
    return null;
  }
}
