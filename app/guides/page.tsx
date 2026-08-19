import { BookOpen } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { guides } from "@/lib/content/guides";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Guides",
  description: `Plain-language explanations of how common conversions work, straight from ${siteConfig.name} — formulas, worked examples and the gotchas that trip people up.`,
  alternates: { canonical: "/guides" },
};

export default function GuidesIndexPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Guides" }]} />
      <h1 className="text-3xl font-semibold tracking-tight">Guides</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Short, practical explanations of how and why common conversions work the way they do.
      </p>
      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {guides.map((guide) => (
          <Link
            key={guide.slug}
            href={`/guides/${guide.slug}`}
            className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-accent"
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <BookOpen size={16} />
            </span>
            <div>
              <p className="font-semibold">{guide.title}</p>
              <p className="text-sm text-muted">{guide.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
