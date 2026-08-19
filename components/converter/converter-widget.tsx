"use client";

import { ArrowLeftRight, Star } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();
  const router = useRouter();

  // Lazy initializers read ?value=&from=&to=&precision= once, at first render, so shared
  // links open pre-filled. This component only ever renders inside a Suspense boundary
  // (required by useSearchParams), so there's no SSR output to mismatch here — no effect needed.
  const [fromUnitId, setFromUnitId] = useState(() => {
    const urlFrom = searchParams.get("from");
    return urlFrom && units.some((u) => u.id === urlFrom) ? urlFrom : defaultFromUnitId;
  });
  const [toUnitId, setToUnitId] = useState(() => {
    const urlTo = searchParams.get("to");
    return urlTo && units.some((u) => u.id === urlTo) ? urlTo : defaultToUnitId;
  });
  const [rawValue, setRawValue] = useState(() => searchParams.get("value") ?? String(defaultValue));
  const [precision, setPrecision] = useState<PrecisionMode>(() => {
    const urlPrecision = searchParams.get("precision");
    if (!urlPrecision) return "auto";
    const numeric = Number(urlPrecision);
    return Number.isNaN(numeric) ? (urlPrecision as PrecisionMode) : (numeric as PrecisionMode);
  });
  const [showAll, setShowAll] = useState(showConvertToAll);
  const { isFavorite, toggle } = useFavorites();
  const { record } = useConversionHistory();

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
