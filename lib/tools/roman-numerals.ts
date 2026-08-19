const ROMAN_VALUES: [string, number][] = [
  ["M", 1000],
  ["CM", 900],
  ["D", 500],
  ["CD", 400],
  ["C", 100],
  ["XC", 90],
  ["L", 50],
  ["XL", 40],
  ["X", 10],
  ["IX", 9],
  ["V", 5],
  ["IV", 4],
  ["I", 1],
];

export function toRoman(value: number): string {
  if (!Number.isInteger(value) || value < 1 || value > 3999) {
    throw new Error("Roman numerals in this converter support integers from 1 to 3999.");
  }
  let remaining = value;
  let result = "";
  for (const [symbol, symbolValue] of ROMAN_VALUES) {
    while (remaining >= symbolValue) {
      result += symbol;
      remaining -= symbolValue;
    }
  }
  return result;
}

export function fromRoman(roman: string): number {
  const normalized = roman.trim().toUpperCase();
  if (!/^[MDCLXVI]+$/.test(normalized)) {
    throw new Error(`"${roman}" contains characters that are not valid Roman numerals.`);
  }

  let total = 0;
  let index = 0;
  for (const [symbol, symbolValue] of ROMAN_VALUES) {
    while (normalized.startsWith(symbol, index)) {
      total += symbolValue;
      index += symbol.length;
    }
  }

  if (index !== normalized.length) {
    throw new Error(`"${roman}" is not a well-formed Roman numeral.`);
  }
  // Round-trip validation catches malformed-but-decodable strings like "IIII" or "VX".
  if (toRoman(total) !== normalized) {
    throw new Error(`"${roman}" is not a well-formed Roman numeral.`);
  }
  return total;
}
