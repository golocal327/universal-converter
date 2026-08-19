import Link from "next/link";
import { Suspense } from "react";
import { AdSlot } from "@/components/ad-slot";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ConversionTable } from "@/components/conversion-table";
import { ConverterWidget } from "@/components/converter/converter-widget";
import { Faq } from "@/components/faq";
import { JsonLd } from "@/components/json-ld";
import { siteConfig } from "@/lib/site-config";
import { getConversionPageContent, getConversionPageDefinition, type ConversionPageDefinition } from "@/lib/seo/conversion-pages";
import { getCategory } from "@/lib/units/registry";

export function ConversionView({ definition }: { definition: ConversionPageDefinition }) {
  const content = getConversionPageContent(definition);
  const { fromUnit, toUnit } = content;
  const category = getCategory(fromUnit.categoryId)!;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Converters", href: "/converters" },
          { label: category.name, href: `/converters/${category.id}` },
          { label: `${fromUnit.symbol} → ${toUnit.symbol}` },
        ]}
      />

      <h1 className="text-3xl font-semibold tracking-tight">{content.h1}</h1>
      <p className="mt-4 max-w-2xl leading-relaxed text-muted">{content.intro}</p>

      <div className="mt-8">
        <Suspense fallback={<div className="h-64 rounded-2xl border border-border bg-surface" />}>
          <ConverterWidget categoryId={category.id} defaultFromUnitId={fromUnit.id} defaultToUnitId={toUnit.id} defaultValue={1} />
        </Suspense>
      </div>

      <div className="mt-6">
        <AdSlot position="afterConverter" />
      </div>

      <section className="mt-12">
        <h2 className="mb-3 text-xl font-semibold">Formula</h2>
        <p className="rounded-xl border border-border bg-surface px-4 py-3 font-mono text-sm">{content.formula}</p>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-xl font-semibold">Quick examples</h2>
        <ul className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          {content.examples.map((example) => (
            <li key={example.input} className="rounded-lg bg-surface px-3 py-2">
              {example.input} {fromUnit.symbol} = <strong>{example.output.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}</strong>{" "}
              {toUnit.symbol}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-xl font-semibold">
          {fromUnit.name} to {toUnit.name} conversion table
        </h2>
        <ConversionTable fromSymbol={fromUnit.symbol} toSymbol={toUnit.symbol} rows={content.table} />
      </section>

      <section className="mt-10">
        <AdSlot position="beforeFaq" />
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-xl font-semibold">Frequently asked questions</h2>
        <Faq items={content.faq} />
      </section>

      {content.relatedSlugs.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-xl font-semibold">Related conversions</h2>
          <div className="flex flex-wrap gap-2">
            {content.relatedSlugs.map((slug) => {
              const def = getConversionPageDefinition(slug);
              if (!def) return null;
              return (
                <Link
                  key={slug}
                  href={`/converters/${slug}`}
                  className="rounded-full border border-border px-3 py-1.5 text-sm hover:border-accent hover:text-accent"
                >
                  {slug.replace(/-/g, " ")}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-8">
        <Link href={`/converters/${category.id}`} className="text-sm text-accent hover:underline">
          ← Back to all {category.name.toLowerCase()} conversions
        </Link>
      </section>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
            { "@type": "ListItem", position: 2, name: "Converters", item: `${siteConfig.url}/converters` },
            { "@type": "ListItem", position: 3, name: category.name, item: `${siteConfig.url}/converters/${category.id}` },
            {
              "@type": "ListItem",
              position: 4,
              name: `${fromUnit.name} to ${toUnit.name}`,
              item: `${siteConfig.url}/converters/${definition.slug}`,
            },
          ],
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: content.faq.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: { "@type": "Answer", text: item.answer },
          })),
        }}
      />
    </div>
  );
}
