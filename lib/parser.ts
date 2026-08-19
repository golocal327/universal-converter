import { convert, ConversionError, type ConversionResult } from "./convert";
import { parseLocaleNumber } from "./format";
import { getAliasMap, normalize } from "./search-index";
import type { UnitDefinition } from "./units/types";

export interface ParsedQuery {
  value: number;
  fromUnit: UnitDefinition;
  toUnit: UnitDefinition;
}

export interface ParseFailure {
  reason: "no-number" | "no-source-unit" | "no-target-unit" | "incompatible" | "empty";
  message: string;
}

const CONNECTORS = ["to", "a", "in", "en", "hacia", "->", "=", "as"];
const NUMBER_RE = /[+-]?\d+(?:[.,]\d+)*(?:\s*e\s*[+-]?\d+)?/i;

/**
 * Deterministic parser for queries like "100 kg to lbs", "100 kg a libras",
 * "60 mph kmh", "25C F". No AI/LLM involved — pure regex + alias lookup, by design
 * (see project spec: parsing must be deterministic so it works offline and instantly).
 */
export function parseQuery(raw: string): ParsedQuery | ParseFailure {
  const text = raw.trim();
  if (!text) return { reason: "empty", message: "Empty query." };

  const numberMatch = text.match(NUMBER_RE);
  if (!numberMatch) return { reason: "no-number", message: "Could not find a numeric value." };

  const value = parseLocaleNumber(numberMatch[0]);
  if (value === null) return { reason: "no-number", message: "Could not parse the numeric value." };

  const remainder = (text.slice(0, numberMatch.index) + " " + text.slice((numberMatch.index ?? 0) + numberMatch[0].length))
    .trim();

  const { sourceText, targetText } = splitUnitText(remainder);
  if (!sourceText) return { reason: "no-source-unit", message: "Could not find a source unit." };

  const fromUnit = resolveUnitPhrase(sourceText);
  if (!fromUnit) return { reason: "no-source-unit", message: `Unknown unit: "${sourceText}"` };

  if (!targetText) return { reason: "no-target-unit", message: "Could not find a target unit." };
  const toUnit = resolveUnitPhrase(targetText);
  if (!toUnit) return { reason: "no-target-unit", message: `Unknown unit: "${targetText}"` };

  if (fromUnit.categoryId !== toUnit.categoryId) {
    return {
      reason: "incompatible",
      message: `"${fromUnit.name}" and "${toUnit.name}" are different kinds of units.`,
    };
  }

  return { value, fromUnit, toUnit };
}

/** Parses a query end-to-end and runs the conversion, for callers that just want a result. */
export function parseAndConvert(raw: string): ConversionResult | ParseFailure {
  const parsed = parseQuery(raw);
  if ("reason" in parsed) return parsed;
  try {
    return convert(parsed.value, parsed.fromUnit.id, parsed.toUnit.id);
  } catch (err) {
    if (err instanceof ConversionError) {
      return { reason: "incompatible", message: err.message };
    }
    throw err;
  }
}

function splitUnitText(remainder: string): { sourceText: string; targetText: string } {
  const lower = remainder.toLowerCase();

  for (const connector of CONNECTORS) {
    const pattern =
      connector.length <= 2 && /^[a-z]+$/.test(connector)
        ? new RegExp(`\\s${connector}\\s`, "i")
        : new RegExp(connector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const match = lower.match(pattern);
    if (match && match.index !== undefined) {
      return {
        sourceText: remainder.slice(0, match.index).trim(),
        targetText: remainder.slice(match.index + match[0].length).trim(),
      };
    }
  }

  // No connector word found: assume "<source unit> <target unit>" (e.g. "mph kmh", "kg lbs").
  const tokens = remainder.trim().split(/\s+/).filter(Boolean);
  if (tokens.length >= 2) {
    // Try every split point, preferring the source phrase to be as short as possible.
    for (let i = 1; i < tokens.length; i++) {
      const source = tokens.slice(0, i).join(" ");
      const target = tokens.slice(i).join(" ");
      if (resolveUnitPhrase(source) && resolveUnitPhrase(target)) {
        return { sourceText: source, targetText: target };
      }
    }
  }
  if (tokens.length === 1) {
    return { sourceText: tokens[0], targetText: "" };
  }

  return { sourceText: remainder, targetText: "" };
}

function resolveUnitPhrase(phrase: string): UnitDefinition | undefined {
  const cleaned = normalize(phrase).replace(/[.,;:!?]+$/, "");
  if (!cleaned) return undefined;
  const map = getAliasMap();
  if (map.has(cleaned)) return map.get(cleaned);

  // Attached-unit case with no space, e.g. "25c" -> number regex already stripped "25",
  // remainder is "c" which should resolve directly; also handle "kmh" vs "km/h" style aliases
  // by stripping non-alphanumerics.
  const alnumOnly = cleaned.replace(/[^a-z0-9/µ°²³·]/gi, "");
  if (map.has(alnumOnly)) return map.get(alnumOnly);

  return undefined;
}
