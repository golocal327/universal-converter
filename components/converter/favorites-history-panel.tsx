"use client";

import { Star, Trash2 } from "lucide-react";
import Link from "next/link";
import { formatNumber } from "@/lib/format";
import { useFavorites } from "@/lib/hooks/use-favorites";
import { useConversionHistory } from "@/lib/hooks/use-history";
import { slugForPair } from "@/lib/search-index";
import { getUnit } from "@/lib/units/registry";

export function FavoritesHistoryPanel() {
  const { favorites, hydrated: favoritesHydrated, toggle } = useFavorites();
  const { history, hydrated: historyHydrated, clear } = useConversionHistory();

  if (!favoritesHydrated && !historyHydrated) return null;
  if (favorites.length === 0 && history.length === 0) return null;

  return (
    <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
      {favorites.length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted">
            <Star size={14} /> Favorites
          </h2>
          <ul className="space-y-1.5">
            {favorites.map((f) => {
              const from = getUnit(f.fromUnitId);
              const to = getUnit(f.toUnitId);
              if (!from || !to) return null;
              return (
                <li key={`${f.fromUnitId}-${f.toUnitId}`} className="flex items-center justify-between rounded-lg bg-surface px-3 py-2 text-sm">
                  <Link href={`/converters/${slugForPair(from.id, to.id)}`} className="hover:text-accent">
                    {from.name} → {to.name}
                  </Link>
                  <button onClick={() => toggle(f.fromUnitId, f.toUnitId)} aria-label="Remove favorite" className="text-muted hover:text-danger">
                    <Trash2 size={14} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {history.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted">Recent conversions</h2>
            <button onClick={clear} className="text-xs text-muted hover:text-danger">
              Clear
            </button>
          </div>
          <ul className="space-y-1.5">
            {history.slice(0, 8).map((h) => {
              const from = getUnit(h.fromUnitId);
              const to = getUnit(h.toUnitId);
              if (!from || !to) return null;
              return (
                <li key={h.at} className="rounded-lg bg-surface px-3 py-2 text-sm">
                  <Link href={`/converters/${slugForPair(from.id, to.id)}?value=${h.value}`} className="hover:text-accent">
                    {formatNumber(h.value, "auto")} {from.symbol} = {formatNumber(h.result, "auto")} {to.symbol}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
