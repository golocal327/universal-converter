import { Decimal } from "decimal.js";

export type PrecisionMode =
  | "auto"
  | 0
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 8
  | 10
  | "scientific"
  | "engineering";

export const PRECISION_OPTIONS: { value: PrecisionMode; label: string }[] = [
  { value: "auto", label: "Automatic" },
  { value: 0, label: "0 decimals" },
  { value: 1, label: "1 decimal" },
  { value: 2, label: "2 decimals" },
  { value: 3, label: "3 decimals" },
  { value: 4, label: "4 decimals" },
  { value: 5, label: "5 decimals" },
  { value: 6, label: "6 decimals" },
  { value: 8, label: "8 decimals" },
  { value: 10, label: "10 decimals" },
  { value: "scientific", label: "Scientific notation" },
  { value: "engineering", label: "Engineering notation" },
];

/**
 * Formats a numeric conversion result for display. Uses Decimal.js for the
 * rounding step so we never show artifacts of binary floating point
 * representation (e.g. 2.20462262184878 truncated weirdly).
 */
export function formatNumber(value: number, mode: PrecisionMode = "auto"): string {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "0";

  const d = new Decimal(value);

  if (mode === "scientific") {
    return d.toExponential(6).replace(/e\+?(-?)(\d+)/, "e$1$2");
  }

  if (mode === "engineering") {
    return toEngineeringNotation(d);
  }

  if (mode === "auto") {
    return autoFormat(d);
  }

  return d.toDecimalPlaces(mode, Decimal.ROUND_HALF_UP).toFixed(mode);
}

function autoFormat(d: Decimal): string {
  const abs = d.abs();

  // Very large or very small values fall back to scientific notation, mirroring
  // how calculators avoid printing 40+ digit strings.
  if (abs.greaterThanOrEqualTo("1e21") || (abs.lessThan("1e-6") && !abs.isZero())) {
    return d.toExponential(6).replace(/e\+?(-?)(\d+)/, "e$1$2");
  }

  // Otherwise: up to 6 significant decimal places, trimmed of trailing zeros.
  const rounded = d.toDecimalPlaces(6, Decimal.ROUND_HALF_UP);
  return trimTrailingZeros(rounded.toFixed(6));
}

function trimTrailingZeros(str: string): string {
  if (!str.includes(".")) return str;
  return str.replace(/0+$/, "").replace(/\.$/, "");
}

function toEngineeringNotation(d: Decimal): string {
  if (d.isZero()) return "0";
  const sign = d.isNegative() ? "-" : "";
  const abs = d.abs();
  const exponent = Math.floor(abs.log(10).toNumber());
  const engExponent = Math.floor(exponent / 3) * 3;
  const mantissa = abs.dividedBy(new Decimal(10).pow(engExponent));
  const roundedMantissa = trimTrailingZeros(mantissa.toDecimalPlaces(6, Decimal.ROUND_HALF_UP).toFixed(6));
  return `${sign}${roundedMantissa}e${engExponent >= 0 ? "+" : ""}${engExponent}`;
}

/** Parses locale-flexible numeric input: accepts "1.5", "1,5", "1,234.5", "1.234,5", "1e-6". */
export function parseLocaleNumber(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Scientific notation passes straight through once commas are normalized to nothing unusual.
  if (/^[+-]?\d+(\.\d+)?e[+-]?\d+$/i.test(trimmed)) {
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }

  const hasComma = trimmed.includes(",");
  const hasDot = trimmed.includes(".");

  let normalized = trimmed;
  if (hasComma && hasDot) {
    // Whichever separator appears last is the decimal separator; the other is a thousands separator.
    const lastComma = trimmed.lastIndexOf(",");
    const lastDot = trimmed.lastIndexOf(".");
    if (lastComma > lastDot) {
      normalized = trimmed.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = trimmed.replace(/,/g, "");
    }
  } else if (hasComma) {
    // Single comma with 1-2 trailing digits reads as a decimal separator (Spanish/European style).
    normalized = trimmed.replace(",", ".");
  }

  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}
