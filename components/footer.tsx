import Link from "next/link";
import { categories } from "@/lib/units/registry";
import { siteConfig } from "@/lib/site-config";

const productLinks = [
  { href: "/convert", label: "Universal converter" },
  { href: "/converters", label: "All categories" },
  { href: "/tools", label: "Tools" },
  { href: "/guides", label: "Guides" },
];

const companyLinks = [
  { href: "/about", label: "About" },
  { href: "/accuracy", label: "Accuracy & methodology" },
  { href: "/contact", label: "Contact" },
];

const legalLinks = [
  { href: "/privacy", label: "Privacy policy" },
  { href: "/cookies", label: "Cookie policy" },
  { href: "/terms", label: "Terms of service" },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          <div className="col-span-2">
            <p className="font-semibold">{siteConfig.name}</p>
            <p className="mt-2 max-w-xs text-sm text-muted">{siteConfig.description}</p>
          </div>
          <FooterColumn title="Product" links={productLinks} />
          <FooterColumn title="Company" links={companyLinks} />
          <FooterColumn title="Legal" links={legalLinks} />
        </div>

        <div className="mt-10 border-t border-border pt-6">
          <p className="mb-3 text-xs font-medium tracking-wide text-muted uppercase">Popular categories</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted">
            {categories.map((category) => (
              <Link key={category.id} href={`/converters/${category.id}`} className="hover:text-foreground">
                {category.name}
              </Link>
            ))}
          </div>
        </div>

        <p className="mt-8 text-xs text-muted">
          © {new Date().getFullYear()} {siteConfig.name}. All conversion factors are based on internationally
          recognized standards (SI/BIPM, NIST) where applicable — see{" "}
          <Link href="/accuracy" className="underline hover:text-foreground">
            Accuracy & methodology
          </Link>
          .
        </p>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <p className="mb-3 text-xs font-medium tracking-wide text-muted uppercase">{title}</p>
      <ul className="space-y-2 text-sm">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-muted hover:text-foreground">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
