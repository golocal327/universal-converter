/** Converts an integer's textual representation between numeral bases 2-36. */
export function convertBase(input: string, fromBase: number, toBase: number): string {
  if (fromBase < 2 || fromBase > 36 || toBase < 2 || toBase > 36) {
    throw new Error("Base must be between 2 and 36.");
  }
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Input is empty.");

  const negative = trimmed.startsWith("-");
  const digits = negative ? trimmed.slice(1) : trimmed;

  if (!isValidForBase(digits, fromBase)) {
    throw new Error(`"${input}" is not a valid base-${fromBase} number.`);
  }

  const value = BigInt(parseIntInBase(digits, fromBase));
  const converted = toBaseString(value, toBase);
  return negative ? `-${converted}` : converted;
}

function isValidForBase(digits: string, base: number): boolean {
  const validChars = "0123456789abcdefghijklmnopqrstuvwxyz".slice(0, base);
  return digits.length > 0 && [...digits.toLowerCase()].every((c) => validChars.includes(c));
}

function parseIntInBase(digits: string, base: number): bigint {
  let result = 0n;
  const bigBase = BigInt(base);
  for (const char of digits.toLowerCase()) {
    const digitValue = "0123456789abcdefghijklmnopqrstuvwxyz".indexOf(char);
    result = result * bigBase + BigInt(digitValue);
  }
  return result;
}

function toBaseString(value: bigint, base: number): string {
  if (value === 0n) return "0";
  const bigBase = BigInt(base);
  const chars = "0123456789abcdefghijklmnopqrstuvwxyz";
  let result = "";
  let remaining = value;
  while (remaining > 0n) {
    const digit = Number(remaining % bigBase);
    result = chars[digit] + result;
    remaining = remaining / bigBase;
  }
  return result;
}

export const COMMON_BASES = [
  { value: 2, label: "Binary (base 2)" },
  { value: 8, label: "Octal (base 8)" },
  { value: 10, label: "Decimal (base 10)" },
  { value: 16, label: "Hexadecimal (base 16)" },
];
