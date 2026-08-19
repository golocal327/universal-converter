import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Accuracy & Methodology",
  description: `How ${siteConfig.name} calculates conversions, handles rounding, and where the underlying constants come from.`,
  alternates: { canonical: "/accuracy" },
};

export default function AccuracyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Accuracy & methodology" }]} />
      <h1 className="text-3xl font-semibold tracking-tight">Accuracy & methodology</h1>

      <div className="mt-6 space-y-6 leading-relaxed text-muted">
        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">Exact vs. defined vs. approximate</h2>
          <p>
            Some conversion factors are mathematically exact by definition (1 inch = 0.0254 m, exactly, by
            international agreement). Others are physical constants known to high but finite precision (the speed of
            light is exact by definition of the meter; the speed of sound is not, and varies with temperature and
            altitude). Others are conventional approximations openly presented as such — a calendar month, for unit-conversion
            purposes, is treated as a fixed 30.44-day average, because a real month is 28–31 days depending on which one.
            Every category page states which kind of constant it&apos;s using.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">Floating point and rounding</h2>
          <p>
            JavaScript&apos;s native numbers are IEEE-754 binary floating point, which cannot represent most decimal
            fractions exactly — this is why naive conversions can produce results like 2.6999999999999997 instead of
            2.7. The conversion engine performs its core arithmetic with an arbitrary-precision decimal library rather
            than raw floating point, and rounds only once, at the very end, for display. Internal precision is always
            higher than what&apos;s shown on screen.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">Display precision vs. internal precision</h2>
          <p>
            The precision selector (Automatic, 0–10 decimals, scientific, engineering) only controls how a result is
            displayed — it never feeds back into the calculation. Changing precision on a chain of conversions
            recomputes from the original input every time, rather than compounding rounding error from a previously
            rounded result.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">Where constants come from</h2>
          <p>
            SI base and derived units follow BIPM (Bureau International des Poids et Mesures) definitions. Imperial
            and US customary length and mass units follow the 1959 international yard and pound agreement. Physical
            constants (electronvolt, atomic mass unit, etc.) use CODATA recommended values. Each unit&apos;s page notes
            its source where one applies.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">What this tool does NOT do</h2>
          <p>
            It does not convert between fundamentally different physical quantities without extra information — mass
            to volume (needs density), lux to lumens (needs geometry), decibels to linear amplitude (needs a
            reference level). Where the project provides a calculator for these, it asks for the extra input rather
            than pretending a universal conversion factor exists.
          </p>
        </section>
      </div>
    </div>
  );
}
