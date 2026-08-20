"use client";

import { ArrowLeftRight, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CopyButton } from "@/components/converter/copy-button";
import { PrecisionSelect } from "@/components/converter/precision-select";
import { UnitSelect } from "@/components/converter/unit-select";
import { convert, convertToAll } from "@/lib/convert";
import { formatNumber, parseLocaleNumber, type PrecisionMode } from "@/lib/format";
import { useFavorites } from "@/lib/hooks/use-favorites";
import { useConversionHistory } from "@/lib/hooks/use-history";
import { getUnitsInCategory } from "@/lib/units/registry";
import { cn } from "@/lib/utils";

export function ConverterWidget({
  categoryId,
  defaultFromUnitId,
  defaultToUnitId,
  defaultValue = 1,
  showConvertToAll = false,
}: {
  categoryId: string;
  defaultFromUnitId: string;
  defaultToUnitId: string;
  defaultValue?: number;
  showConvertToAll?: boolean;
}) {
  const units = useMemo(() => getUnitsInCategory(categoryId), [categoryId]);
  const router = useRouter();

  // Plain defaults keep server and first-client render identical (no hydration
  // mismatch, no Suspense/dynamic-API requirement). Shared-link values
  // (?value=&from=&to=&precision=) are picked up from window.location right
  // after mount instead — deliberately NOT via next/navigation's
  // useSearchParams(), which forces this component's whole subtree through
  // Next's dynamic-API Suspense/streaming-reveal machinery. That machinery is
  // what produced an unreliable "content never reveals" failure in local dev
  // (next dev / Turbopack) — the production build was unaffected, but reading
  // the URL by hand sidesteps the framework code path entirely and is just as
  // correct for a purely client-interactive widget like this one.
  const [fromUnitId, setFromUnitId] = useState(defaultFromUnitId);
  const [toUnitId, setToUnitId] = useState(defaultToUnitId);
  const [rawValue, setRawValue] = useState(String(defaultValue));
  const [precision, setPrecision] = useState<PrecisionMode>("auto");
  const [showAll, setShowAll] = useState(showConvertToAll);
  const { isFavorite, toggle } = useFavorites();
  const { record } = useConversionHistory();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlFrom = params.get("from");
    const urlTo = params.get("to");
    const urlValue = params.get("value");
    const urlPrecision = params.get("precision");
    if (!urlFrom && !urlTo && !urlValue && !urlPrecision) return;

    /* eslint-disable react-hooks/set-state-in-effect */
    if (urlFrom && units.some((u) => u.id === urlFrom)) setFromUnitId(urlFrom);
    if (urlTo && units.some((u) => u.id === urlTo)) setToUnitId(urlTo);
    if (urlValue) setRawValue(urlValue);
    if (urlPrecision) {
      const numeric = Number(urlPrecision);
      setPrecision(Number.isNaN(numeric) ? (urlPrecision as PrecisionMode) : (numeric as PrecisionMode));
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    // Intentionally run only once on mount — this hydrates from a shared URL, not user edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const numericValue = parseLocaleNumber(rawValue);

  const conversion = useMemo(() => {
    if (numericValue === null) return null;
    try {
      return convert(numericValue, fromUnitId, toUnitId);
    } catch {
      return null;
    }
  }, [numericValue, fromUnitId, toUnitId]);

  const allResults = useMemo(() => {
    if (!showAll || numericValue === null) return [];
    try {
      return convertToAll(numericValue, fromUnitId);
    } catch {
      return [];
    }
  }, [showAll, numericValue, fromUnitId]);

  useEffect(() => {
    if (!conversion) return;
    const timeout = setTimeout(() => {
      record({ value: conversion.value, fromUnitId: conversion.fromUnit.id, toUnitId: conversion.toUnit.id, result: conversion.result });
    }, 800);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversion?.value, conversion?.fromUnit.id, conversion?.toUnit.id]);

  function handleSwap() {
    setFromUnitId(toUnitId);
    setToUnitId(fromUnitId);
  }

  function shareUrl() {
    const params = new URLSearchParams({
      value: rawValue,
      from: fromUnitId,
      to: toUnitId,
      precision: String(precision),
    });
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false });
    return url;
  }

  const resultText = conversion ? formatNumber(conversion.result, precision) : "—";

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <div className="space-y-1.5">
          <input
            type="text"
            inputMode="decimal"
            value={rawValue}
            onChange={(e) => setRawValue(e.target.value)}
            className="h-14 w-full rounded-xl border border-border bg-background px-4 text-2xl font-semibold focus:border-accent focus:outline-none"
            aria-label="Value"
          />
          <UnitSelect units={units} value={fromUnitId} onChange={setFromUnitId} label="From unit" />
        </div>

        <button
          type="button"
          onClick={handleSwap}
          aria-label="Swap units"
          className="mx-auto flex size-11 items-center justify-center rounded-full border border-border bg-background text-muted transition-colors hover:border-accent hover:text-accent sm:rotate-0"
        >
          <ArrowLeftRight size={18} />
        </button>

        <div className="space-y-1.5">
          <div
            className={cn(
              "flex h-14 items-center rounded-xl border border-border bg-background px-4 text-2xl font-semibold",
              !conversion && "text-muted"
            )}
          >
            {resultText}
          </div>
          <UnitSelect units={units} value={toUnitId} onChange={setToUnitId} label="To unit" />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <PrecisionSelect value={precision} onChange={setPrecision} />
          {showConvertToAll && (
            <button
              type="button"
              onClick={() => setShowAll((s) => !s)}
              className="h-9 rounded-lg border border-border px-3 text-xs font-medium hover:border-accent hover:text-accent"
            >
              {showAll ? "Hide all units" : "Convert to all units"}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => toggle(fromUnitId, toUnitId)}
            aria-pressed={isFavorite(fromUnitId, toUnitId)}
            aria-label="Toggle favorite"
            className={cn(
              "flex size-9 items-center justify-center rounded-lg border border-border hover:border-accent",
              isFavorite(fromUnitId, toUnitId) && "border-accent text-accent"
            )}
          >
            <Star size={16} fill={isFavorite(fromUnitId, toUnitId) ? "currentColor" : "none"} />
          </button>
          <CopyButton text={conversion ? `${resultText} ${conversion.toUnit.symbol}` : ""} />
          <button
            type="button"
            onClick={() => {
              const url = shareUrl();
              navigator.clipboard?.writeText(url).catch(() => {});
            }}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:border-accent hover:text-accent"
          >
            Share
          </button>
        </div>
      </div>

      {conversion && (
        <p className="mt-3 text-sm text-muted">
          {formatNumber(conversion.value, "auto")} {conversion.fromUnit.symbol} = {resultText} {conversion.toUnit.symbol}
        </p>
      )}
      {numericValue === null && rawValue.trim() !== "" && (
        <p className="mt-3 text-sm text-danger">Enter a valid number.</p>
      )}

      {showAll && allResults.length > 0 && (
        <div className="mt-5 grid grid-cols-2 gap-2 border-t border-border pt-5 sm:grid-cols-3">
          {allResults.map((r) => (
            <div key={r.toUnit.id} className="rounded-lg bg-background px-3 py-2">
              <p className="text-sm font-semibold">
                {formatNumber(r.result, precision)} <span className="text-xs text-muted">{r.toUnit.symbol}</span>
              </p>
              <p className="text-xs text-muted">{r.toUnit.name}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
