import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CurrencyTool } from "@/components/tools/currency-tool";

export const metadata: Metadata = {
  title: "Currency Converter",
  description: "Convert between major world currencies. Uses a live exchange-rate API when configured, with a clearly labeled manual fallback otherwise.",
  alternates: { canonical: "/tools/currency" },
};

export default function CurrencyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Tools", href: "/tools" }, { label: "Currency Converter" }]} />
      <h1 className="text-3xl font-semibold tracking-tight">Currency Converter</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Unlike physical units, exchange rates change constantly and depend on a live data feed rather than a fixed
        constant. This tool is architected to pull live rates from an external API — configure CURRENCY_API_KEY and
        CURRENCY_API_URL to enable it.
      </p>
      <div className="mt-8">
        <CurrencyTool />
      </div>
    </div>
  );
}
