/**
 * Core type definitions for the Universal Converter unit engine.
 *
 * Every category has ONE base unit. Every unit in that category knows how to
 * convert itself to/from the base unit. Converting unit A -> unit B always
 * goes through the base unit (A -> base -> B), so adding a new unit never
 * requires touching any other unit's definition.
 */

export type UnitSystem =
  | "si"
  | "metric"
  | "imperial"
  | "us"
  | "uk"
  | "natural"
  | "other";

export interface UnitDefinition {
  /** Unique id within its category, e.g. "kilogram". Used in URLs/slugs. */
  id: string;
  categoryId: string;
  name: string;
  pluralName: string;
  symbol: string;
  /** Lowercase search aliases: symbols, plurals, Spanish names, common misspellings. */
  aliases: string[];
  system: UnitSystem;
  /** Convert a value FROM this unit TO the category's base unit. */
  toBase: (value: number) => number;
  /** Convert a value FROM the category's base unit TO this unit. */
  fromBase: (value: number) => number;
  /** Human-readable multiplier relative to base, for display only (null if non-linear/offset-based). */
  factor?: number;
  /** Short human-readable description of the unit. */
  description?: string;
  /** Where the definition/constant comes from (SI, NIST, etc). */
  source?: string;
}

export interface CategoryDefinition {
  id: string;
  name: string;
  pluralName: string;
  /** Short tagline used in cards/search. */
  shortDescription: string;
  /** Longer educational content for the category landing page. */
  description: string;
  baseUnitId: string;
  icon: string;
  units: UnitDefinition[];
  /** Set false for categories whose conversions are not simple factor/offset math. */
  linear: boolean;
  /** Popular unit id pairs to feature on the category page, e.g. [["kilogram","pound"]]. */
  popularPairs?: [string, string][];
}
