import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `Privacy policy for ${siteConfig.name}.`,
  alternates: { canonical: "/privacy" },
  robots: { index: false, follow: true },
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Privacy policy" }]} />
      <h1 className="text-3xl font-semibold tracking-tight">Privacy policy</h1>
      <p className="mt-2 text-sm text-muted">Last updated: [placeholder date]</p>

      <div className="mt-6 space-y-6 leading-relaxed text-muted">
        <p className="rounded-xl border border-border bg-surface p-4 text-sm">
          This is a placeholder privacy policy skeleton, not a legally reviewed document. Replace the bracketed
          sections with your actual entity name, contact details and jurisdiction-specific requirements (e.g. GDPR
          if you have EU visitors, CCPA for California) before publishing this site publicly or submitting it to
          AdSense.
        </p>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">Who this policy covers</h2>
          <p>This policy applies to [Company/Individual name], operator of {siteConfig.name} ({siteConfig.url}).</p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">Data stored locally in your browser</h2>
          <p>
            Favorites, recent conversion history, and your theme preference are stored in your browser&apos;s
            localStorage. This data never leaves your device or gets sent to any server — clearing your browser data
            removes it completely.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">Analytics</h2>
          <p>
            If Google Analytics is enabled (via the NEXT_PUBLIC_GA_ID environment variable), aggregated, anonymized
            usage data such as page views and general geographic region may be collected. [Add details of your actual
            analytics configuration and retention policy here.]
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">Advertising</h2>
          <p>
            If Google AdSense is enabled (via the NEXT_PUBLIC_ADSENSE_CLIENT environment variable), Google and its
            partners may use cookies to serve ads based on a user&apos;s prior visits to this or other websites. Users
            can opt out of personalized advertising through{" "}
            <a href="https://adssettings.google.com" className="text-accent hover:underline" target="_blank" rel="noreferrer">
              Google Ads Settings
            </a>
            . See the <a href="/cookies" className="text-accent hover:underline">Cookie policy</a> for more.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">Contact</h2>
          <p>Questions about this policy: [placeholder contact email].</p>
        </section>
      </div>
    </div>
  );
}
