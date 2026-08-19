import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Contact",
  description: `Get in touch about ${siteConfig.name}.`,
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Contact" }]} />
      <h1 className="text-3xl font-semibold tracking-tight">Contact</h1>
      <div className="mt-6 space-y-4 leading-relaxed text-muted">
        <p>
          Found an incorrect conversion factor, a missing unit, or a bug? [Placeholder — add a real contact email,
          contact form, or issue-tracker link here.]
        </p>
        <p>
          If a GitHub repository is public, bug reports and unit requests can also go through its issue tracker:{" "}
          <a href={siteConfig.github} className="text-accent hover:underline" target="_blank" rel="noreferrer">
            {siteConfig.github}
          </a>
          .
        </p>
      </div>
    </div>
  );
}
