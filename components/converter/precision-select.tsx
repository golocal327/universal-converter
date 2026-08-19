"use client";

import { PRECISION_OPTIONS, type PrecisionMode } from "@/lib/format";

export function PrecisionSelect({
  value,
  onChange,
}: {
  value: PrecisionMode;
  onChange: (mode: PrecisionMode) => void;
}) {
  return (
    <select
      value={String(value)}
      onChange={(e) => {
        const raw = e.target.value;
        const numeric = Number(raw);
        onChange(Number.isNaN(numeric) ? (raw as PrecisionMode) : (numeric as PrecisionMode));
      }}
      aria-label="Precision"
      className="h-9 rounded-lg border border-border bg-background px-2 text-xs font-medium text-muted focus:border-accent focus:outline-none"
    >
      {PRECISION_OPTIONS.map((option) => (
        <option key={String(option.value)} value={String(option.value)}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
