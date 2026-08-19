import { angleCategory } from "./categories/angle";
import { areaCategory } from "./categories/area";
import { bitrateCategory } from "./categories/bitrate";
import { dataCategory } from "./categories/data";
import { densityCategory } from "./categories/density";
import { energyCategory } from "./categories/energy";
import { forceCategory } from "./categories/force";
import { frequencyCategory } from "./categories/frequency";
import { lengthCategory } from "./categories/length";
import { massCategory } from "./categories/mass";
import { powerCategory } from "./categories/power";
import { pressureCategory } from "./categories/pressure";
import { speedCategory } from "./categories/speed";
import { temperatureCategory } from "./categories/temperature";
import { timeCategory } from "./categories/time";
import { torqueCategory } from "./categories/torque";
import { volumeCategory } from "./categories/volume";
import type { CategoryDefinition, UnitDefinition } from "./types";

/**
 * Central registry. This is the ONLY file that needs to change to register a
 * new category — every page, the search index and the SEO generator all read
 * from here instead of hardcoding category lists.
 */
export const categories: CategoryDefinition[] = [
  lengthCategory,
  massCategory,
  temperatureCategory,
  volumeCategory,
  areaCategory,
  timeCategory,
  speedCategory,
  dataCategory,
  bitrateCategory,
  energyCategory,
  powerCategory,
  pressureCategory,
  forceCategory,
  angleCategory,
  frequencyCategory,
  torqueCategory,
  densityCategory,
];

const categoryById = new Map(categories.map((c) => [c.id, c]));
const unitById = new Map<string, UnitDefinition>();
for (const category of categories) {
  for (const unit of category.units) {
    unitById.set(unit.id, unit);
  }
}

export function getCategory(categoryId: string): CategoryDefinition | undefined {
  return categoryById.get(categoryId);
}

export function getUnit(unitId: string): UnitDefinition | undefined {
  return unitById.get(unitId);
}

export function getAllUnits(): UnitDefinition[] {
  return Array.from(unitById.values());
}

export function getUnitsInCategory(categoryId: string): UnitDefinition[] {
  return getCategory(categoryId)?.units ?? [];
}

export const totalUnitCount = () => getAllUnits().length;
export const totalCategoryCount = () => categories.length;
