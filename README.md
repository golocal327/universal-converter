# Universal Converter

**The world's ultimate unit conversion platform.** Fast, accurate, free unit conversions for science, engineering, everyday life and more — built with Next.js 16 (App Router), TypeScript, and Tailwind CSS 4.

Live architecture goals: SEO-first, mobile-first, AdSense-ready, and designed to scale from ~250 conversion pages today to thousands without the codebase becoming unmanageable.

## Table of contents

- [Architecture](#architecture)
- [Getting started](#getting-started)
- [Available scripts](#available-scripts)
- [Testing](#testing)
- [Environment variables](#environment-variables)
- [Deploying to Vercel](#deploying-to-vercel)
- [Adding a new unit](#adding-a-new-unit)
- [Adding a new category](#adding-a-new-category)
- [Adding a new SEO conversion page](#adding-a-new-seo-conversion-page)
- [Adding a new language](#adding-a-new-language-not-yet-implemented)
- [Enabling AdSense](#enabling-adsense)
- [Enabling Analytics](#enabling-analytics)
- [Enabling live currency rates](#enabling-live-currency-rates)
- [Known limitations](#known-limitations)

## Architecture

```
app/                      Next.js App Router routes (pages, layouts, metadata)
  converters/[slug]/      Dual-purpose dynamic route: category pages AND
                           individual SEO conversion pages (e.g. kg-to-lbs)
  convert/                The "Convert Anything" universal converter
  tools/                  Specialized calculators (non-linear conversions)
  guides/[slug]/          Educational long-form content
  api/currency/           Route handler for the currency tool
  sitemap.ts, robots.ts   Dynamic SEO infrastructure

components/                UI components (all presentational logic lives here)
  converter/                The reusable ConverterWidget + supporting pieces
  tools/                    One component per specialized tool

lib/
  units/
    types.ts                 UnitDefinition / CategoryDefinition types
    helpers.ts                defineLinearUnit / defineCustomUnit builders
    categories/*.ts           One file per category — THE unit database
    registry.ts                Central registry every page reads from
  convert.ts                 convert(), convertToAll(), reversibility helpers
  format.ts                  Precision-aware number formatting (Decimal.js)
  parser.ts                  Deterministic natural-language query parser
  search-index.ts            Alias index + lightweight fuzzy search
  seo/conversion-pages.ts    ConversionPageDefinition registry + content generator
  tools/                     Non-linear tools: fuel economy, battery, numeral
                              base, Roman numerals, Unix timestamp, currency
  hooks/                     Favorites / history (localStorage, useSyncExternalStore)
  content/                   Guides, tools metadata, home FAQ (structured data)

tests/                     Vitest suite for the conversion engine
```

### The conversion engine, in one paragraph

Every category (`lib/units/categories/*.ts`) has exactly one **base unit**. Every unit knows how to convert itself `toBase()` and `fromBase()`. Converting unit A to unit B always goes `A → base unit → B` (see `lib/convert.ts`). This means adding a new unit to an existing category is a one-line addition to that category's file — nothing else in the app needs to change. Linear units use `defineLinearUnit({ factor })`; non-multiplicative units (temperature) use `defineCustomUnit({ toBase, fromBase })` with explicit formulas. All arithmetic runs through `decimal.js` internally to avoid binary floating-point rounding artifacts.

### SEO pages, in one paragraph

`lib/seo/conversion-pages.ts` builds a curated list of `ConversionPageDefinition`s from each category's `popularPairs` (both directions). Each definition has an `indexable` flag so a conversion pair can exist and be linked internally without being submitted to search engines — the control the project spec calls for to avoid thin/duplicate content at scale. Page content (formula, examples, table, FAQ, related links) is generated from real unit metadata, not templated boilerplate, so pages for genuinely different unit pairs read differently.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Available scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the dev server (Turbopack) |
| `npm run build` | Production build (Turbopack) |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint (flat config, `eslint-config-next`) |
| `npm run test` | Run the Vitest suite once |
| `npm run test:watch` | Vitest in watch mode |

## Testing

100 tests across 5 files cover: unit registry integrity, known reference conversions (1 kg ≈ 2.20462262185 lb, 0°C = 32°F, 1 kWh = 3.6 MJ, etc.), full reversibility (A → B → A within every linear/temperature category), error handling, number formatting/locale parsing, the natural-language parser, and the non-linear tools (fuel economy, battery, numeral bases, Roman numerals, Unix timestamps).

```bash
npm run test
```

## Environment variables

Copy `.env.example` to `.env.local` and fill in what you need — everything works with all of them empty (ads/analytics stay disabled, currency falls back to a labeled manual rate table).

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Canonical URL base for metadata, sitemap, OpenGraph |
| `NEXT_PUBLIC_ADSENSE_CLIENT` | Your AdSense publisher ID — leave empty to keep ads off |
| `NEXT_PUBLIC_ADSENSE_SLOT_*` | Per-position AdSense slot IDs (top, content, afterConverter, sidebar, beforeFaq, bottom) |
| `NEXT_PUBLIC_GA_ID` | Google Analytics measurement ID — leave empty to disable |
| `CURRENCY_API_KEY` / `CURRENCY_API_URL` | Live exchange-rate API — leave empty to use the manual fallback table |

## Deploying to Vercel

1. Push this repository to GitHub (see below).
2. Import it in Vercel ([vercel.com/new](https://vercel.com/new)).
3. Add the environment variables you want from the table above.
4. Deploy — no special build configuration needed, this is a stock Next.js App Router project.

### Pushing to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/universal-converter.git
git push -u origin main
```

If you have the GitHub CLI installed and authenticated (`gh auth login`), you can instead run `gh repo create universal-converter --public --source=. --push`.

## Adding a new unit

Open the relevant file in `lib/units/categories/`, e.g. `mass.ts`, and add an entry to its `units` array:

```ts
defineLinearUnit({
  id: "stone",
  categoryId: "mass",
  name: "Stone",
  symbol: "st",
  system: "imperial",
  factor: 6.35029318, // 1 stone in kilograms (the category's base unit)
  aliases: ["stones", "piedra"],
});
```

That's it — the unit is now selectable everywhere in the category, included in search/aliases, and eligible for `convertToAll()`. For a unit with an offset instead of a pure ratio (like temperature), use `defineCustomUnit({ toBase, fromBase })` instead.

## Adding a new category

1. Create `lib/units/categories/your-category.ts` exporting a `CategoryDefinition` (see any existing file for the shape — base unit, icon name from `lucide-react`, `popularPairs`, `units`).
2. Register it in `lib/units/registry.ts`'s `categories` array.
3. Done — `/converters/your-category` now exists automatically (`generateStaticParams` reads the registry), it appears in the homepage grid, footer, header dropdown, and sitemap.

## Adding a new SEO conversion page

Add a pair to the relevant category's `popularPairs` array in its category file (both directions get generated automatically). For full control over a specific page's copy, extend `getConversionPageContent()` in `lib/seo/conversion-pages.ts`. Set `indexable: false` on a `ConversionPageDefinition` to keep a page live and internally linked without submitting it to search engines.

## Adding a new language (not yet implemented)

The codebase is currently English-only with Spanish unit aliases (so Spanish-language search queries like "100 kg a libras" resolve correctly) — see [Known limitations](#known-limitations). To add real i18n:

1. Introduce `app/[locale]/` routing (or `next-intl` / a similar library).
2. Move user-facing strings (currently inline in components) into locale message files.
3. Content data (`lib/content/*.ts`) would need per-locale variants.

## Enabling AdSense

Set `NEXT_PUBLIC_ADSENSE_CLIENT` and the per-position `NEXT_PUBLIC_ADSENSE_SLOT_*` variables. Until then, `<AdSlot>` renders a labeled, height-reserved placeholder (visible only in the sense that it reserves layout space — it causes no CLS and never overlaps converter controls). No AdSense approval is guaranteed by enabling this — that's Google's call.

## Enabling Analytics

Set `NEXT_PUBLIC_GA_ID` to a Google Analytics measurement ID; the gtag script loads automatically via `next/script`.

## Enabling live currency rates

Set `CURRENCY_API_KEY` and `CURRENCY_API_URL` (any provider that returns `{ rates: { CODE: number, ... } }` for a given base). Without them, `/tools/currency` and `/api/currency` serve a clearly labeled static fallback table — never silently pretend to be live.

## Known limitations

Read this section before assuming something works — it's the honest list, not a marketing page:

- **~250 units across 17 categories, ~100 SEO conversion pages** are implemented with real, tested constants — not the full 500+/thousands the long-term spec describes. The architecture (registry + `ConversionPageDefinition`) is built to scale to that; the content itself is not there yet.
- **Not implemented at all**: photography/lighting/sound/RF calculators, chemistry (molarity/ppm), clothing/shoe size charts, paper sizes, timezone converter, significant-figures/fraction/percentage tools, embeddable widgets, PWA/offline support, i18n routing, a real cookie-consent (CMP) implementation, and a JS SDK/public API.
- **Legal pages** (`/privacy`, `/cookies`, `/terms`, `/about`, `/contact`) are placeholder skeletons with `[bracketed]` fields — they are not legal advice and must be completed/reviewed before relying on them, especially before enabling AdSense/Analytics for EU or California visitors.
- **Currency rates** are either live (if you configure an API) or an illustrative static table — never treat the fallback numbers as real.
- A genuine **dev-mode-only Turbopack streaming quirk** was found and worked around during development (see git history / commit messages around the `/convert` page) — it did not affect the production build.
