"use client";

import { useLocalStorageList } from "./use-local-storage-list";

export interface FavoriteConversion {
  fromUnitId: string;
  toUnitId: string;
  addedAt: number;
}

const key = (f: Pick<FavoriteConversion, "fromUnitId" | "toUnitId">) => `${f.fromUnitId}:${f.toUnitId}`;

export function useFavorites() {
  const { items, hydrated, add, remove } = useLocalStorageList<FavoriteConversion>("uc:favorites", 50);

  const isFavorite = (fromUnitId: string, toUnitId: string) =>
    items.some((f) => f.fromUnitId === fromUnitId && f.toUnitId === toUnitId);

  const toggle = (fromUnitId: string, toUnitId: string) => {
    if (isFavorite(fromUnitId, toUnitId)) {
      remove((f) => key(f) === key({ fromUnitId, toUnitId }));
    } else {
      add({ fromUnitId, toUnitId, addedAt: Date.now() }, key);
    }
  };

  return { favorites: items, hydrated, isFavorite, toggle };
}
