import { describe, expect, it } from "vitest";
import { parseAndConvert } from "@/lib/parser";
import type { ConversionResult } from "@/lib/convert";

function expectOk(result: ReturnType<typeof parseAndConvert>): ConversionResult {
  if ("reason" in result) {
    throw new Error(`Expected a successful parse, got failure: ${result.reason} — ${result.message}`);
  }
  return result;
}

describe("parseAndConvert() — natural language queries", () => {
  it("100kg to lbs", () => {
    const r = expectOk(parseAndConvert("100kg to lbs"));
    expect(r.result).toBeCloseTo(220.462262185, 3);
  });

  it("100 kg a libras (Spanish connector + alias)", () => {
    const r = expectOk(parseAndConvert("100 kg a libras"));
    expect(r.result).toBeCloseTo(220.462262185, 3);
  });

  it("100 kilograms in pounds", () => {
    const r = expectOk(parseAndConvert("100 kilograms in pounds"));
    expect(r.result).toBeCloseTo(220.462262185, 3);
  });

  it("60 mph kmh (no connector word)", () => {
    const r = expectOk(parseAndConvert("60 mph kmh"));
    expect(r.result).toBeCloseTo(96.56064, 3);
  });

  it("25C F (attached unit, no connector)", () => {
    const r = expectOk(parseAndConvert("25C F"));
    expect(r.result).toBeCloseTo(77, 3);
  });

  it("10 gallons liters", () => {
    const r = expectOk(parseAndConvert("10 gallons liters"));
    expect(r.result).toBeCloseTo(37.85411784, 3);
  });

  it("500 watts to horsepower", () => {
    const r = expectOk(parseAndConvert("500 watts to horsepower"));
    expect(r.result).toBeCloseTo(0.670478, 3);
  });

  it("100 psi to bar", () => {
    const r = expectOk(parseAndConvert("100 psi to bar"));
    expect(r.result).toBeCloseTo(6.894757, 3);
  });

  it("handles decimal-comma input (Spanish locale)", () => {
    const r = expectOk(parseAndConvert("1,5 kg to lbs"));
    expect(r.result).toBeCloseTo(3.3069, 2);
  });

  it("returns a failure (not a throw) for gibberish", () => {
    const r = parseAndConvert("banana to spaceship");
    expect("reason" in r).toBe(true);
  });

  it("returns a failure for incompatible categories", () => {
    const r = parseAndConvert("100 kg to meters");
    expect("reason" in r && r.reason === "incompatible").toBe(true);
  });
});
