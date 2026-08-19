"use client";

import { useMemo, useState } from "react";
import { estimatedRuntimeHours, wattHoursFromAh } from "@/lib/tools/battery";
import { formatNumber } from "@/lib/format";

export function BatteryTool() {
  const [voltage, setVoltage] = useState("12");
  const [ampHours, setAmpHours] = useState("100");
  const [loadWatts, setLoadWatts] = useState("60");

  const result = useMemo(() => {
    const v = Number(voltage);
    const ah = Number(ampHours);
    const load = Number(loadWatts);
    if (!Number.isFinite(v) || !Number.isFinite(ah) || v <= 0 || ah <= 0) return null;
    const wh = wattHoursFromAh(ah, v);
    const runtime = Number.isFinite(load) && load > 0 ? estimatedRuntimeHours(wh, load) : null;
    return { wh, runtime };
  }, [voltage, ampHours, loadWatts]);

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Voltage (V)" value={voltage} onChange={setVoltage} />
        <Field label="Capacity (Ah)" value={ampHours} onChange={setAmpHours} />
        <Field label="Load (W) — optional" value={loadWatts} onChange={setLoadWatts} />
      </div>

      {result ? (
        <div className="mt-5 grid grid-cols-1 gap-3 border-t border-border pt-5 sm:grid-cols-2">
          <div className="rounded-lg bg-background px-4 py-3">
            <p className="text-xs text-muted">Energy</p>
            <p className="text-xl font-semibold">{formatNumber(result.wh, 2)} Wh</p>
          </div>
          {result.runtime !== null && (
            <div className="rounded-lg bg-background px-4 py-3">
              <p className="text-xs text-muted">Estimated runtime at that load</p>
              <p className="text-xl font-semibold">{formatNumber(result.runtime, 2)} hours</p>
            </div>
          )}
        </div>
      ) : (
        <p className="mt-4 text-sm text-danger">Enter a positive voltage and capacity.</p>
      )}

      <p className="mt-4 text-xs text-muted">
        Theoretical nameplate values (Energy = Voltage × Amp-hours). Real usable energy is lower due to depth-of-discharge
        limits, temperature, battery age and converter efficiency.
      </p>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        className="h-12 w-full rounded-xl border border-border bg-background px-4 text-lg focus:border-accent focus:outline-none"
      />
    </div>
  );
}
