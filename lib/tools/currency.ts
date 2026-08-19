/**
 * Currency is NOT a fixed unit conversion — exchange rates move constantly, so
 * this can never be a factor in the unit registry. This module is the
 * architecture for plugging in a live rates API (set CURRENCY_API_KEY and
 * CURRENCY_API_URL) with a manual-rates fallback so the page still works
 * (with a clearly-labeled disclaimer) when no API is configured.
 */

export const SUPPORTED_CURRENCIES = ["EUR", "USD", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "CNY"] as const;
export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

export interface CurrencyRates {
  base: CurrencyCode;
  rates: Record<string, number>;
  /** ISO timestamp of when these rates were fetched/entered. */
  updatedAt: string;
  /** false when served from the static manual fallback table, not a live API. */
  live: boolean;
}

// Illustrative fallback only — NOT kept up to date. Used solely so the tool keeps
// functioning (clearly labeled as non-live) when no API key is configured.
const MANUAL_FALLBACK_RATES: Record<string, number> = {
  EUR: 1,
  USD: 1.08,
  GBP: 0.85,
  JPY: 163,
  CHF: 0.94,
  CAD: 1.47,
  AUD: 1.62,
  NZD: 1.77,
  CNY: 7.8,
};

export async function getCurrencyRates(base: CurrencyCode = "EUR"): Promise<CurrencyRates> {
  const apiUrl = process.env.CURRENCY_API_URL;
  const apiKey = process.env.CURRENCY_API_KEY;

  if (apiUrl && apiKey) {
    try {
      const response = await fetch(`${apiUrl}?base=${base}&access_key=${apiKey}`, {
        next: { revalidate: 3600 },
      });
      if (!response.ok) throw new Error(`Currency API responded with ${response.status}`);
      const data = await response.json();
      if (data && data.rates) {
        return { base, rates: data.rates, updatedAt: new Date().toISOString(), live: true };
      }
    } catch {
      // Fall through to the manual table below — a live-API outage shouldn't break the page.
    }
  }

  return {
    base,
    rates: rebase(MANUAL_FALLBACK_RATES, base),
    updatedAt: "manual-fallback",
    live: false,
  };
}

function rebase(rates: Record<string, number>, base: CurrencyCode): Record<string, number> {
  const baseRate = rates[base] ?? 1;
  const result: Record<string, number> = {};
  for (const [code, rate] of Object.entries(rates)) {
    result[code] = rate / baseRate;
  }
  return result;
}

export function convertCurrency(amount: number, from: string, to: string, rates: CurrencyRates): number {
  const fromRate = rates.rates[from];
  const toRate = rates.rates[to];
  if (fromRate == null || toRate == null) {
    throw new Error(`Unsupported currency in this rate set: ${from} or ${to}`);
  }
  return (amount / fromRate) * toRate;
}
