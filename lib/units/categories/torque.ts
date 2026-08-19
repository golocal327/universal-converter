import { defineLinearUnit } from "../helpers";
import type { CategoryDefinition } from "../types";

export const torqueCategory: CategoryDefinition = {
  id: "torque",
  name: "Torque",
  pluralName: "Torque",
  shortDescription: "Newton-meters, lb-ft, lb-in and more",
  description:
    "Torque is a rotational force — how hard something twists around an axis. Car and tool specifications commonly mix newton-meters (metric) with pound-feet or pound-inches (US), which is why a torque wrench spec sheet often lists both.",
  baseUnitId: "newton-meter",
  icon: "Wrench",
  linear: true,
  popularPairs: [
    ["newton-meter", "pound-foot"],
    ["pound-foot", "newton-meter"],
  ],
  units: [
    defineLinearUnit({
      id: "newton-meter",
      categoryId: "torque",
      name: "Newton-meter",
      symbol: "N·m",
      system: "si",
      factor: 1,
      aliases: ["newton meters", "nm"],
    }),
    defineLinearUnit({
      id: "pound-foot",
      categoryId: "torque",
      name: "Pound-foot",
      symbol: "lb·ft",
      system: "imperial",
      factor: 1.3558179483314004,
      aliases: ["pound feet", "lb-ft", "ft-lb torque"],
    }),
    defineLinearUnit({
      id: "pound-inch",
      categoryId: "torque",
      name: "Pound-inch",
      symbol: "lb·in",
      system: "imperial",
      factor: 0.1129848290276167,
      aliases: ["pound inches", "lb-in", "in-lb"],
    }),
    defineLinearUnit({
      id: "kilogram-force-meter",
      categoryId: "torque",
      name: "Kilogram-force meter",
      symbol: "kgf·m",
      system: "metric",
      factor: 9.80665,
      aliases: ["kgf-m", "kgm"],
    }),
    defineLinearUnit({
      id: "kilogram-force-centimeter",
      categoryId: "torque",
      name: "Kilogram-force centimeter",
      symbol: "kgf·cm",
      system: "metric",
      factor: 0.0980665,
      aliases: ["kgf-cm", "kgcm"],
    }),
  ],
};
