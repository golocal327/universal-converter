import { Wrench } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { tools } from "@/lib/content/tools";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Tools",
  description: `Specialized calculators on ${siteConfig.name} for conversions that need more than a simple factor: numeral bases, Roman numerals, Unix timestamps, battery energy and fuel economy.`,
  alternates: { canonical: "/tools" },
};

export default function ToolsIndexPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Tools" }]} />
      <h1 className="text-3xl font-semibold tracking-tight">Tools</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Not every conversion is a simple multiplication. These tools handle the ones that need a real formula or extra
        context — numeral bases, Roman numerals, Unix timestamps, battery energy and fuel economy.
      </p>
      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {tools.map((tool) => (
          <Link
            key={tool.slug}
            href={`/tools/${tool.slug}`}
            className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-accent"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <Wrench size={18} />
            </span>
            <div>
              <p className="font-semibold">{tool.name}</p>
              <p className="text-sm text-muted">{tool.shortDescription}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
