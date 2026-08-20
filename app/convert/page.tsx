import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { FavoritesHistoryPanel } from "@/components/converter/favorites-history-panel";
import { UniversalConverter } from "@/components/converter/universal-converter";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Universal Converter — Convert Anything",
  description: `Convert any value between any two compatible units. ${siteConfig.name}'s full converter with every category, precision control, favorites and history.`,
  alternates: { canonical: "/convert" },
};

export default function ConvertPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Convert" }]} />
      <h1 className="text-3xl font-semibold tracking-tight">Convert anything</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Pick a category, choose your units, and get an instant result — plus every equivalent unit at once.
      </p>

      <div className="mt-8">
        <UniversalConverter />
      </div>

      <FavoritesHistoryPanel />
    </div>
  );
}
