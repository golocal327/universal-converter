import "server-only";
import { analyzeHtml, AUDIT_ENGINE_VERSION, type AuditResult } from "./analyzer";
import { safeFetch, SafeFetchError, type FetchErrorKind } from "./safe-fetch";
import { fetchLighthousePerformance } from "@/lib/integrations/pagespeed";

export type AuditRunResult =
  | {
      status: "completed";
      url: string;
      finalUrl: string;
      httpStatus: number;
      responseTimeMs: number;
      pageBytes: number;
      result: AuditResult;
      lighthouse: boolean;
      engineVersion: string;
    }
  | {
      status: "failed";
      url: string;
      finalUrl: string | null;
      httpStatus: number | null;
      error: string;
      errorKind: FetchErrorKind;
      engineVersion: string;
    };

const MAX_LINKS_TO_CHECK = 10;

async function checkLinks(base: URL, hrefs: string[], allowPrivate: boolean) {
  const internal = [
    ...new Set(
      hrefs
        .map((h) => {
          try {
            const u = new URL(h, base);
            u.hash = "";
            return u;
          } catch {
            return null;
          }
        })
        .filter((u): u is URL => Boolean(u) && (u as URL).hostname === base.hostname && /^https?:$/.test((u as URL).protocol))
        .map((u) => u.toString()),
    ),
  ].filter((u) => u !== base.toString()).slice(0, MAX_LINKS_TO_CHECK);

  const results = await Promise.all(
    internal.map(async (link) => {
      try {
        let res = await safeFetch(link, { method: "HEAD", timeoutMs: 5000, maxBytes: 1, allowPrivate });
        if (res.status === 405 || res.status === 501) res = await safeFetch(link, { timeoutMs: 6000, maxBytes: 500_000, allowPrivate });
        return res.status >= 400 ? link : null;
      } catch (error) {
        return error instanceof SafeFetchError && error.kind === "too_large" ? null : link;
      }
    }),
  );
  return { checked: internal.length, broken: results.filter((r): r is string => Boolean(r)) };
}

async function fetchText(url: string, allowPrivate: boolean): Promise<{ status: number; body: string } | null> {
  try {
    const res = await safeFetch(url, { timeoutMs: 5000, maxBytes: 500_000, allowPrivate });
    return { status: res.status, body: res.body };
  } catch {
    return null;
  }
}

export async function runWebsiteAudit(
  url: string,
  options: { bookingRelevant?: boolean; allowPrivate?: boolean; now?: Date } = {},
): Promise<AuditRunResult> {
  const allowPrivate = options.allowPrivate ?? false;
  let page;
  try {
    page = await safeFetch(url, { allowPrivate });
  } catch (error) {
    const e = error instanceof SafeFetchError ? error : new SafeFetchError("network", String(error));
    return { status: "failed", url, finalUrl: null, httpStatus: null, error: e.message, errorKind: e.kind, engineVersion: AUDIT_ENGINE_VERSION };
  }
  if (page.status >= 400) {
    const kind: FetchErrorKind = page.status === 401 || page.status === 403 ? "blocked" : "http";
    return {
      status: "failed",
      url,
      finalUrl: page.url,
      httpStatus: page.status,
      error: `The website answered HTTP ${page.status}`,
      errorKind: kind,
      engineVersion: AUDIT_ENGINE_VERSION,
    };
  }

  const finalUrl = new URL(page.url);
  const origin = finalUrl.origin;
  const hrefs = [...page.body.matchAll(/<a\s[^>]*href\s*=\s*["']([^"'#]+)["']/gi)].map((m) => m[1]);

  const [robots, links, lighthouse] = await Promise.all([
    fetchText(`${origin}/robots.txt`, allowPrivate),
    checkLinks(finalUrl, hrefs, allowPrivate),
    fetchLighthousePerformance(page.url),
  ]);
  const robotsTxt = robots && robots.status < 400 && !/<html/i.test(robots.body) ? robots.body : null;
  let sitemapFound = Boolean(robotsTxt && /^sitemap:/im.test(robotsTxt));
  if (!sitemapFound) {
    const sitemap = await fetchText(`${origin}/sitemap.xml`, allowPrivate);
    sitemapFound = Boolean(sitemap && sitemap.status < 400 && /<(urlset|sitemapindex)/i.test(sitemap.body));
  }

  const result = analyzeHtml({
    html: page.body,
    finalUrl: page.url,
    status: page.status,
    headers: page.headers,
    responseTimeMs: page.timeMs,
    bytes: page.bytes,
    robotsTxt,
    sitemapFound,
    brokenLinks: links,
    bookingRelevant: options.bookingRelevant,
    lighthousePerformance: lighthouse,
    now: options.now,
  });

  return {
    status: "completed",
    url,
    finalUrl: page.url,
    httpStatus: page.status,
    responseTimeMs: page.timeMs,
    pageBytes: page.bytes,
    result,
    lighthouse: lighthouse !== null,
    engineVersion: AUDIT_ENGINE_VERSION,
  };
}
