import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { getGuide, guides } from "@/lib/content/guides";
import { siteConfig } from "@/lib/site-config";

export function generateStaticParams() {
  return guides.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: PageProps<"/guides/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return {};
  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical: `/guides/${guide.slug}` },
  };
}

export default async function GuidePage({ params }: PageProps<"/guides/[slug]">) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Guides", href: "/guides" }, { label: guide.title }]} />
      <h1 className="text-3xl font-semibold tracking-tight">{guide.title}</h1>
      <p className="mt-3 text-muted">{guide.description}</p>

      <article className="mt-8 space-y-6">
        {guide.sections.map((section, index) => (
          <section key={section.heading ?? index}>
            {section.heading && <h2 className="mb-2 text-lg font-semibold">{section.heading}</h2>}
            {section.paragraphs.map((paragraph, pIndex) => (
              <p key={pIndex} className="leading-relaxed text-muted">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </article>

      {guide.relatedConversionSlug && (
        <div className="mt-10 rounded-xl border border-border bg-surface p-4">
          <Link href={`/converters/${guide.relatedConversionSlug}`} className="text-sm font-medium text-accent hover:underline">
            Open the interactive converter for this guide →
          </Link>
        </div>
      )}

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: guide.title,
          description: guide.description,
          url: `${siteConfig.url}/guides/${guide.slug}`,
        }}
      />
    </div>
  );
}
