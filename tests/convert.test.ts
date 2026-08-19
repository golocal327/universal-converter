import { describe, expect, it } from "vitest";
import { convert, ConversionError, roundTrip } from "@/lib/convert";
import { categories, getAllUnits } from "@/lib/units/registry";

describe("convert() — known reference values", () => {
  it("1 kg ≈ 2.20462262185 lb", () => {
    expect(convert(1, "kilogram", "pound").result).toBeCloseTo(2.20462262185, 9);
  });

  it("1 mile = 1.609344 km", () => {
    expect(convert(1, "mile", "kilometer").result).toBeCloseTo(1.609344, 9);
  });

  it("1 inch = 2.54 cm", () => {
    expect(convert(1, "inch", "centimeter").result).toBeCloseTo(2.54, 9);
  });

  it("0°C = 32°F", () => {
    expect(convert(0, "celsius", "fahrenheit").result).toBeCloseTo(32, 9);
  });

  it("100°C = 212°F", () => {
    expect(convert(100, "celsius", "fahrenheit").result).toBeCloseTo(212, 9);
  });

  it("0°C = 273.15 K", () => {
    expect(convert(0, "celsius", "kelvin").result).toBeCloseTo(273.15, 9);
  });

  it("-40°C = -40°F (the famous crossing point)", () => {
    expect(convert(-40, "celsius", "fahrenheit").result).toBeCloseTo(-40, 9);
  });

  it("1 kWh = 3.6 MJ", () => {
    expect(convert(1, "kilowatt-hour", "megajoule").result).toBeCloseTo(3.6, 9);
  });

  it("1 US gallon = 3.785411784 liters", () => {
    expect(convert(1, "us-gallon", "liter").result).toBeCloseTo(3.785411784, 9);
  });

  it("1 atm = 101325 Pa", () => {
    expect(convert(1, "atm", "pascal").result).toBeCloseTo(101325, 6);
  });

  it("1 hp ≈ 745.7 W", () => {
    expect(convert(1, "horsepower", "watt").result).toBeCloseTo(745.6998715822702, 6);
  });

  it("1 GB = 1000 MB (decimal) but 1 GiB = 1024 MiB (binary)", () => {
    expect(convert(1, "gigabyte", "megabyte").result).toBeCloseTo(1000, 9);
    expect(convert(1, "gibibyte", "mebibyte").result).toBeCloseTo(1024, 9);
  });

  it("1 turn = 360 degrees", () => {
    expect(convert(1, "turn", "degree").result).toBeCloseTo(360, 9);
  });
});

describe("convert() — error handling", () => {
  it("throws on unknown units", () => {
    expect(() => convert(1, "not-a-real-unit", "meter")).toThrow(ConversionError);
  });

  it("throws when categories don't match", () => {
    expect(() => convert(1, "kilogram", "meter")).toThrow(ConversionError);
  });

  it("throws on NaN / Infinity input", () => {
    expect(() => convert(NaN, "kilogram", "pound")).toThrow(ConversionError);
    expect(() => convert(Infinity, "kilogram", "pound")).toThrow(ConversionError);
  });
});

describe("convert() — reversibility (A -> B -> A)", () => {
  const sampleValue = 12.3456;

  for (const category of categories) {
    if (!category.linear && category.id !== "temperature") continue;
    const units = category.units;
    if (units.length < 2) continue;

    it(`round-trips within tolerance for every unit pair in "${category.id}"`, () => {
      for (let i = 0; i < units.length; i++) {
        for (let j = 0; j < units.length; j++) {
          if (i === j) continue;
          const back = roundTrip(sampleValue, units[i].id, units[j].id);
          const relativeError = Math.abs(back - sampleValue) / Math.max(Math.abs(sampleValue), 1e-12);
          expect(relativeError, `${category.id}: ${units[i].id} -> ${units[j].id} -> ${units[i].id}`).toBeLessThan(1e-6);
        }
      }
    });
  }
});

describe("convert() — every unit converts to every other unit in its category without throwing", () => {
  for (const category of categories) {
    it(`category "${category.id}" has no broken pairs`, () => {
      for (const a of category.units) {
        for (const b of category.units) {
          expect(() => convert(1, a.id, b.id)).not.toThrow();
        }
      }
    });
  }
});

describe("convert() — edge cases", () => {
  it("handles zero", () => {
    expect(convert(0, "meter", "foot").result).toBe(0);
  });

  it("handles negative values for non-temperature units", () => {
    expect(convert(-10, "meter", "foot").result).toBeCloseTo(-32.8084, 3);
  });

  it("handles very large numbers without overflow to Infinity", () => {
    const result = convert(1e18, "meter", "kilometer").result;
    expect(Number.isFinite(result)).toBe(true);
  });

  it("handles very small numbers", () => {
    const result = convert(1e-12, "kilometer", "meter").result;
    expect(result).toBeCloseTo(1e-9, 15);
  });

  it("total unit count sanity check", () => {
    expect(getAllUnits().length).toBeGreaterThan(150);
  });
});
