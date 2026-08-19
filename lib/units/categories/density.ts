import { defineLinearUnit } from "../helpers";
import type { CategoryDefinition } from "../types";

export const densityCategory: CategoryDefinition = {
  id: "density",
  name: "Density",
  pluralName: "Density",
  shortDescription: "kg/m³, g/cm³, lb/ft³ and more",
  description:
    "Density is mass per unit volume. It is a material property, not something you can convert from an arbitrary mass or volume without knowing the substance. This converter changes the UNITS a density is expressed in (kg/m³ ↔ g/cm³ ↔ lb/ft³); it does not convert a plain mass into a plain volume — see the Cooking tools for ingredient-specific mass↔volume conversions.",
  baseUnitId: "kilogram-per-cubic-meter",
  icon: "Box",
  linear: true,
  popularPairs: [
    ["gram-per-cubic-centimeter", "kilogram-per-cubic-meter"],
    ["pound-per-cubic-foot", "kilogram-per-cubic-meter"],
  ],
  units: [
    defineLinearUnit({
      id: "kilogram-per-cubic-meter",
      categoryId: "density",
      name: "Kilogram per cubic meter",
      symbol: "kg/m³",
      system: "si",
      factor: 1,
      aliases: ["kilograms per cubic meter"],
      description: "SI derived unit of density. Water is approximately 1000 kg/m³.",
    }),
    defineLinearUnit({
      id: "gram-per-cubic-centimeter",
      categoryId: "density",
      name: "Gram per cubic centimeter",
      symbol: "g/cm³",
      system: "metric",
      factor: 1000,
      aliases: ["grams per cubic centimeter", "g/ml equivalent"],
      description: "Numerically equal to g/mL. Water is 1 g/cm³ at 4°C.",
    }),
    defineLinearUnit({
      id: "gram-per-milliliter",
      categoryId: "density",
      name: "Gram per milliliter",
      symbol: "g/mL",
      system: "metric",
      factor: 1000,
      aliases: ["grams per milliliter"],
    }),
    defineLinearUnit({
      id: "pound-per-cubic-foot",
      categoryId: "density",
      name: "Pound per cubic foot",
      symbol: "lb/ft³",
      system: "imperial",
      factor: 16.01846337396,
      aliases: ["pounds per cubic foot"],
    }),
    defineLinearUnit({
      id: "pound-per-cubic-inch",
      categoryId: "density",
      name: "Pound per cubic inch",
      symbol: "lb/in³",
      system: "imperial",
      factor: 27679.904710203,
      aliases: ["pounds per cubic inch"],
    }),
  ],
};
