# WIRE Sales OS

Sales intelligence + lead generation + CRM for **WIRE** (premium websites, redesigns, maintenance, SEO, automation, booking systems, chatbots, AI and NFC/QR review systems).

It answers two questions every day:

1. **Who should WIRE sell to tomorrow?** — every lead gets an explainable 0–100 score from its website audit, Google reputation, social presence and business potential.
2. **What should we offer, and how do we contact them?** — a configurable pricing engine recommends a package, and outreach (4 email variants, WhatsApp, call script, objections, proposal) is generated from the lead's real data — with or without an AI provider.

```
DISCOVER → ANALYZE → SCORE → CREATE LEAD → PERSONALIZE → FOLLOW UP → PROPOSAL → CLOSE → CUSTOMER
```

> Multi-tenant (workspaces) from day one, so it can become a commercial SaaS without a data-model rewrite.

---

## Table of contents

- [What's inside](#whats-inside)
- [Architecture](#architecture)
- [Stack](#stack)
- [Project structure](#project-structure)
- [Data model & security](#data-model--security)
- [Engines](#engines)
- [AI architecture](#ai-architecture)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Supabase setup & migrations](#supabase-setup--migrations)
- [Seed / demo data](#seed--demo-data)
- [Testing](#testing)
- [Deployment (Vercel)](#deployment-vercel)
- [Automation: events, webhooks & public API](#automation-events-webhooks--public-api)
- [Integrations](#integrations)
- [Known limitations](#known-limitations)
- [Moving to its own repository](#moving-to-its-own-repository)

---

## What's inside

| Area | What works |
|---|---|
| **Command Center** (`/`) | What needs attention (hot leads not contacted, overdue follow-ups, proposals awaiting response, meetings tomorrow), top 10 leads to contact with reasons, sellable packages with potential value, weekly performance, **Daily Briefing** (rules-based; "Write with AI" when configured). |
| **Dashboard** | Leads found / qualified / contacted, replies, meetings, proposals, won, lost, conversion rate, pipeline value, weighted pipeline, closed revenue, MRR, one-time revenue, funnel, pipeline by stage, hot leads, pending tasks, activity. 7d/30d/90d/12m. |
| **Leads** | Server-paginated table, URL filters (sector, city, province, score range, website state, max website score, reviews, rating, stage, contact status, campaign, source, status), **saved filters** (private/shared), sorting, bulk actions (add to pipeline, rescore, audit, campaign, contact status, disqualify, delete). |
| **Lead creation** | Manual form (React Hook Form + Zod) → same pipeline as every source: normalize → validate → **dedupe** (domain, phone, email, name+city) → score → CRM. Optional immediate website audit. |
| **CSV import** | Drag & drop, automatic column mapping (ES/EN headers), preview, dedupe report ("1,240 found · 1,108 new · 87 duplicates · 45 invalid"), chunked import with progress, campaign assignment. |
| **Prospects / Find Leads** | Google Places (New) Text Search by sector + location → pre-scored, de-duplicated against the CRM, high/medium/low priority, biggest opportunity, recommended action → selective import. Clear "configuration required" state without a key. |
| **Company profile** | Overview, **Why this lead?** (why now, what to sell, best angle, estimated value), detected problems, itemized **lead score** with category caps, contact & presence, contacts, lead notes, website audit, outreach, timeline, tasks, deals, documents (proposals + private file storage), AI analysis. |
| **Website audit engine** | SSRF-safe fetch → Technical / UX / Commercial checks → Performance, SEO, UX, Conversion, Mobile scores + ranked opportunities mapped to WIRE services. Optional Lighthouse via PageSpeed Insights. |
| **Outreach** | 4 email variants (Direct, Professional, High-ticket, Follow-up), 3 WhatsApp messages, call script, objections & responses, templates rendered with real data. Copy / open in mail app / `wa.me` click-to-chat / **send via Resend** / log as sent. Logging advances the deal, updates contact status, creates a 3-day follow-up task and updates campaign metrics. |
| **Pipeline** | Kanban NEW → QUALIFIED → CONTACTED → REPLIED → MEETING → PROPOSAL → NEGOTIATION → WON / LOST. Drag & drop (mouse + keyboard), optimistic updates, lost-reason prompt, value / probability / weighted value / next action / last contact / follow-up per card. |
| **Tasks** | Today (incl. overdue) / Upcoming / Overdue / Completed, priorities, types (contact, email, call, follow-up, proposal, meeting, demo, close), optimistic completion. |
| **Campaigns** | Target sector + location + website requirement; leads, contacted, delivered, opened, replied, meetings, won, conversion, revenue; "Add matching leads". |
| **Templates** | Full CRUD (create, edit, duplicate, delete, categorize), `{{variables}}`, unknown-variable warnings, live preview with a real lead. |
| **Analytics** | Funnel with step conversion, revenue by sector / campaign / city / service, average deal size, MRR, ARR, win rate, contacts/day, replies/day, meetings/week, proposals, sales. |
| **AI Copilot** | "Analyze this lead" (structured: summary, score assessment, opportunities, problems, service, price, angle, email, WhatsApp, call script, follow-up), free-form chat grounded in the lead, quick prompts. Every generation is logged. |
| **Proposals** | Generated from lead data (rules engine) or AI; printable document (Print / Save as PDF); structured JSON content ready for server-side PDF later; status changes advance the pipeline. |
| **Sector intelligence & pricing** | 12 sectors (Autoescuelas, Clínicas, Fisioterapia, Restaurantes, Barberías, Talleres, Inmobiliarias, Asesorías, Veterinarios, Gimnasios, Hoteles, Seguros) with score weights, value tier, recommended services, pricing, common problems, sales arguments; configurable pricing rules and service catalog. |
| **Platform** | ⌘K command palette (search + actions), `g` / `c` keyboard shortcuts, light/dark/system theme, responsive (desktop first), skeleton-free server rendering, toasts, confirmations, empty and error states. |

## Architecture

```
                        ┌──────────────────────── Next.js 16 (App Router) ───────────────────────┐
 Browser ── proxy.ts ──▶│ Server Components (pages)   Server Actions (lib/actions)   Route Handlers │
 (session refresh,      │        │                          │                         /api/v1/leads │
  auth redirect)        │        ▼                          ▼                         /api/cron/…   │
                        │   lib/data (read models)    lib/services (business logic)                 │
                        │        │                   ingest · scoring · audits · pipeline ·         │
                        │        │                   outreach · events · ai · lead-context          │
                        │        ▼                          │                                       │
                        │   Pure engines (no I/O, unit tested): lead-pipeline · scoring · audit     │
                        │   analyzer · pricing · outreach generators · templates                   │
                        └────────┬───────────────────────────┬──────────────────────────────────────┘
                                 │ supabase-js (user JWT)     │ adapters
                                 ▼                            ▼
                   Supabase Postgres + RLS + Auth      Anthropic / OpenAI · Google Places ·
                   (views, SQL analytics, triggers)    PageSpeed · Resend · Webhooks (n8n…)
```

**Lead pipeline** (shared by CSV, manual form, Find Leads and the public API):

```
Lead Source → Normalizer → Validator → Deduplicator → Scoring Engine → CRM (+ timeline + events)
```

Design rules:
- **User-scoped by default.** Pages and actions use the signed-in user's Supabase client, so Row Level Security is the authorization layer. The service-role client is used only where there is no user (public API with hashed keys, webhook delivery, secrets, seed).
- **Thin actions, testable engines.** Server actions validate input with Zod and call services; scoring, auditing, pricing, dedupe and copy generation are pure functions with unit tests.
- **No fake functionality.** Integrations without credentials show a "configuration required" state; nothing pretends to send, search or analyse.

## Stack

Next.js 16 (App Router, Turbopack, Server Actions, `proxy.ts`) · React 19 · TypeScript (strict) · Tailwind CSS 4 · shadcn/ui (Radix) · Supabase (Postgres, Auth, Storage, RLS) · Zod 4 · React Hook Form · dnd-kit · cmdk · sonner · Papa Parse · node-html-parser · Anthropic SDK · OpenAI SDK · Vitest · Playwright (smoke).

Deliberately **not** used: TanStack Query (Server Components + Server Actions + `router.refresh()` cover data fetching and mutations without a client cache to keep in sync) and a chart library (the charts needed — bars, funnel, small-multiple columns — are a few dozen lines of accessible HTML/CSS each).

## Project structure

```
app/
  (auth)/login, signup        Auth screens          auth/callback, auth/confirm   Supabase links
  (app)/                      Authenticated app (sidebar layout)
    page.tsx                  Command Center        dashboard/ analytics/
    leads/ (new, import)      prospects/            companies/[id]   contacts/
    pipeline/ campaigns/[id]  tasks/ templates/     copilot/ proposals/[id]   settings/
  api/v1/leads                Public Lead API       api/cron/deliver-events   api/health
  onboarding/ setup/          Workspace creation / configuration-required screen
components/                   app shell, charts, feature components, ui/ (shadcn)
lib/
  actions/                    Server actions (Zod-validated, "use server")
  services/                   Business logic (ingest, scoring, audits, pipeline, outreach, events, ai…)
  data/                       Read models for pages (analytics, command center)
  lead-pipeline/              normalize · validate · dedupe · csv-mapping · sector-match
  scoring/  audit/  pricing/  outreach/  templates/   Pure engines
  ai/                         AIProvider interface, Anthropic & OpenAI providers, prompts
  integrations/               Google Places, PageSpeed, Resend, registry, adapter contracts
  supabase/                   server/browser/admin clients, proxy session, generated DB types
supabase/
  migrations/                 Schema, RLS, views & SQL analytics, storage
  tests/supabase-shim.sql     Supabase roles + auth.uid() for plain-Postgres tests
scripts/  gen-db-types.ts · seed.ts
tests/    unit/ (engines, filters, SSRF, conventions) · db/ (RLS, triggers, analytics) · e2e/smoke.mjs
```

## Data model & security

Tables: `workspaces`, `profiles` (users), `workspace_members`, `settings`, `workspace_secrets`, `companies`, `contacts`, `leads`, `lead_scores`, `website_audits`, `deals`, `deal_stage_history`, `pipeline_stages`, `activities`, `tasks`, `campaigns`, `campaign_leads`, `email_templates`, `messages`, `proposals`, `documents`, `services`, `sectors`, `sector_services`, `pricing_rules`, `ai_generations`, `discovery_runs`, `prospects`, `import_jobs`, `saved_filters`, `events`, `api_keys`, `rate_limits`.
Read models: `lead_overview`, `deal_overview`, `campaign_overview`. SQL functions: `get_dashboard_metrics`, `get_analytics`, `lead_funnel`, `global_search`, `create_workspace`, `check_rate_limit`.

Security model (verified by `tests/db` and the E2E run):
- **RLS on every table**; members access only their workspace's rows; configuration tables (sectors, services, pricing, stages, settings, API keys) are admin-write.
- **Composite foreign keys `(workspace_id, id)`** — a row can never reference a record in another workspace, even with a guessed UUID.
- `anon` has no privileges in `public` (tables, views or functions). Workspaces are created only through `create_workspace()`.
- `workspace_secrets` and `rate_limits` have RLS with no policies (service role / definer functions only). Webhook secrets and API keys are shown once; API keys are stored as SHA-256 hashes.
- Append-only audit trail (`deal_stage_history`, `ai_generations`, `lead_scores`).
- Durable rate limits (DB-backed, work across serverless instances): audits 30/h, AI 60/h, discovery 20/h, imports 20/h, sending 100/h per user; public API 60/min per key.
- Website audits use an **SSRF-safe fetcher**: http(s) only, default ports, DNS answers checked against private/reserved ranges and the socket pinned to the validated IP (no DNS rebinding), redirect/size/time limits.
- Open-redirect protection on auth `next` params; security headers (`X-Frame-Options`, `nosniff`, referrer & permissions policies); secrets only in server-only modules (enforced by a test that forbids importing `server-only` modules from client components).

## Engines

**Lead scoring (0–100)** — `lib/scoring/engine.ts`. Factors by category, each explained ("+25 No website", "+15 500+ Google reviews", "+12 High-value sector", "+12 No online booking", "+10 Weak Google conversion"…). Sector weights multiply categories; caps (website 45, google 30, business 30, social 12) stop any dimension from dominating, and the UI shows when a cap applies so the numbers always add up. Priority: hot ≥ 75, warm ≥ 50 (configurable), target areas give +4.

**Website audit** — `lib/audit/analyzer.ts`. Technical (HTTPS, response time, page weight, scripts, compression, title, description, H1/headings, canonical, robots, sitemap, structured data, lang, alt text, Open Graph, noindex, broken links), UX (navigation, contact options, content depth, readability, favicon, legacy signals), Mobile (viewport, fluid layout, tap-to-call, responsive images, WhatsApp) and Commercial (CTAs, booking providers such as Doctoralia/Booksy/TheFork/Calendly, WhatsApp, lead capture, trust signals, clear offer, pricing, conversion points). Output: five scores + overall + ranked opportunities → WIRE services.

**Pricing** — `lib/pricing/engine.ts`. Business potential (reviews, team size, sector tier, rating) × website quality (none/low/medium/high) × sector tier → first matching rule by priority → package (setup + monthly) + extras from the service catalog based on detected opportunities.

**Outreach** — `lib/outreach/generators.ts`. Builds Spanish copy from `LeadContext` (company, contact, sector playbook, score factors, audit, pricing). Never "Somos una agencia…": every message opens with what was noticed about that business.

> **Default prices and sector data are starting points for the Spanish SMB market, not market research.** Review them in Settings → Pricing / Sector intelligence before using them with clients.

## AI architecture

`lib/ai/types.ts` defines a provider-agnostic `AIProvider` (`generateText`, `generateObject` with Zod schemas). Implementations:

- **Anthropic** (`@anthropic-ai/sdk`) — default model `claude-opus-5-5`, adaptive thinking with explicit effort, structured outputs via `betaZodOutputFormat`, and **server-side fallbacks** (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`): if a safety classifier declines, the API re-runs the request on Anthropic's recommended fallback model. A final refusal surfaces as a clear error.
- **OpenAI** (`openai`) — Chat Completions with `zodResponseFormat` for structured output; model via `OPENAI_MODEL`.

Provider resolution: workspace setting → `AI_PROVIDER` → whichever key exists (Anthropic first). Model override per workspace or `ANTHROPIC_MODEL` / `OPENAI_MODEL`.

Every call is logged in `ai_generations`: kind, provider, model, prompt (system + messages), response, input/output tokens, latency, status/error, user, company and lead. Prompts contain only the lead's stored data and instruct the model not to invent facts.

Without an AI key, the rules engine still produces scores, "Why this lead?", 4 emails, WhatsApp, call script, objections, proposals and the daily briefing — labelled as rules-based. The Copilot chat shows a configuration-required state.

## Getting started

Requirements: Node.js ≥ 20.9 (22 recommended), a Supabase project (or the Supabase CLI for local).

```bash
cd wire-sales-os
npm install
cp .env.example .env.local      # fill in Supabase URL + keys
# apply the database (see next sections), then:
npm run db:types                # optional: regenerate typed DB definitions (needs a local Postgres)
npm run seed                    # optional: demo account + demo workspace
npm run dev                     # http://localhost:3000
```

Without Supabase variables the app shows `/setup` (configuration required) instead of failing.

Scripts:

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` · `npm run typecheck` | ESLint · `tsc --noEmit` |
| `npm test` | Unit tests (engines, filters, SSRF fetcher, platform, conventions) |
| `npm run db:test` | Applies the migrations to a throwaway Postgres DB and tests RLS, triggers, analytics, rate limits (`TEST_DATABASE_URL`, default `postgres://postgres:postgres@localhost:5432/postgres`) |
| `npm run db:types` | Regenerates `lib/supabase/database.types.ts` from the migrations (same shape as `supabase gen types`) |
| `npm run seed` | Creates `SEED_EMAIL` / `SEED_PASSWORD` and a demo workspace through the app services |

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Anon (or publishable, via `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) key — public, protected by RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | for API, webhooks, seed | **Server only.** Never prefix with `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_SITE_URL` | recommended | Auth email redirects, API examples |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | optional | Enables AI features (one is enough) |
| `AI_PROVIDER`, `ANTHROPIC_MODEL`, `OPENAI_MODEL` | optional | Overrides |
| `GOOGLE_PLACES_API_KEY` | optional | Find Leads (Places API (New), Text Search) |
| `GOOGLE_PAGESPEED_API_KEY` | optional | Lighthouse performance in audits |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | optional | Send emails from the app |
| `CRON_SECRET` | for cron | Protects `/api/cron/deliver-events` |
| `SEED_EMAIL`, `SEED_PASSWORD` | seed only | Demo account |

## Supabase setup & migrations

**Hosted project (recommended):**

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push            # applies supabase/migrations/*
```

Then in the Supabase dashboard:
- **Authentication → URL configuration**: Site URL = your deployment URL; add `https://<your-domain>/auth/callback` to Redirect URLs.
- **Authentication → Email**: keep email confirmation on in production (users land on `/auth/callback` → `/onboarding`).
- Storage: the `documents` bucket and its policies are created by the migrations.

**Local:** `npx supabase start` (uses `supabase/config.toml`), then `npx supabase db reset` to apply migrations. Copy the printed API URL and keys into `.env.local`.

Migrations (`supabase/migrations`): `…100_core_schema` (tables, indexes, triggers), `…200_security` (RLS, grants, helpers, `create_workspace`, rate limits), `…300_views_and_functions` (read models, analytics, search), `…400_storage` (private documents bucket).

## Seed / demo data

Two ways, both through the real pipeline (normalize → dedupe → score) so demo data behaves like real data:

- **In the app:** tick *Load demo data* when creating the workspace, or Settings → Data → *Load demo data* / *Remove demo data*.
- **CLI:** `npm run seed` (needs `SUPABASE_SERVICE_ROLE_KEY`) — creates the demo user and workspace.

The demo set: 34 fictitious businesses in 12 sectors and 10 Andalusian cities (reserved `.example` domains, fictional phone numbers — no real companies or people), synthetic audits, deals in every stage, 3 campaigns, proposals, tasks and a backdated activity history for analytics.

## Testing

| Suite | Count | What it proves |
|---|---|---|
| `npm test` | 43 | Normalizer, validator, dedupe, CSV mapping, scoring, audit analyzer (HTML fixtures), pricing, templates, generators, lead filters (incl. PostgREST-injection sanitizing), SSRF fetcher (private ranges, redirects, size/time limits), webhook signatures, sector matching, settings parsing, AI provider selection, Next.js conventions |
| `npm run db:test` | 19 | Migrations apply; profile trigger; workspace provisioning; tenant isolation; cross-workspace FK protection; anon lockout; admin-only config; secrets hidden; private saved filters; append-only history; stage → status/probability/won_at/funnel; audit → company cache; dashboard & analytics numbers; search escaping; rate limiting |
| `tests/e2e/smoke.mjs` | 41 checks | Against a running app + Supabase Auth/REST: auth redirect & login, every page, create lead + duplicate detection, outreach → pipeline + follow-up task, tasks, proposals, deal stage changes, kanban keyboard drag, saved filters, CSV import with dedupe, ⌘K search, dark mode, mobile, signup → onboarding, tenant isolation (404), public API (auth, create, invalid, duplicate) |

Run the E2E suite: `BASE_URL=http://localhost:3000 E2E_EMAIL=demo@wire.local E2E_PASSWORD=… node tests/e2e/smoke.mjs` (optional `CHROMIUM_PATH`, `SCREENSHOTS_DIR`).

## Deployment (Vercel)

1. Import the repository in Vercel and set **Root Directory = `wire-sales-os`** (this app lives in a subfolder; the repository root is a different project).
2. Add the environment variables above (Production + Preview).
3. Deploy. `vercel.json` registers a daily cron for `/api/cron/deliver-events` (Hobby plans only allow daily crons; on Pro you can change the schedule to e.g. `*/15 * * * *`). Webhooks are delivered immediately after each action anyway — the cron only retries failures.
4. Update the Supabase Site URL / Redirect URLs to the production domain.

## Automation: events, webhooks & public API

Events (transactional outbox in `events`): `lead.created`, `lead.scored`, `lead.qualified`, `audit.completed`, `email.generated`, `email.sent`, `reply.received`, `deal.created`, `deal.won`, `deal.lost`, `task.created`.

Settings → Automation: set an `https://` endpoint (n8n, Make, Zapier), choose events, generate a signing secret. Payload:

```json
{ "id": "…", "type": "deal.won", "created_at": "…", "workspace_id": "…", "entity": { "type": "deal", "id": "…" }, "data": { "company_id": "…", "value": 4900 } }
```

Verify `X-Wire-Signature: t=<unix>,v1=<hex>` as `HMAC_SHA256(secret, "<t>.<raw body>")` and reject timestamps older than 5 minutes (`lib/events/sign.ts` has a reference `verifySignature`).

**Public Lead API** — create a key in Settings → Automation & API:

```bash
curl -X POST https://<app>/api/v1/leads \
  -H "Authorization: Bearer wire_…" -H "Content-Type: application/json" \
  -d '{"source":"scraper","leads":[{"company_name":"Clínica Ejemplo","website":"example.com","city":"Sevilla","sector":"Clínicas","phone":"954000000","reviews":120,"rating":4.6}]}'
```

Up to 500 leads per request, `dry_run: true` to preview, optional `campaign_id`. Fields: the CSV import fields (`company_name`, `website`, `phone`, `email`, `city`, `province`, `sector`, `rating`, `reviews`, `instagram`, `google_maps_url`, `contact_name`, …). Response includes per-row status (`created` / `duplicate` with reason / `invalid` with errors).

## Integrations

| Integration | Status | Notes |
|---|---|---|
| Anthropic / OpenAI | Implemented | `AIProvider` adapters |
| Google Places (New) | Implemented | Find Leads; 20 results/page, 60 max per query (Google limit) |
| PageSpeed Insights | Implemented | Optional Lighthouse mobile performance |
| Resend | Implemented | Direct sending; manual "mark as sent" otherwise |
| Webhooks (n8n, Make, Zapier) | Implemented | Signed, retried |
| Public Lead API | Implemented | Apify / scrapers / n8n push leads |
| Gmail, Outlook, WhatsApp Business, Calendly, Stripe, Apify (direct), Firecrawl, Google Search | Planned | Contracts in `lib/integrations/contracts.ts`; status shown as "Planned" in Settings → Integrations |

## Known limitations

- **Email open/delivery tracking** requires provider webhooks (Resend events) — not wired yet; manual sends count as "contacted".
- **Website audits** analyse the home page HTML (plus robots, sitemap and up to 10 internal links). JavaScript-rendered sites (pure SPAs) are analysed as served; add PageSpeed for Lighthouse data.
- **Proposals → PDF** uses the browser's print-to-PDF; content is stored as structured JSON so a server renderer (e.g. React-PDF) can be added without data changes.
- **Team features** (invites, roles UI) are modelled in the database (`workspace_members.role`) but there is no invite UI yet.
- Demo prices and sector playbooks are assumptions to be tuned with real sales data.

## Moving to its own repository

This app was built inside the `universal-converter` repository (in `wire-sales-os/`) to avoid touching the existing site. To give it its own repo with full history:

```bash
git subtree split --prefix=wire-sales-os -b wire-sales-os-only
git push git@github.com:<you>/wire-sales-os.git wire-sales-os-only:main
```
