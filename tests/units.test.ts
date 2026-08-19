import { describe, expect, it } from "vitest";
import { categories, getAllUnits, getUnit } from "@/lib/units/registry";

describe("unit registry integrity", () => {
  it("has at least 15 categories", () => {
    expect(categories.length).toBeGreaterThanOrEqual(15);
  });

  it("has at least 150 units total", () => {
    expect(getAllUnits().length).toBeGreaterThanOrEqual(150);
  });

  it("every category has a valid base unit that belongs to it", () => {
    for (const category of categories) {
      const baseUnit = category.units.find((u) => u.id === category.baseUnitId);
      expect(baseUnit, `category "${category.id}" is missing its base unit "${category.baseUnitId}"`).toBeDefined();
    }
  });

  it("every unit id is globally unique", () => {
    const ids = getAllUnits().map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every unit resolves via getUnit()", () => {
    for (const unit of getAllUnits()) {
      expect(getUnit(unit.id)?.id).toBe(unit.id);
    }
  });

  it("every unit has at least one alias and a symbol", () => {
    for (const unit of getAllUnits()) {
      expect(unit.aliases.length).toBeGreaterThan(0);
      expect(unit.symbol.length).toBeGreaterThan(0);
    }
  });

  it("the base unit of every linear category converts 1:1", () => {
    for (const category of categories) {
      if (!category.linear) continue;
      const baseUnit = category.units.find((u) => u.id === category.baseUnitId)!;
      expect(baseUnit.toBase(1)).toBeCloseTo(1, 9);
      expect(baseUnit.fromBase(1)).toBeCloseTo(1, 9);
    }
  });

  it("every popularPairs entry references real units in the same category", () => {
    for (const category of categories) {
      for (const [a, b] of category.popularPairs ?? []) {
        const unitA = getUnit(a);
        const unitB = getUnit(b);
        expect(unitA, `${category.id}: unknown unit "${a}" in popularPairs`).toBeDefined();
        expect(unitB, `${category.id}: unknown unit "${b}" in popularPairs`).toBeDefined();
        expect(unitA?.categoryId).toBe(category.id);
        expect(unitB?.categoryId).toBe(category.id);
      }
    }
  });
});
