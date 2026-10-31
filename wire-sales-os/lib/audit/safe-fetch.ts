import "server-only";
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import zlib from "node:zlib";

/**
 * SSRF-safe HTTP client for auditing third-party websites.
 *
 * - Only http/https on default ports.
 * - Every DNS answer is checked against private/reserved ranges, and the
 *   socket connects to the *validated* address (no DNS-rebinding window).
 * - Manual redirects (each hop re-validated), hard timeout, response size cap.
 */

export type FetchErrorKind = "invalid_url" | "dns" | "blocked" | "timeout" | "network" | "too_large" | "http";

export class SafeFetchError extends Error {
  constructor(
    public kind: FetchErrorKind,
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "SafeFetchError";
  }
}

export type SafeFetchOptions = {
  method?: "GET" | "HEAD";
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  /** Tests only: allow loopback/private targets. */
  allowPrivate?: boolean;
};

export type SafeFetchResponse = {
  requestedUrl: string;
  url: string;
  status: number;
  headers: Record<string, string>;
  body: string;
  bytes: number;
  timeMs: number;
  redirects: string[];
};

const USER_AGENT = "Mozilla/5.0 (compatible; WIRE-SalesOS-Audit/1.0; +https://wire.agency/bot)";

export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === "::" || lower === "::1") return true;
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(lower);
  }
  return true;
}

function validateUrl(raw: string, allowPrivate = false): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SafeFetchError("invalid_url", "Invalid URL");
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new SafeFetchError("invalid_url", "Only http(s) URLs can be audited");
  if (!allowPrivate && url.port && !["80", "443"].includes(url.port)) throw new SafeFetchError("blocked", "Non-standard ports are not allowed");
  if (url.username || url.password) throw new SafeFetchError("invalid_url", "Credentials in URLs are not allowed");
  return url;
}

function makeLookup(allowPrivate: boolean): net.LookupFunction {
  return (hostname, options, callback) => {
    dns.lookup(hostname, { all: true }, (err, addresses) => {
      if (err) return callback(err, "", 0);
      const safe = addresses.filter((a) => allowPrivate || !isPrivateAddress(a.address));
      if (!safe.length) {
        const blocked = Object.assign(new Error(`Blocked private address for ${hostname}`), { code: "EBLOCKED" });
        return callback(blocked, "", 0);
      }
      if ((options as { all?: boolean }).all) {
        return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, safe);
      }
      callback(null, safe[0].address, safe[0].family);
    });
  };
}

function decode(buffer: Buffer, encoding: string | undefined): Buffer {
  switch ((encoding ?? "").toLowerCase()) {
    case "gzip":
    case "x-gzip":
      return zlib.gunzipSync(buffer);
    case "deflate":
      return zlib.inflateSync(buffer);
    case "br":
      return zlib.brotliDecompressSync(buffer);
    default:
      return buffer;
  }
}

function charsetOf(contentType: string | undefined): string {
  const match = contentType?.match(/charset=([^;]+)/i);
  return match ? match[1].trim().toLowerCase() : "utf-8";
}

function requestOnce(url: URL, opts: Required<SafeFetchOptions>, deadline: number) {
  return new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }>((resolve, reject) => {
    const lib = url.protocol === "https:" ? https : http;
    const remaining = deadline - Date.now();
    if (remaining <= 0) return reject(new SafeFetchError("timeout", "Timed out"));
    // Settle exactly once: destroying a socket can emit late 'end'/'error' events.
    let settled = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const req = lib.request(
      url,
      {
        method: opts.method,
        lookup: makeLookup(opts.allowPrivate),
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.5",
          "accept-encoding": "gzip, deflate, br",
          "accept-language": "es-ES,es;q=0.9,en;q=0.8",
        },
        timeout: remaining,
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          if (settled) return;
          size += chunk.length;
          if (size > opts.maxBytes) {
            fail(new SafeFetchError("too_large", "Response too large"));
            res.destroy();
            req.destroy();
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => {
          if (settled) return;
          settled = true;
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) });
        });
        res.on("error", (err) => fail(new SafeFetchError("network", err.message)));
      },
    );
    req.on("timeout", () => {
      fail(new SafeFetchError("timeout", "Timed out"));
      req.destroy();
    });
    req.on("error", (err: NodeJS.ErrnoException) => {
      if (err instanceof SafeFetchError) return fail(err);
      if (err.code === "EBLOCKED") return fail(new SafeFetchError("blocked", "Target resolves to a private address"));
      if (err.code === "ENOTFOUND" || err.code === "EAI_AGAIN") return fail(new SafeFetchError("dns", "Domain does not resolve"));
      if (err.code === "ETIMEDOUT") return fail(new SafeFetchError("timeout", "Timed out"));
      fail(new SafeFetchError("network", err.message));
    });
    req.end();
  });
}

export async function safeFetch(rawUrl: string, options: SafeFetchOptions = {}): Promise<SafeFetchResponse> {
  const opts: Required<SafeFetchOptions> = {
    method: options.method ?? "GET",
    timeoutMs: options.timeoutMs ?? 12_000,
    maxBytes: options.maxBytes ?? 3_000_000,
    maxRedirects: options.maxRedirects ?? 5,
    allowPrivate: options.allowPrivate ?? false,
  };
  const started = Date.now();
  const deadline = started + opts.timeoutMs;
  const redirects: string[] = [];
  let url = validateUrl(rawUrl, opts.allowPrivate);

  for (let hop = 0; hop <= opts.maxRedirects; hop++) {
    if (!opts.allowPrivate && net.isIP(url.hostname) && isPrivateAddress(url.hostname)) {
      throw new SafeFetchError("blocked", "Private addresses cannot be audited");
    }
    const res = await requestOnce(url, opts, deadline);
    const location = res.headers.location;
    if ([301, 302, 303, 307, 308].includes(res.status) && location) {
      redirects.push(url.toString());
      url = validateUrl(new URL(location, url).toString(), opts.allowPrivate);
      continue;
    }
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(res.headers)) if (v !== undefined) headers[k] = Array.isArray(v) ? v.join(", ") : v;
    let decoded: Buffer;
    try {
      decoded = decode(res.body, headers["content-encoding"]);
    } catch {
      decoded = res.body;
    }
    let body: string;
    try {
      body = new TextDecoder(charsetOf(headers["content-type"])).decode(decoded);
    } catch {
      body = decoded.toString("utf8");
    }
    return {
      requestedUrl: rawUrl,
      url: url.toString(),
      status: res.status,
      headers,
      body,
      bytes: decoded.length,
      timeMs: Date.now() - started,
      redirects,
    };
  }
  throw new SafeFetchError("network", "Too many redirects");
}
