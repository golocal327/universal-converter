import { convert } from "../convert";
import { formatNumber } from "../format";
import { categories, getCategory, getUnit } from "../units/registry";
import type { UnitDefinition } from "../units/types";
import { slugForPair } from "../search-index";

/**
 * A ConversionPageDefinition is the single source of truth for one indexable
 * SEO conversion page (e.g. /converters/kg-to-lbs). Adding a new one is a
 * one-line addition here — nothing else in the app needs to change.
 *
 * `indexable` exists specifically so we can register a conversion pair (so it
 * has a working page and shows up in internal links / related-conversions)
 * without asking Google to index it — the control called for in the project
 * spec to avoid thin/duplicate content at scale.
 */
export interface ConversionPageDefinition {
  slug: string;
  fromUnitId: string;
  toUnitId: string;
  indexable: boolean;
}

const TEMPERATURE_TABLE_VALUES = [-40, -20, -10, 0, 10, 20, 25, 30, 37, 40, 100];
const ANGLE_TABLE_VALUES = [0, 15, 30, 45, 60, 90, 180, 270, 360];
const DEFAULT_TABLE_VALUES = [1, 2, 5, 10, 20, 25, 50, 75, 100, 250, 500, 1000];

const TABLE_VALUES_BY_CATEGORY: Record<string, number[]> = {
  temperature: TEMPERATURE_TABLE_VALUES,
  angle: ANGLE_TABLE_VALUES,
};

function tableValuesFor(categoryId: string): number[] {
  return TABLE_VALUES_BY_CATEGORY[categoryId] ?? DEFAULT_TABLE_VALUES;
}

/** Built from each category's curated `popularPairs` — both directions — so the registry stays the single source of truth. */
function buildDefinitions(): ConversionPageDefinition[] {
  const defs: ConversionPageDefinition[] = [];
  const seen = new Set<string>();

  const register = (fromId: string, toId: string) => {
    const slug = slugForPair(fromId, toId);
    if (seen.has(slug)) return;
    seen.add(slug);
    defs.push({ slug, fromUnitId: fromId, toUnitId: toId, indexable: true });
  };

  for (const category of categories) {
    for (const [a, b] of category.popularPairs ?? []) {
      register(a, b);
      register(b, a);
    }
  }
  return defs;
}

let cachedDefinitions: ConversionPageDefinition[] | null = null;

export function getConversionPageDefinitions(): ConversionPageDefinition[] {
  if (!cachedDefinitions) cachedDefinitions = buildDefinitions();
  return cachedDefinitions;
}

export function getConversionPageDefinition(slug: string): ConversionPageDefinition | undefined {
  return getConversionPageDefinitions().find((d) => d.slug === slug);
}

const TEMPERATURE_FORMULAS: Record<string, string> = {
  "celsius-fahrenheit": "°F = (°C × 9/5) + 32",
  "fahrenheit-celsius": "°C = (°F − 32) × 5/9",
  "celsius-kelvin": "K = °C + 273.15",
  "kelvin-celsius": "°C = K − 273.15",
  "fahrenheit-kelvin": "K = (°F − 32) × 5/9 + 273.15",
  "kelvin-fahrenheit": "°F = (K − 273.15) × 9/5 + 32",
};

export function getFormulaText(fromUnit: UnitDefinition, toUnit: UnitDefinition): string {
  if (fromUnit.categoryId === "temperature") {
    const key = `${fromUnit.id}-${toUnit.id}`;
    if (TEMPERATURE_FORMULAS[key]) return TEMPERATURE_FORMULAS[key];
  }
  if (fromUnit.factor != null && toUnit.factor != null) {
    const combined = fromUnit.factor / toUnit.factor;
    return `${toUnit.name} = ${fromUnit.name} × ${formatNumber(combined, "auto")}`;
  }
  return `Use the calculator above — this pair uses a non-linear formula.`;
}

export interface ConversionExample {
  input: number;
  output: number;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface ConversionPageContent {
  definition: ConversionPageDefinition;
  fromUnit: UnitDefinition;
  toUnit: UnitDefinition;
  title: string;
  metaDescription: string;
  h1: string;
  intro: string;
  formula: string;
  examples: ConversionExample[];
  table: ConversionExample[];
  faq: FaqItem[];
  relatedSlugs: string[];
}

export function getConversionPageContent(definition: ConversionPageDefinition): ConversionPageContent {
  const fromUnit = getUnit(definition.fromUnitId);
  const toUnit = getUnit(definition.toUnitId);
  if (!fromUnit || !toUnit) {
    throw new Error(`Conversion page "${definition.slug}" references an unknown unit.`);
  }
  const category = getCategory(fromUnit.categoryId);

  const oneResult = convert(1, fromUnit.id, toUnit.id).result;
  const formula = getFormulaText(fromUnit, toUnit);

  const title = `${fromUnit.name} to ${toUnit.name} Converter (${fromUnit.symbol} to ${toUnit.symbol})`;
  const metaDescription = `Convert ${fromUnit.pluralName.toLowerCase()} to ${toUnit.pluralName.toLowerCase()} instantly. 1 ${fromUnit.symbol} = ${formatNumber(oneResult, 6)} ${toUnit.symbol}. Free converter with formula, examples and a full conversion table.`;
  const h1 = `${fromUnit.name} to ${toUnit.name} Converter`;

  const quantityName = category ? category.name.toLowerCase() : "the same physical quantity";
  const intro = `${fromUnit.name} (${fromUnit.symbol}) and ${toUnit.name} (${toUnit.symbol}) both measure ${quantityName}. One ${fromUnit.name.toLowerCase()} equals ${formatNumber(oneResult, 6)} ${toUnit.pluralName.toLowerCase()}. ${fromUnit.description ?? ""}`.trim();

  const tableValues = tableValuesFor(fromUnit.categoryId);
  const table = tableValues.map((input) => ({ input, output: convert(input, fromUnit.id, toUnit.id).result }));
  const examples = table.slice(0, 4);

  const faq: FaqItem[] = [
    {
      question: `How many ${toUnit.pluralName.toLowerCase()} are in a ${fromUnit.name.toLowerCase()}?`,
      answer: `1 ${fromUnit.name.toLowerCase()} equals ${formatNumber(oneResult, 6)} ${toUnit.pluralName.toLowerCase()} (${fromUnit.symbol} to ${toUnit.symbol}).`,
    },
    {
      question: `What is the formula to convert ${fromUnit.pluralName.toLowerCase()} to ${toUnit.pluralName.toLowerCase()}?`,
      answer: `${formula}. ${fromUnit.categoryId === "temperature" ? "Temperature scales use an offset, not just a multiplier, so you can't just multiply the number." : "Multiply the value by the constant above to get the result."}`,
    },
    {
      question: `Is the ${fromUnit.name.toLowerCase()} to ${toUnit.name.toLowerCase()} conversion exact?`,
      answer:
        fromUnit.source || toUnit.source
          ? `Yes — this conversion is based on an internationally defined constant (${fromUnit.source ?? toUnit.source}), so it is exact to the precision shown.`
          : `This conversion uses a fixed, internationally recognized constant, so results are exact to the number of decimals you choose to display.`,
    },
  ];

  const relatedSlugs = getConversionPageDefinitions()
    .filter((d) => d.slug !== definition.slug && (d.fromUnitId === fromUnit.id || d.toUnitId === toUnit.id || d.fromUnitId === toUnit.id))
    .slice(0, 6)
    .map((d) => d.slug);

  return { definition, fromUnit, toUnit, title, metaDescription, h1, intro, formula, examples, table, faq, relatedSlugs };
}
