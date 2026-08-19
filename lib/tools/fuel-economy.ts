/**
 * Fuel economy is NOT a linear conversion: L/100km is fuel per fixed distance,
 * while MPG is distance per fixed fuel volume — they are reciprocals of each
 * other, scaled by unit size. This is why it needs its own tool instead of a
 * factor/offset entry in the volume or distance registries.
 *
 * IMPORTANT: US gallons (3.785411784 L) and Imperial/UK gallons (4.54609 L)
 * are different sizes, so "MPG" alone is ambiguous — this tool always asks
 * which gallon you mean.
 */

const KM_PER_100L_CONSTANT = 100; // L/100km definition constant
const MILES_PER_KM = 1 / 1.609344;
const US_GALLON_LITERS = 3.785411784;
const IMPERIAL_GALLON_LITERS = 4.54609;

export type FuelEconomyUnit = "l-100km" | "km-l" | "mpg-us" | "mpg-imperial";

export function convertFuelEconomy(value: number, from: FuelEconomyUnit, to: FuelEconomyUnit): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Fuel economy value must be a positive finite number.");
  }
  const litersPer100Km = toLitersPer100Km(value, from);
  return fromLitersPer100Km(litersPer100Km, to);
}

function toLitersPer100Km(value: number, unit: FuelEconomyUnit): number {
  switch (unit) {
    case "l-100km":
      return value;
    case "km-l":
      return KM_PER_100L_CONSTANT / value;
    case "mpg-us":
      return (KM_PER_100L_CONSTANT * US_GALLON_LITERS) / (value / MILES_PER_KM);
    case "mpg-imperial":
      return (KM_PER_100L_CONSTANT * IMPERIAL_GALLON_LITERS) / (value / MILES_PER_KM);
  }
}

function fromLitersPer100Km(litersPer100Km: number, unit: FuelEconomyUnit): number {
  switch (unit) {
    case "l-100km":
      return litersPer100Km;
    case "km-l":
      return KM_PER_100L_CONSTANT / litersPer100Km;
    case "mpg-us":
      return ((KM_PER_100L_CONSTANT * US_GALLON_LITERS) / litersPer100Km) * MILES_PER_KM;
    case "mpg-imperial":
      return ((KM_PER_100L_CONSTANT * IMPERIAL_GALLON_LITERS) / litersPer100Km) * MILES_PER_KM;
  }
}

export const FUEL_ECONOMY_UNITS: { id: FuelEconomyUnit; label: string }[] = [
  { id: "l-100km", label: "Liters / 100 km" },
  { id: "km-l", label: "Kilometers / liter" },
  { id: "mpg-us", label: "MPG (US gallon)" },
  { id: "mpg-imperial", label: "MPG (Imperial gallon)" },
];
