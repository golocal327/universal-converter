"use client";

import { useMemo, useState } from "react";
import { formatNumber } from "@/lib/format";
import { convertFuelEconomy, FUEL_ECONOMY_UNITS, type FuelEconomyUnit } from "@/lib/tools/fuel-economy";

export function FuelEconomyTool() {
  const [value, setValue] = useState("8");
  const [fromUnit, setFromUnit] = useState<FuelEconomyUnit>("l-100km");

  const results = useMemo(() => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return null;
    return FUEL_ECONOMY_UNITS.filter((u) => u.id !== fromUnit).map((u) => ({
      unit: u,
      value: convertFuelEconomy(numeric, fromUnit, u.id),
    }));
  }, [value, fromUnit]);

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Value</label>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode="decimal"
            className="h-12 w-full rounded-xl border border-border bg-background px-4 text-lg focus:border-accent focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Unit</label>
          <select
            value={fromUnit}
            onChange={(e) => setFromUnit(e.target.value as FuelEconomyUnit)}
            className="h-12 w-full rounded-xl border border-border bg-background px-3 text-sm"
          >
            {FUEL_ECONOMY_UNITS.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {results ? (
        <div className="mt-5 grid grid-cols-1 gap-3 border-t border-border pt-5 sm:grid-cols-3">
          {results.map((r) => (
            <div key={r.unit.id} className="rounded-lg bg-background px-4 py-3">
              <p className="text-xs text-muted">{r.unit.label}</p>
              <p className="text-lg font-semibold">{formatNumber(r.value, 2)}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-danger">Enter a positive number.</p>
      )}

      <p className="mt-4 text-xs text-muted">
        Fuel economy is not a linear unit conversion: L/100km is fuel-per-distance while MPG is distance-per-fuel, and US
        gallons (3.785 L) differ from Imperial gallons (4.546 L). This tool accounts for both.
      </p>
    </div>
  );
}
