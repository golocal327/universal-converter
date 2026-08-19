"use client";

import { useEffect, useState } from "react";
import { formatNumber } from "@/lib/format";
import { convertCurrency, SUPPORTED_CURRENCIES, type CurrencyRates } from "@/lib/tools/currency";

export function CurrencyTool() {
  const [rates, setRates] = useState<CurrencyRates | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("100");
  const [from, setFrom] = useState("USD");
  const [to, setTo] = useState("EUR");

  useEffect(() => {
    fetch("/api/currency?base=EUR")
      .then((res) => res.json())
      .then(setRates)
      .catch(() => setRates(null))
      .finally(() => setLoading(false));
  }, []);

  const numericAmount = Number(amount);
  const result = rates && Number.isFinite(numericAmount) ? convertCurrency(numericAmount, from, to, rates) : null;

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      {!loading && rates && !rates.live && (
        <p className="mb-4 rounded-lg border border-dashed border-border bg-background px-3 py-2 text-xs text-muted">
          Showing illustrative manual rates — no live currency API is configured (set CURRENCY_API_KEY and
          CURRENCY_API_URL to enable live rates). Do not use these figures for real transactions.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto_1fr]">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Amount</label>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-12 w-full rounded-xl border border-border bg-background px-4 text-lg focus:border-accent focus:outline-none"
          />
          <select value={from} onChange={(e) => setFrom(e.target.value)} className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm">
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="hidden items-center justify-center sm:flex">→</div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Result</label>
          <div className="flex h-12 items-center rounded-xl border border-border bg-background px-4 text-lg font-semibold">
            {loading ? "…" : result !== null ? formatNumber(result, 2) : "—"}
          </div>
          <select value={to} onChange={(e) => setTo(e.target.value)} className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm">
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {rates && (
        <p className="mt-4 text-xs text-muted">
          {rates.live ? `Live rates fetched ${rates.updatedAt}.` : "Rates are static placeholders, not live market data."}
        </p>
      )}
    </div>
  );
}
