/**
 * Battery energy math: Energy (Wh) = Voltage (V) x Capacity (Ah).
 * This is a real physical relationship, not a unit-factor conversion, so it
 * lives here rather than in the electricity unit registry. Results are
 * theoretical nameplate values — actual usable energy is lower due to
 * depth-of-discharge (DoD) limits, temperature, age and converter efficiency.
 */

export function wattHoursFromAh(ampHours: number, voltage: number): number {
  assertPositive(ampHours, "Amp-hours");
  assertPositive(voltage, "Voltage");
  return ampHours * voltage;
}

export function ampHoursFromWh(wattHours: number, voltage: number): number {
  assertPositive(wattHours, "Watt-hours");
  assertPositive(voltage, "Voltage");
  return wattHours / voltage;
}

export function milliAmpHoursToWh(mAh: number, voltage: number): number {
  return wattHoursFromAh(mAh / 1000, voltage);
}

export function whToMilliAmpHours(wh: number, voltage: number): number {
  return ampHoursFromWh(wh, voltage) * 1000;
}

/** Runtime in hours for a given load in watts. */
export function estimatedRuntimeHours(wattHourCapacity: number, loadWatts: number): number {
  assertPositive(wattHourCapacity, "Capacity");
  assertPositive(loadWatts, "Load");
  return wattHourCapacity / loadWatts;
}

/** Charging time in hours given charger current, battery Ah capacity and an efficiency factor. */
export function estimatedChargeTimeHours(ampHourCapacity: number, chargerAmps: number, efficiency = 0.85): number {
  assertPositive(ampHourCapacity, "Capacity");
  assertPositive(chargerAmps, "Charger current");
  if (efficiency <= 0 || efficiency > 1) throw new Error("Efficiency must be between 0 and 1.");
  return ampHourCapacity / (chargerAmps * efficiency);
}

/** C-rate: charge/discharge current relative to capacity. A 2000mAh battery discharged at 1C draws 2000mA. */
export function cRateToAmps(ampHourCapacity: number, cRate: number): number {
  assertPositive(ampHourCapacity, "Capacity");
  return ampHourCapacity * cRate;
}

export function seriesPackVoltage(cellVoltage: number, cellsInSeries: number): number {
  assertPositive(cellVoltage, "Cell voltage");
  assertPositive(cellsInSeries, "Cells in series");
  return cellVoltage * cellsInSeries;
}

export function parallelPackCapacity(cellAh: number, cellsInParallel: number): number {
  assertPositive(cellAh, "Cell capacity");
  assertPositive(cellsInParallel, "Cells in parallel");
  return cellAh * cellsInParallel;
}

function assertPositive(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive finite number.`);
  }
}
