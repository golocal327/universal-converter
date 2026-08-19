export interface ToolMeta {
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
}

export const tools: ToolMeta[] = [
  {
    slug: "numeral-base",
    name: "Numeral Base Converter",
    shortDescription: "Binary, octal, decimal, hexadecimal and any base 2–36",
    description:
      "Converts whole numbers between numeral bases — the representation a number is written in, not its value. 255 in decimal (base 10) is FF in hexadecimal (base 16) and 11111111 in binary (base 2): all three represent the exact same quantity, just written differently. Used constantly in programming, color codes and low-level computing.",
  },
  {
    slug: "roman-numerals",
    name: "Roman Numeral Converter",
    shortDescription: "Arabic numbers ↔ Roman numerals (1–3999)",
    description:
      "Converts between Arabic numbers (1, 2, 3…) and Roman numerals (I, II, III…) using the standard subtractive notation (e.g. IV for 4, IX for 9). Supports the full classical range from 1 to 3999 and validates malformed numerals like \"IIII\" or \"VX\".",
  },
  {
    slug: "unix-timestamp",
    name: "Unix Timestamp Converter",
    shortDescription: "Unix time ↔ human-readable date, in seconds, ms or µs",
    description:
      "Converts a Unix timestamp (seconds — or milliseconds/microseconds — since January 1, 1970 UTC) to a human-readable date, and back. Essential for reading log files, API responses and database records that store dates as raw timestamps.",
  },
  {
    slug: "battery",
    name: "Battery & Energy Calculator",
    shortDescription: "Ah ↔ Wh, runtime and charge-time estimates",
    description:
      "Calculates battery energy (Wh) from voltage and amp-hour capacity, plus estimated runtime under a given load. Energy = Voltage × Amp-hours is a real physical relationship, not a unit conversion — 12V 100Ah is 1200Wh regardless of unit system. Real-world usable energy is always lower due to depth-of-discharge limits, temperature and efficiency losses.",
  },
  {
    slug: "fuel-economy",
    name: "Fuel Economy Converter",
    shortDescription: "L/100km ↔ km/L ↔ MPG (US and Imperial)",
    description:
      "Converts between fuel-economy measures that are reciprocals of each other by construction: L/100km measures fuel used per fixed distance, while MPG measures distance covered per fixed fuel volume. Also distinguishes US gallons (3.785 L) from Imperial/UK gallons (4.546 L), which give different MPG numbers for the same real-world economy.",
  },
  {
    slug: "currency",
    name: "Currency Converter",
    shortDescription: "Major world currencies, live rates when configured",
    description:
      "Converts between major world currencies. Exchange rates are not fixed physical constants — they move constantly — so this tool is architected to pull live rates from an external API (configure CURRENCY_API_KEY / CURRENCY_API_URL) and falls back to a clearly labeled, non-live manual rate table otherwise.",
  },
];

export function getTool(slug: string): ToolMeta | undefined {
  return tools.find((t) => t.slug === slug);
}
