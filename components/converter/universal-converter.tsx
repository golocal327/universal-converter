"use client";

import { useMemo, useState } from "react";
import { ConverterWidget } from "@/components/converter/converter-widget";
import { categories, getCategory } from "@/lib/units/registry";

export function UniversalConverter() {
  const [categoryId, setCategoryId] = useState("length");

  const category = useMemo(() => getCategory(categoryId)!, [categoryId]);
  const [defaultFrom, defaultTo] = category.popularPairs?.[0] ?? [category.units[0].id, category.units[1]?.id ?? category.units[0].id];

  return (
    <div>
      <div className="no-scrollbar mb-6 flex gap-2 overflow-x-auto pb-1">
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategoryId(c.id)}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
              c.id === categoryId
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border text-muted hover:border-accent hover:text-accent"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      <ConverterWidget
        key={categoryId}
        categoryId={categoryId}
        defaultFromUnitId={defaultFrom}
        defaultToUnitId={defaultTo}
        showConvertToAll
      />
    </div>
  );
}
