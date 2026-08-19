import Link from "next/link";
import { Suspense } from "react";
import { AdSlot } from "@/components/ad-slot";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ConverterWidget } from "@/components/converter/converter-widget";
import { Faq } from "@/components/faq";
import { Icon } from "@/components/icon";
import { JsonLd } from "@/components/json-ld";
import { siteConfig } from "@/lib/site-config";
import { slugForPair } from "@/lib/search-index";
import { categories, getUnit } from "@/lib/units/registry";
import type { CategoryDefinition } from "@/lib/units/types";

export function CategoryView({ category }: { category: CategoryDefinition }) {
  const [defaultFrom, defaultTo] = category.popularPairs?.[0] ?? [
    category.units[0]?.id,
    category.units[1]?.id ?? category.units[0]?.id,
  ];

  const popularLinks = (category.popularPairs ?? []).flatMap(([a, b]) => [
    { slug: slugForPair(a, b), from: getUnit(a), to: getUnit(b) },
    { slug: slugForPair(b, a), from: getUnit(b), to: getUnit(a) },
  ]);

  const otherCategories = categories.filter((c) => c.id !== category.id).slice(0, 6);

  const faqItems = [
    {
      question: `What is the base unit for ${category.name.toLowerCase()}?`,
      answer: `Every conversion in this category goes through ${getUnit(category.baseUnitId)?.name ?? category.baseUnitId}, which acts as the common reference point. Converting unit A to unit B always works by converting A to the base unit, then the base unit to B.`,
    },
    {
      question: `How many ${category.name.toLowerCase()} units does this converter support?`,
      answer: `This category currently supports ${category.units.length} units: ${category.units.map((u) => u.name).join(", ")}.`,
    },
    {
      question: `Is this ${category.name.toLowerCase()} converter free to use?`,
      answer: `Yes — every converter, table and page on ${siteConfig.name} is free, with no sign-up required.`,
    },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Converters", href: "/converters" }, { label: category.name }]} />

      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <Icon name={category.icon} size={20} />
        </span>
        <h1 className="text-3xl font-semibold tracking-tight">{category.name} Converter</h1>
      </div>
      <p className="mt-4 max-w-2xl leading-relaxed text-muted">{category.description}</p>

      <div className="mt-8">
        <Suspense fallback={<div className="h-64 rounded-2xl border border-border bg-surface" />}>
          <ConverterWidget
            categoryId={category.id}
            defaultFromUnitId={defaultFrom}
            defaultToUnitId={defaultTo}
            showConvertToAll
          />
        </Suspense>
      </div>

      <div className="mt-6">
        <AdSlot position="afterConverter" />
      </div>

      {popularLinks.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-xl font-semibold">Popular {category.name.toLowerCase()} conversions</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {popularLinks.map(
              (link) =>
                link.from &&
                link.to && (
                  <Link
                    key={link.slug}
                    href={`/converters/${link.slug}`}
                    className="rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent"
                  >
                    <p className="text-sm font-semibold">
                      {link.from.symbol} → {link.to.symbol}
                    </p>
                    <p className="text-xs text-muted">
                      {link.from.name} to {link.to.name}
                    </p>
                  </Link>
                )
            )}
          </div>
        </section>
      )}

      <section className="mt-12">
        <h2 className="mb-4 text-xl font-semibold">All {category.name.toLowerCase()} units</h2>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Unit</th>
                <th className="px-4 py-2 font-medium">Symbol</th>
                <th className="px-4 py-2 font-medium">System</th>
              </tr>
            </thead>
            <tbody>
              {category.units.map((unit) => (
                <tr key={unit.id} className="border-t border-border">
                  <td className="px-4 py-2">{unit.name}</td>
                  <td className="px-4 py-2 font-mono text-xs text-muted">{unit.symbol}</td>
                  <td className="px-4 py-2 text-muted capitalize">{unit.system}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="mb-4 text-xl font-semibold">Frequently asked questions</h2>
        <Faq items={faqItems} />
      </section>

      <section className="mt-12">
        <h2 className="mb-4 text-xl font-semibold">Other categories</h2>
        <div className="flex flex-wrap gap-2">
          {otherCategories.map((c) => (
            <Link
              key={c.id}
              href={`/converters/${c.id}`}
              className="rounded-full border border-border px-3 py-1.5 text-sm hover:border-accent hover:text-accent"
            >
              {c.name}
            </Link>
          ))}
        </div>
      </section>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
            { "@type": "ListItem", position: 2, name: "Converters", item: `${siteConfig.url}/converters` },
            { "@type": "ListItem", position: 3, name: category.name, item: `${siteConfig.url}/converters/${category.id}` },
          ],
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqItems.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: { "@type": "Answer", text: item.answer },
          })),
        }}
      />
    </div>
  );
}
