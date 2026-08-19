import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { siteConfig } from "@/lib/site-config";
import { getAllUnits, totalCategoryCount } from "@/lib/units/registry";

export const metadata: Metadata = {
  title: "About",
  description: `What ${siteConfig.name} is, how conversions are calculated, and what standards they're based on.`,
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "About" }]} />
      <h1 className="text-3xl font-semibold tracking-tight">About {siteConfig.name}</h1>

      <div className="mt-6 space-y-6 leading-relaxed text-muted">
        <p>
          {siteConfig.name} is a free unit-conversion platform covering {totalCategoryCount()} categories and{" "}
          {getAllUnits().length}+ units — from everyday conversions like kilograms to pounds, to specialized ones for
          engineering, electronics, chemistry and computing.
        </p>
        <p>
          The goal is a single, fast, accurate tool rather than dozens of single-purpose calculators scattered across
          the web. Every category shares the same underlying conversion engine, so a length conversion and a pressure
          conversion are computed with the same care and the same precision guarantees.
        </p>

        <h2 className="text-lg font-semibold text-foreground">How conversions are calculated</h2>
        <p>
          Every unit in a category converts to and from that category&apos;s base unit (for example, the meter for
          length, or the kilogram for mass). Converting unit A to unit B always goes A → base unit → B, using a fixed
          multiplier or, for units like temperature that have an offset instead of a pure ratio, an explicit formula.
          Internally, the engine uses arbitrary-precision decimal arithmetic (not raw binary floating point) for the
          conversion math itself, to avoid the small rounding artifacts that pure JavaScript floats can introduce.
        </p>

        <h2 className="text-lg font-semibold text-foreground">Standards and sources</h2>
        <p>
          Where a unit has an internationally defined constant — SI base and derived units, the international
          inch/foot/pound agreement, IAU-defined astronomical units, and so on — that exact defined value is used.
          Where a unit is inherently approximate or context-dependent (a calendar month, the speed of sound, cooking
          ingredient density), the page for that conversion says so explicitly rather than presenting it as an exact
          figure. See the{" "}
          <a href="/accuracy" className="text-accent hover:underline">
            Accuracy & methodology
          </a>{" "}
          page for more detail.
        </p>

        <h2 className="text-lg font-semibold text-foreground">Who&apos;s behind this</h2>
        <p>
          [Placeholder — add your company/individual name, and any other &quot;about the team&quot; details you want
          published here.]
        </p>
      </div>
    </div>
  );
}
