"use client";

import { useLocalStorageList } from "./use-local-storage-list";

export interface HistoryEntry {
  value: number;
  fromUnitId: string;
  toUnitId: string;
  result: number;
  at: number;
}

export function useConversionHistory() {
  const { items, hydrated, add, clear } = useLocalStorageList<HistoryEntry>("uc:history", 25);

  const record = (entry: Omit<HistoryEntry, "at">) => add({ ...entry, at: Date.now() });

  return { history: items, hydrated, record, clear };
}
