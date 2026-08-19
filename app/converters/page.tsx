import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CategoryCard } from "@/components/category-card";
import { siteConfig } from "@/lib/site-config";
import { categories, getAllUnits } from "@/lib/units/registry";

export const metadata: Metadata = {
  title: "All Conversion Categories",
  description: `Browse every unit conversion category on ${siteConfig.name}: length, mass, temperature, volume, energy, digital storage and more.`,
  alternates: { canonical: "/converters" },
};

export default function ConvertersIndexPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Converters" }]} />
      <h1 className="text-3xl font-semibold tracking-tight">All conversion categories</h1>
      <p className="mt-3 max-w-2xl text-muted">
        {categories.length} categories covering {getAllUnits().length}+ units. Pick a category to see every unit it
        supports, a converter, and ready-made SEO pages for the most common conversions.
      </p>
      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <CategoryCard key={category.id} category={category} />
        ))}
      </div>
    </div>
  );
}
