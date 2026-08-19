import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryView } from "./_components/category-view";
import { ConversionView } from "./_components/conversion-view";
import { getConversionPageContent, getConversionPageDefinitions } from "@/lib/seo/conversion-pages";
import { categories, getCategory } from "@/lib/units/registry";

export function generateStaticParams() {
  const categoryParams = categories.map((c) => ({ slug: c.id }));
  const conversionParams = getConversionPageDefinitions().map((d) => ({ slug: d.slug }));
  return [...categoryParams, ...conversionParams];
}

export async function generateMetadata({ params }: PageProps<"/converters/[slug]">): Promise<Metadata> {
  const { slug } = await params;

  const category = getCategory(slug);
  if (category) {
    return {
      title: `${category.name} Converter`,
      description: category.shortDescription + ". " + category.description.slice(0, 120),
      alternates: { canonical: `/converters/${category.id}` },
    };
  }

  const definition = getConversionPageDefinitions().find((d) => d.slug === slug);
  if (definition) {
    const content = getConversionPageContent(definition);
    return {
      title: content.title,
      description: content.metaDescription,
      alternates: { canonical: `/converters/${definition.slug}` },
      robots: definition.indexable ? undefined : { index: false, follow: true },
    };
  }

  return {};
}

export default async function ConverterSlugPage({ params }: PageProps<"/converters/[slug]">) {
  const { slug } = await params;

  const category = getCategory(slug);
  if (category) return <CategoryView category={category} />;

  const definition = getConversionPageDefinitions().find((d) => d.slug === slug);
  if (definition) return <ConversionView definition={definition} />;

  notFound();
}
