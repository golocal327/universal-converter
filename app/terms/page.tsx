import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `Terms of service for ${siteConfig.name}.`,
  alternates: { canonical: "/terms" },
  robots: { index: false, follow: true },
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Terms of service" }]} />
      <h1 className="text-3xl font-semibold tracking-tight">Terms of service</h1>
      <p className="mt-2 text-sm text-muted">Last updated: [placeholder date]</p>

      <div className="mt-6 space-y-6 leading-relaxed text-muted">
        <p className="rounded-xl border border-border bg-surface p-4 text-sm">
          This is a placeholder terms-of-service skeleton, not a legally reviewed document. Have it reviewed for your
          jurisdiction before relying on it.
        </p>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">Use of the service</h2>
          <p>
            {siteConfig.name} is provided free of charge for personal and commercial reference use. You may not use
            automated systems to scrape or bulk-download the site&apos;s content in a way that degrades service for
            other users.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">No warranty on conversion accuracy</h2>
          <p>
            Conversions are provided &quot;as is&quot;, calculated from the constants described in{" "}
            <a href="/accuracy" className="text-accent hover:underline">
              Accuracy & methodology
            </a>
            . While the underlying engine is tested against known reference values, this site is not a substitute for
            certified/legal-for-trade measurement instruments in contexts where that matters (commerce, engineering
            sign-off, medical dosing, etc.). Always verify critical calculations independently.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">Changes to these terms</h2>
          <p>These terms may be updated from time to time. [Placeholder — describe your update/notice process.]</p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">Contact</h2>
          <p>[Placeholder contact email / entity name.]</p>
        </section>
      </div>
    </div>
  );
}
