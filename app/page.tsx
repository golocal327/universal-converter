import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdSlot } from "@/components/ad-slot";
import { CategoryCard } from "@/components/category-card";
import { Faq } from "@/components/faq";
import { JsonLd } from "@/components/json-ld";
import { SmartSearch } from "@/components/smart-search";
import { homeFaq } from "@/lib/content/home-faq";
import { getConversionPageContent } from "@/lib/seo/conversion-pages";
import { categories, getAllUnits, totalCategoryCount } from "@/lib/units/registry";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const FEATURED_SLUGS = [
  "kilogram-to-pound",
  "celsius-to-fahrenheit",
  "kilometer-to-mile",
  "us-gallon-to-liter",
  "mile-per-hour-to-kilometer-per-hour",
  "psi-to-bar",
  "centimeter-to-inch",
  "kilowatt-to-horsepower",
];

export default function HomePage() {
  const featured = FEATURED_SLUGS.map((slug) => {
    try {
      const [fromId, toId] = slug.split("-to-");
      return getConversionPageContent({ slug, fromUnitId: fromId, toUnitId: toId, indexable: true });
    } catch {
      return null;
    }
  }).filter((x): x is NonNullable<typeof x> => x !== null);

  const totalUnits = getAllUnits().length;

  return (
    <div>
      <section className="mx-auto max-w-4xl px-4 pt-16 pb-12 text-center sm:pt-24 sm:pb-16">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">Convert anything.</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
          Fast, accurate and free unit conversions for science, engineering, everyday life and more.
        </p>
        <div className="mx-auto mt-8 max-w-2xl">
          <SmartSearch size="lg" />
        </div>
        <p className="mt-4 text-sm text-muted">
          {totalCategoryCount()} categories · {totalUnits}+ units ·{" "}
          <Link href="/convert" className="text-accent hover:underline">
            or open the full converter
          </Link>
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-4">
        <AdSlot position="top" />
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">Popular conversions</h2>
          <Link href="/converters" className="flex items-center gap-1 text-sm text-accent hover:underline">
            View all categories <ArrowRight size={14} />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {featured.map((item) => (
            <Link
              key={item.definition.slug}
              href={`/converters/${item.definition.slug}`}
              className="rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent"
            >
              <p className="text-sm font-semibold">
                {item.fromUnit.symbol} → {item.toUnit.symbol}
              </p>
              <p className="text-xs text-muted">
                {item.fromUnit.name} to {item.toUnit.name}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <h2 className="mb-6 text-xl font-semibold">Browse by category</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <AdSlot position="content" />
      </section>

      <section className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
        <h2 className="mb-6 text-xl font-semibold">Frequently asked questions</h2>
        <Faq items={homeFaq} />
      </section>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: homeFaq.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: { "@type": "Answer", text: item.answer },
          })),
        }}
      />
    </div>
  );
}
