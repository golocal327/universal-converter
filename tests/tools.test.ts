import { describe, expect, it } from "vitest";
import { convertFuelEconomy } from "@/lib/tools/fuel-economy";
import { ampHoursFromWh, wattHoursFromAh } from "@/lib/tools/battery";
import { convertBase } from "@/lib/tools/numeral-base";
import { fromRoman, toRoman } from "@/lib/tools/roman-numerals";
import { dateToTimestamp, timestampToDate } from "@/lib/tools/unix-timestamp";

describe("fuel economy (non-linear)", () => {
  it("100 mpg (US) is a much better economy than 10 L/100km", () => {
    const l100km = convertFuelEconomy(35, "mpg-us", "l-100km");
    expect(l100km).toBeGreaterThan(6);
    expect(l100km).toBeLessThan(7);
  });

  it("round-trips l-100km -> mpg-us -> l-100km", () => {
    const mpg = convertFuelEconomy(8, "l-100km", "mpg-us");
    const back = convertFuelEconomy(mpg, "mpg-us", "l-100km");
    expect(back).toBeCloseTo(8, 3);
  });

  it("US MPG and Imperial MPG differ for the same L/100km", () => {
    const mpgUs = convertFuelEconomy(8, "l-100km", "mpg-us");
    const mpgImperial = convertFuelEconomy(8, "l-100km", "mpg-imperial");
    expect(mpgUs).not.toBeCloseTo(mpgImperial, 1);
  });
});

describe("battery energy math", () => {
  it("12V 100Ah = 1200Wh", () => {
    expect(wattHoursFromAh(100, 12)).toBe(1200);
  });

  it("Wh -> Ah is the inverse of Ah -> Wh", () => {
    expect(ampHoursFromWh(1200, 12)).toBeCloseTo(100, 9);
  });
});

describe("numeral base converter", () => {
  it("255 decimal -> FF hex -> 11111111 binary", () => {
    expect(convertBase("255", 10, 16)).toBe("ff");
    expect(convertBase("255", 10, 2)).toBe("11111111");
  });

  it("round-trips through base 36", () => {
    expect(convertBase(convertBase("123456", 10, 36), 36, 10)).toBe("123456");
  });

  it("rejects invalid digits for a base", () => {
    expect(() => convertBase("12", 2, 10)).toThrow();
  });
});

describe("roman numerals", () => {
  it("converts known values both ways", () => {
    expect(toRoman(1994)).toBe("MCMXCIV");
    expect(fromRoman("MCMXCIV")).toBe(1994);
    expect(toRoman(1)).toBe("I");
    expect(toRoman(3999)).toBe("MMMCMXCIX");
  });

  it("rejects malformed numerals", () => {
    expect(() => fromRoman("IIII")).toThrow();
    expect(() => fromRoman("VX")).toThrow();
  });

  it("rejects out-of-range integers", () => {
    expect(() => toRoman(0)).toThrow();
    expect(() => toRoman(4000)).toThrow();
  });
});

describe("unix timestamp", () => {
  it("round-trips a known date", () => {
    const ts = 1700000000; // 2023-11-14T22:13:20Z
    const date = timestampToDate(ts, "seconds");
    expect(dateToTimestamp(date, "seconds")).toBe(ts);
  });

  it("converts between seconds and milliseconds", () => {
    const date = timestampToDate(1700000000, "seconds");
    expect(dateToTimestamp(date, "milliseconds")).toBe(1700000000000);
  });
});
