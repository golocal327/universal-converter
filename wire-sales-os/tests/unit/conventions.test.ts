import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../..");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) return f === "node_modules" || f.startsWith(".") ? [] : files(p);
    return /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
}

describe("Next.js conventions", () => {
  it('"use server" modules only export async functions (and types)', () => {
    const offenders = files(path.join(ROOT, "lib")).concat(files(path.join(ROOT, "app")))
      .filter((f) => /^\s*["']use server["']/.test(readFileSync(f, "utf8")))
      .flatMap((f) => [...readFileSync(f, "utf8").matchAll(/^export (const|let|var|class|function(?!\s*\*)(?=\s+\w+\s*\())/gm)]
        .filter((m) => m[1] !== "function" || !/^export async/.test(m.input!.slice(m.index!, m.index! + 20)))
        .map((m) => `${path.relative(ROOT, f)}: ${m.input!.slice(m.index!, m.index! + 60).split("\n")[0]}`));
    expect(offenders).toEqual([]);
  });

  it("server-only modules are never imported from client components", () => {
    const serverOnly = new Set(
      files(path.join(ROOT, "lib")).filter((f) => /import "server-only"/.test(readFileSync(f, "utf8"))).map((f) => path.relative(ROOT, f).replace(/\.tsx?$/, "")),
    );
    const offenders = files(ROOT)
      .filter((f) => /^\s*["']use client["']/.test(readFileSync(f, "utf8")))
      .flatMap((f) => [...readFileSync(f, "utf8").matchAll(/from "@\/([^"]+)"/g)].map((m) => ({ f, mod: m[1] })))
      .filter(({ mod }) => serverOnly.has(mod) || serverOnly.has(`${mod}/index`))
      .map(({ f, mod }) => `${path.relative(ROOT, f)} → ${mod}`);
    expect(offenders).toEqual([]);
  });
});
