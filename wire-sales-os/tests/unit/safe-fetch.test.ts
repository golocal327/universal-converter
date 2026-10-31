import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isPrivateAddress, safeFetch, SafeFetchError } from "@/lib/audit/safe-fetch";

let server: http.Server;
let base: string;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.url === "/redirect") {
      res.writeHead(302, { location: "/final" });
      return res.end();
    }
    if (req.url === "/big") {
      res.writeHead(200, { "content-type": "text/html" });
      return res.end("x".repeat(50_000));
    }
    if (req.url === "/slow") return setTimeout(() => res.end("late"), 2_000);
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end("<html><title>ok</title></html>");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe("isPrivateAddress", () => {
  it("classifies reserved ranges", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ["8.8.8.8", "151.101.1.1", "2606:4700::1111"]) expect(isPrivateAddress(ip), ip).toBe(false);
  });
});

describe("safeFetch", () => {
  it("blocks hosts that resolve to private addresses (SSRF)", async () => {
    await expect(safeFetch("http://localhost/")).rejects.toMatchObject({ kind: "blocked", message: expect.stringContaining("private") });
    await expect(safeFetch("http://169.254.169.254/latest/meta-data/")).rejects.toMatchObject({ kind: "blocked" });
  });

  it("rejects non-http schemes, credentials and custom ports", async () => {
    await expect(safeFetch("file:///etc/passwd")).rejects.toBeInstanceOf(SafeFetchError);
    await expect(safeFetch("https://user:pass@example.com")).rejects.toMatchObject({ kind: "invalid_url" });
    await expect(safeFetch("https://example.com:8443/")).rejects.toMatchObject({ kind: "blocked" });
  });

  it("follows redirects, enforces size and time limits (private allowed for tests only)", async () => {
    const page = await safeFetch(`${base}/redirect`, { allowPrivate: true });
    expect(page.status).toBe(200);
    expect(page.url).toBe(`${base}/final`);
    expect(page.redirects).toHaveLength(1);
    expect(page.body).toContain("<title>ok</title>");
    await expect(safeFetch(`${base}/big`, { allowPrivate: true, maxBytes: 1000 })).rejects.toMatchObject({ kind: "too_large" });
    await expect(safeFetch(`${base}/slow`, { allowPrivate: true, timeoutMs: 300 })).rejects.toMatchObject({ kind: "timeout" });
  });
});
