export interface GuideSection {
  heading?: string;
  paragraphs: string[];
}

export interface Guide {
  slug: string;
  title: string;
  description: string;
  relatedConversionSlug?: string;
  sections: GuideSection[];
}

export const guides: Guide[] = [
  {
    slug: "how-to-convert-kg-to-lbs",
    title: "How to convert kg to lbs",
    description: "The formula, the constant, and worked examples for converting kilograms to pounds.",
    relatedConversionSlug: "kilogram-to-pound",
    sections: [
      {
        paragraphs: [
          "To convert kilograms to pounds, multiply the number of kilograms by 2.20462262185. That constant comes from the internationally agreed definition of the pound as exactly 0.45359237 kilograms — so the conversion is exact, not an approximation, even though the decimal expansion never terminates.",
          "Formula: pounds = kilograms × 2.20462262185. Or in the other direction: kilograms = pounds × 0.45359237.",
        ],
      },
      {
        heading: "Worked example",
        paragraphs: [
          "A 75 kg person weighs 75 × 2.20462262185 ≈ 165.35 lb. A 5 kg bag of flour is 5 × 2.20462262185 ≈ 11.02 lb.",
        ],
      },
      {
        heading: "Quick mental-math shortcut",
        paragraphs: [
          "For a rough estimate, double the kilogram figure and take off about 10%: 75 kg → 150, minus 10% (15) → 135... that undershoots a bit. A closer shortcut is ×2.2: 75 × 2.2 = 165, very close to the exact 165.35 lb.",
        ],
      },
    ],
  },
  {
    slug: "how-to-convert-mph-to-kmh",
    title: "How to convert mph to km/h",
    description: "Converting miles per hour to kilometers per hour, with the exact multiplier.",
    relatedConversionSlug: "mile-per-hour-to-kilometer-per-hour",
    sections: [
      {
        paragraphs: [
          "Multiply mph by 1.609344 to get km/h. This comes directly from the exact definition of the international mile as 1,609.344 meters.",
          "Formula: km/h = mph × 1.609344. In reverse: mph = km/h × 0.62137119.",
        ],
      },
      {
        heading: "Worked example",
        paragraphs: [
          "A 65 mph highway speed limit is 65 × 1.609344 ≈ 104.6 km/h. A 100 km/h speed limit is 100 × 0.62137119 ≈ 62.1 mph.",
        ],
      },
    ],
  },
  {
    slug: "how-to-convert-celsius-to-fahrenheit",
    title: "How to convert Celsius to Fahrenheit",
    description: "The formula behind °C to °F, why it isn't a simple multiplication, and the one temperature where they agree.",
    relatedConversionSlug: "celsius-to-fahrenheit",
    sections: [
      {
        paragraphs: [
          "Unlike most unit conversions, temperature scales have different zero points, so you can't just multiply — you have to scale AND shift. The formula is °F = (°C × 9/5) + 32.",
          "The 9/5 accounts for Fahrenheit degrees being smaller than Celsius degrees (180 Fahrenheit degrees span the same range as 100 Celsius degrees), and the +32 accounts for Fahrenheit's zero point being 32 degrees below where Celsius sets its zero (the freezing point of water).",
        ],
      },
      {
        heading: "The crossing point",
        paragraphs: [
          "There's exactly one temperature where both scales read the same number: -40. -40°C = -40°F. You can verify it: (-40 × 9/5) + 32 = -72 + 32 = -40.",
        ],
      },
    ],
  },
  {
    slug: "how-many-liters-in-a-gallon",
    title: "How many liters in a gallon?",
    description: "Why the answer depends on which gallon you mean — US or Imperial.",
    relatedConversionSlug: "us-gallon-to-liter",
    sections: [
      {
        paragraphs: [
          "It depends which gallon: a US gallon is 3.785411784 liters, while an Imperial (UK) gallon is 4.54609 liters — about 20% larger. This is one of the most common sources of conversion errors in cooking, fuel economy, and international recipes.",
          "If you're in the US, or reading a US recipe, spec sheet, or fuel-economy rating, assume the US gallon unless told otherwise. If you're in the UK or reading older Commonwealth material, it's likely the Imperial gallon.",
        ],
      },
    ],
  },
  {
    slug: "how-many-feet-in-a-meter",
    title: "How many feet in a meter?",
    description: "The exact conversion between meters and feet.",
    relatedConversionSlug: "meter-to-foot",
    sections: [
      {
        paragraphs: [
          "1 meter = 3.280839895 feet, exactly (well, exactly given the international foot's exact definition of 0.3048 meters). In reverse, 1 foot = 0.3048 meters.",
          "A quick approximation: multiply meters by 3.28 for feet, or divide feet by 3.28 for meters — accurate to within about 0.03% for everyday use.",
        ],
      },
    ],
  },
  {
    slug: "what-is-a-kilowatt-hour",
    title: "What is a kilowatt-hour?",
    description: "Understanding the unit your electricity bill is measured in.",
    relatedConversionSlug: "kilowatt-to-horsepower",
    sections: [
      {
        paragraphs: [
          "A kilowatt-hour (kWh) is a unit of ENERGY, not power — despite the name looking like a rate. It's the amount of energy used by a 1,000-watt device running continuously for one hour.",
          "1 kWh = 3.6 megajoules exactly. Utility bills use kWh because it produces human-friendly numbers: a typical US household uses roughly 800–900 kWh per month, versus an unwieldy ~3,000,000,000 joules.",
        ],
      },
    ],
  },
  {
    slug: "difference-between-kw-and-kwh",
    title: "Difference between kW and kWh",
    description: "Power vs energy: the distinction that trips up most people reading a utility bill.",
    sections: [
      {
        paragraphs: [
          "kW (kilowatt) measures POWER — the rate energy is used, right now. kWh (kilowatt-hour) measures ENERGY — the total amount used over some period of time. It's the same relationship as speed (km/h) versus distance (km): a 2 kW heater running for 3 hours consumes 2 × 3 = 6 kWh of energy.",
          "A device's power rating (in watts or kW) tells you how fast it drains energy; your bill totals up the energy (kWh) it drained over the billing period.",
        ],
      },
    ],
  },
  {
    slug: "what-is-a-nautical-mile",
    title: "What is a nautical mile?",
    description: "Why aviation and maritime navigation use a different \"mile\" than roads do.",
    sections: [
      {
        paragraphs: [
          "A nautical mile is 1,852 meters — about 15% longer than a statute (land) mile of 1,609.344 meters. It's defined so that one nautical mile approximately equals one minute of latitude along any meridian, which makes it extremely convenient for navigation: you can read distance almost directly off a chart's latitude scale.",
          "Speed in nautical miles per hour is called a knot. Aviation and maritime navigation use knots and nautical miles worldwide, regardless of whether the country otherwise uses metric or imperial units on land.",
        ],
      },
    ],
  },
  {
    slug: "us-gallon-vs-imperial-gallon",
    title: "US gallon vs Imperial gallon",
    description: "Two different-sized \"gallons\" that share a name — and why it matters.",
    sections: [
      {
        paragraphs: [
          "The US liquid gallon (3.785411784 L) and the Imperial/UK gallon (4.54609 L) are genuinely different volumes — the Imperial gallon is about 20% larger. Both trace back to old English units, but the US kept an older wine-gallon definition after independence while Britain standardized on a new one in 1824.",
          "This is why the same car can report different MPG figures depending on which country's gallon is used: more (larger) fuel volume per Imperial gallon means a higher Imperial MPG number for identical real-world fuel consumption. Always check which gallon a source means before comparing numbers across countries.",
        ],
      },
    ],
  },
  {
    slug: "si-units",
    title: "SI base units, explained",
    description: "The seven base units the entire International System of Units is built from.",
    sections: [
      {
        paragraphs: [
          "The International System of Units (SI) defines seven base units, each measuring an independent physical quantity: the meter (length), kilogram (mass), second (time), ampere (electric current), kelvin (temperature), mole (amount of substance), and candela (luminous intensity).",
          "Every other SI unit — the newton, joule, watt, pascal, volt, and so on — is a \"derived unit\", built by combining base units. A newton, for instance, is a kg·m/s², derived directly from mass, length and time.",
        ],
      },
      {
        heading: "SI prefixes",
        paragraphs: [
          "SI prefixes (kilo-, milli-, mega-, micro-, giga-, nano-...) scale a unit by powers of ten without inventing a new unit name. A kilometer is exactly 1,000 meters; a millisecond is exactly 1/1,000 of a second. This regularity is what makes metric conversions so much simpler than imperial ones — you're always multiplying or dividing by a power of ten.",
        ],
      },
    ],
  },
];

export function getGuide(slug: string): Guide | undefined {
  return guides.find((g) => g.slug === slug);
}
