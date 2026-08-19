import { Decimal } from "decimal.js";
import { getCategory, getUnit } from "./units/registry";
import type { UnitDefinition } from "./units/types";

export class ConversionError extends Error {
  code: "unknown-unit" | "incompatible-units" | "invalid-value";

  constructor(code: ConversionError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "ConversionError";
  }
}

export interface ConversionResult {
  value: number;
  fromUnit: UnitDefinition;
  toUnit: UnitDefinition;
  result: number;
}

/** Validate a raw numeric input the way every entry point in the app should. */
export function assertFiniteNumber(value: number): void {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
    throw new ConversionError("invalid-value", "Value must be a finite number.");
  }
}

export function convert(value: number, fromUnitId: string, toUnitId: string): ConversionResult {
  assertFiniteNumber(value);

  const fromUnit = getUnit(fromUnitId);
  const toUnit = getUnit(toUnitId);

  if (!fromUnit) throw new ConversionError("unknown-unit", `Unknown unit: "${fromUnitId}"`);
  if (!toUnit) throw new ConversionError("unknown-unit", `Unknown unit: "${toUnitId}"`);
  if (fromUnit.categoryId !== toUnit.categoryId) {
    throw new ConversionError(
      "incompatible-units",
      `Cannot convert "${fromUnit.name}" (${fromUnit.categoryId}) to "${toUnit.name}" (${toUnit.categoryId}): different categories.`
    );
  }

  const baseValue = fromUnit.toBase(value);
  const result = toUnit.fromBase(baseValue);

  return { value, fromUnit, toUnit, result };
}

/** Convert a value to EVERY other unit in its category — powers the "convert to everything" mode. */
export function convertToAll(value: number, fromUnitId: string): ConversionResult[] {
  assertFiniteNumber(value);
  const fromUnit = getUnit(fromUnitId);
  if (!fromUnit) throw new ConversionError("unknown-unit", `Unknown unit: "${fromUnitId}"`);
  const category = getCategory(fromUnit.categoryId);
  if (!category) throw new ConversionError("unknown-unit", `Unknown category for unit: "${fromUnitId}"`);

  return category.units
    .filter((u) => u.id !== fromUnitId)
    .map((toUnit) => convert(value, fromUnitId, toUnit.id));
}

/** Generate a conversion table for a fixed list of source values (used on SEO pages). */
export function generateConversionTable(
  fromUnitId: string,
  toUnitId: string,
  values: number[]
): { input: number; output: number }[] {
  return values.map((input) => ({ input, output: convert(input, fromUnitId, toUnitId).result }));
}

/** Round-trip a value A -> B -> A. Used by reversibility tests and the UI's "double-check" affordance. */
export function roundTrip(value: number, fromUnitId: string, toUnitId: string): number {
  const forward = convert(value, fromUnitId, toUnitId);
  const back = convert(forward.result, toUnitId, fromUnitId);
  return back.result;
}

/** Precise decimal helper exposed for anything that needs exact arithmetic beyond convert(). */
export function toDecimal(value: number): Decimal {
  return new Decimal(value);
}
