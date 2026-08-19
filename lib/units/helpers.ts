import { Decimal } from "decimal.js";
import type { UnitDefinition, UnitSystem } from "./types";

/**
 * Builds toBase/fromBase for a simple linear unit (base = value * factor).
 * Uses Decimal internally so chained multiply/divide operations don't
 * accumulate binary floating point error, per the project's precision rules.
 */
export function linear(factor: number) {
  return {
    toBase: (value: number) => new Decimal(value).times(factor).toNumber(),
    fromBase: (value: number) => new Decimal(value).dividedBy(factor).toNumber(),
  };
}

interface DefineLinearUnitInput {
  id: string;
  categoryId: string;
  name: string;
  pluralName?: string;
  symbol: string;
  aliases?: string[];
  system: UnitSystem;
  /** Multiplier to convert 1 of this unit into the category's base unit. */
  factor: number;
  description?: string;
  source?: string;
}

/** Convenience constructor for the common case: a unit that is a pure multiple of the base unit. */
export function defineLinearUnit(input: DefineLinearUnitInput): UnitDefinition {
  const { toBase, fromBase } = linear(input.factor);
  return {
    id: input.id,
    categoryId: input.categoryId,
    name: input.name,
    pluralName: input.pluralName ?? `${input.name}s`,
    symbol: input.symbol,
    aliases: buildAliasList(input),
    system: input.system,
    toBase,
    fromBase,
    factor: input.factor,
    description: input.description,
    source: input.source,
  };
}

interface DefineCustomUnitInput {
  id: string;
  categoryId: string;
  name: string;
  pluralName?: string;
  symbol: string;
  aliases?: string[];
  system: UnitSystem;
  toBase: (value: number) => number;
  fromBase: (value: number) => number;
  description?: string;
  source?: string;
}

/** For units whose conversion isn't a pure multiplication (temperature offsets, etc). */
export function defineCustomUnit(input: DefineCustomUnitInput): UnitDefinition {
  return {
    id: input.id,
    categoryId: input.categoryId,
    name: input.name,
    pluralName: input.pluralName ?? `${input.name}s`,
    symbol: input.symbol,
    aliases: buildAliasList(input),
    system: input.system,
    toBase: input.toBase,
    fromBase: input.fromBase,
    description: input.description,
    source: input.source,
  };
}

function buildAliasList(input: { id: string; name: string; pluralName?: string; symbol: string; aliases?: string[] }) {
  const set = new Set<string>();
  set.add(input.id.toLowerCase());
  set.add(input.name.toLowerCase());
  set.add((input.pluralName ?? `${input.name}s`).toLowerCase());
  set.add(input.symbol.toLowerCase());
  for (const alias of input.aliases ?? []) set.add(alias.toLowerCase());
  return Array.from(set);
}
