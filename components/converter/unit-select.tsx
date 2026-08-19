"use client";

import { ChevronDown } from "lucide-react";
import type { UnitDefinition } from "@/lib/units/types";

export function UnitSelect({
  units,
  value,
  onChange,
  label,
}: {
  units: UnitDefinition[];
  value: string;
  onChange: (unitId: string) => void;
  label: string;
}) {
  const bySystem = groupBySystem(units);

  return (
    <div className="relative">
      <label className="sr-only">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full appearance-none rounded-xl border border-border bg-background px-3 pr-9 text-sm font-medium focus:border-accent focus:outline-none"
      >
        {Object.entries(bySystem).map(([system, systemUnits]) => (
          <optgroup key={system} label={system}>
            {systemUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name} ({unit.symbol})
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted" />
    </div>
  );
}

const SYSTEM_LABELS: Record<string, string> = {
  si: "SI",
  metric: "Metric",
  imperial: "Imperial",
  us: "US Customary",
  uk: "UK / Imperial",
  natural: "Natural",
  other: "Other",
};

function groupBySystem(units: UnitDefinition[]) {
  const groups: Record<string, UnitDefinition[]> = {};
  for (const unit of units) {
    const label = SYSTEM_LABELS[unit.system] ?? "Other";
    groups[label] = groups[label] ?? [];
    groups[label].push(unit);
  }
  return groups;
}
