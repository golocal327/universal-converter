export const homeFaq = [
  {
    question: "What is a unit converter?",
    answer:
      "A unit converter translates a measurement from one unit into an equivalent measurement in another unit of the same kind — for example turning kilograms into pounds, or Celsius into Fahrenheit. Universal Converter does this instantly, in your browser, using internationally recognized conversion constants.",
  },
  {
    question: "How are units converted?",
    answer:
      "Every category (length, mass, temperature, etc.) has a single base unit. Converting from unit A to unit B works by first converting A into the base unit, then converting the base unit into B. This keeps every conversion consistent and lets us add new units without touching existing ones.",
  },
  {
    question: "What is SI?",
    answer:
      "SI (Système International d'Unités) is the modern metric system: the internationally agreed set of base units — meter, kilogram, second, ampere, kelvin, mole and candela — plus a coherent system of prefixes (kilo-, milli-, etc.) and derived units built from them.",
  },
  {
    question: "Metric vs Imperial — what's the difference?",
    answer:
      "The metric system (used by most of the world) is decimal and built from SI base units. The imperial system (historically used in the UK, and the basis for US customary units) uses units like inches, feet, pounds and gallons with less regular relationships between them.",
  },
  {
    question: "Are US customary and Imperial units the same?",
    answer:
      "Mostly, but not always. Length units like inches, feet and miles are identical. Volume units are not: a US gallon (3.785 L) is smaller than an Imperial (UK) gallon (4.546 L), so always check which one applies to your conversion.",
  },
  {
    question: "Are these conversions accurate?",
    answer:
      "Yes. Every constant is sourced from SI/BIPM definitions or NIST-published reference values where they exist, and the engine uses arbitrary-precision decimal arithmetic to avoid floating point rounding errors. See the Accuracy & methodology page for details.",
  },
];
