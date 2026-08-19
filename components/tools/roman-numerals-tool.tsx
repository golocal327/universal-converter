"use client";

import { useMemo, useState } from "react";
import { CopyButton } from "@/components/converter/copy-button";
import { fromRoman, toRoman } from "@/lib/tools/roman-numerals";

export function RomanNumeralsTool() {
  const [number, setNumber] = useState("1994");
  const [roman, setRoman] = useState("MCMXCIV");
  const [lastEdited, setLastEdited] = useState<"number" | "roman">("number");

  const numberResult = useMemo(() => {
    if (lastEdited !== "number") return null;
    const parsed = Number(number);
    try {
      return { value: toRoman(parsed), error: null as string | null };
    } catch (err) {
      return { value: "", error: err instanceof Error ? err.message : "Invalid number" };
    }
  }, [number, lastEdited]);

  const romanResult = useMemo(() => {
    if (lastEdited !== "roman") return null;
    try {
      return { value: fromRoman(roman), error: null as string | null };
    } catch (err) {
      return { value: 0, error: err instanceof Error ? err.message : "Invalid numeral" };
    }
  }, [roman, lastEdited]);

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Arabic number (1–3999)</label>
          <input
            value={number}
            onChange={(e) => {
              setNumber(e.target.value);
              setLastEdited("number");
            }}
            className="h-12 w-full rounded-xl border border-border bg-background px-4 text-lg focus:border-accent focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Roman numeral</label>
          <input
            value={lastEdited === "number" ? (numberResult?.value ?? "") : roman}
            onChange={(e) => {
              setRoman(e.target.value);
              setLastEdited("roman");
            }}
            className="h-12 w-full rounded-xl border border-border bg-background px-4 font-mono text-lg uppercase focus:border-accent focus:outline-none"
          />
        </div>
      </div>
      {lastEdited === "number" && numberResult?.error && <p className="mt-3 text-sm text-danger">{numberResult.error}</p>}
      {lastEdited === "roman" && romanResult?.error && <p className="mt-3 text-sm text-danger">{romanResult.error}</p>}
      {lastEdited === "roman" && !romanResult?.error && (
        <p className="mt-3 text-sm text-muted">
          = <strong className="text-foreground">{romanResult?.value}</strong>
        </p>
      )}
      <div className="mt-4">
        <CopyButton text={lastEdited === "number" ? (numberResult?.value ?? "") : String(romanResult?.value ?? "")} />
      </div>
    </div>
  );
}
