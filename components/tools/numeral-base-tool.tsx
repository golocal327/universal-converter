"use client";

import { useMemo, useState } from "react";
import { CopyButton } from "@/components/converter/copy-button";
import { COMMON_BASES, convertBase } from "@/lib/tools/numeral-base";

export function NumeralBaseTool() {
  const [input, setInput] = useState("255");
  const [fromBase, setFromBase] = useState(10);
  const [toBase, setToBase] = useState(16);

  const result = useMemo(() => {
    try {
      return { value: convertBase(input, fromBase, toBase), error: null as string | null };
    } catch (err) {
      return { value: "", error: err instanceof Error ? err.message : "Invalid input" };
    }
  }, [input, fromBase, toBase]);

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Value</label>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="h-12 w-full rounded-xl border border-border bg-background px-4 font-mono text-lg focus:border-accent focus:outline-none"
          />
          <select
            value={fromBase}
            onChange={(e) => setFromBase(Number(e.target.value))}
            className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
          >
            {COMMON_BASES.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Result</label>
          <div className="flex h-12 items-center rounded-xl border border-border bg-background px-4 font-mono text-lg">
            {result.error ? <span className="text-sm text-danger">{result.error}</span> : result.value}
          </div>
          <select
            value={toBase}
            onChange={(e) => setToBase(Number(e.target.value))}
            className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
          >
            {COMMON_BASES.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {!result.error && (
        <div className="mt-4">
          <CopyButton text={result.value} />
        </div>
      )}
    </div>
  );
}
