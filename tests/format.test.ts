import { describe, expect, it } from "vitest";
import { formatNumber, parseLocaleNumber } from "@/lib/format";

describe("formatNumber()", () => {
  it("formats with a fixed number of decimals", () => {
    expect(formatNumber(2.20462262185, 2)).toBe("2.20");
    expect(formatNumber(2.20462262185, 0)).toBe("2");
  });

  it("auto mode trims trailing zeros", () => {
    expect(formatNumber(2.5, "auto")).toBe("2.5");
    expect(formatNumber(100, "auto")).toBe("100");
  });

  it("switches to scientific notation for very large/small numbers in auto mode", () => {
    expect(formatNumber(1.5e25, "auto")).toContain("e");
    expect(formatNumber(1.5e-9, "auto")).toContain("e");
  });

  it("scientific mode always uses exponential form", () => {
    expect(formatNumber(1234.5, "scientific")).toMatch(/e/);
  });

  it("engineering mode uses exponents that are multiples of 3", () => {
    const result = formatNumber(1234567, "engineering");
    const exponentMatch = result.match(/e([+-]?\d+)/);
    expect(exponentMatch).not.toBeNull();
    expect(Number(exponentMatch![1]) % 3).toBe(0);
  });

  it("returns 0 for exactly zero", () => {
    expect(formatNumber(0, "auto")).toBe("0");
  });

  it("handles negative numbers", () => {
    expect(formatNumber(-32.8084, 2)).toBe("-32.81");
  });
});

describe("parseLocaleNumber()", () => {
  it("parses plain integers and decimals", () => {
    expect(parseLocaleNumber("100")).toBe(100);
    expect(parseLocaleNumber("1.5")).toBe(1.5);
  });

  it("parses Spanish-style decimal comma", () => {
    expect(parseLocaleNumber("1,5")).toBe(1.5);
  });

  it("parses thousands separators in both conventions", () => {
    expect(parseLocaleNumber("1,234.5")).toBe(1234.5);
    expect(parseLocaleNumber("1.234,5")).toBe(1234.5);
  });

  it("parses scientific notation", () => {
    expect(parseLocaleNumber("1e-6")).toBe(1e-6);
  });

  it("returns null for garbage input", () => {
    expect(parseLocaleNumber("banana")).toBeNull();
    expect(parseLocaleNumber("")).toBeNull();
  });

  it("parses negative numbers", () => {
    expect(parseLocaleNumber("-40")).toBe(-40);
  });
});
