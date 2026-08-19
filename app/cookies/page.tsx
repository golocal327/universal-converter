import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: `Cookie policy for ${siteConfig.name}.`,
  alternates: { canonical: "/cookies" },
  robots: { index: false, follow: true },
};

const cookieCategories = [
  {
    name: "Strictly necessary",
    always: true,
    description: "Theme preference (light/dark/system). Stored in localStorage, not a cookie, but listed here for completeness.",
  },
  {
    name: "Analytics",
    always: false,
    description: "Google Analytics, if NEXT_PUBLIC_GA_ID is configured. Used to understand aggregate traffic patterns.",
  },
  {
    name: "Advertising",
    always: false,
    description: "Google AdSense, if NEXT_PUBLIC_ADSENSE_CLIENT is configured. May be used to personalize ads.",
  },
];

export default function CookiesPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Cookie policy" }]} />
      <h1 className="text-3xl font-semibold tracking-tight">Cookie policy</h1>
      <p className="mt-2 text-sm text-muted">Last updated: [placeholder date]</p>

      <div className="mt-6 space-y-6 leading-relaxed text-muted">
        <p className="rounded-xl border border-border bg-surface p-4 text-sm">
          This page describes the categories of cookies this site&apos;s architecture supports. A real, legally
          compliant consent banner (CMP) is NOT implemented — the project spec explicitly calls for preparing the
          architecture without inventing legal compliance. Add a CMP (e.g. a consent-management platform) before
          enabling analytics or ads for EU/UK visitors.
        </p>

        <div className="divide-y divide-border rounded-xl border border-border">
          {cookieCategories.map((cat) => (
            <div key={cat.name} className="p-4">
              <p className="font-medium text-foreground">
                {cat.name} {cat.always && <span className="text-xs text-muted">(always active)</span>}
              </p>
              <p className="mt-1 text-sm">{cat.description}</p>
            </div>
          ))}
        </div>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">Managing cookies</h2>
          <p>
            Most browsers let you block or delete cookies via their settings. Blocking analytics/advertising cookies
            does not affect the site&apos;s core conversion functionality.
          </p>
        </section>
      </div>
    </div>
  );
}
