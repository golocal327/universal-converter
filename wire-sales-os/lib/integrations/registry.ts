import "server-only";

/**
 * Integration registry: single source of truth for what is connected.
 * "available" adapters are implemented and work once their env vars are set;
 * "planned" ones have a defined contract (see lib/integrations/contracts.ts)
 * but no implementation yet — the UI says so instead of pretending.
 */
export type IntegrationStatus = "connected" | "requires_configuration" | "planned";

export type IntegrationInfo = {
  id: string;
  name: string;
  category: "ai" | "discovery" | "audit" | "email" | "messaging" | "automation" | "payments" | "scheduling" | "enrichment";
  description: string;
  envVars: string[];
  status: IntegrationStatus;
  docsUrl?: string;
};

const has = (...vars: string[]) => vars.every((v) => Boolean(process.env[v]));

export function listIntegrations(): IntegrationInfo[] {
  const item = (info: Omit<IntegrationInfo, "status">, implemented: boolean): IntegrationInfo => ({
    ...info,
    status: !implemented ? "planned" : has(...info.envVars) ? "connected" : "requires_configuration",
  });
  return [
    item({ id: "anthropic", name: "Anthropic Claude", category: "ai", envVars: ["ANTHROPIC_API_KEY"],
      description: "AI Copilot, personalised emails, proposals and briefings.", docsUrl: "https://docs.anthropic.com" }, true),
    item({ id: "openai", name: "OpenAI", category: "ai", envVars: ["OPENAI_API_KEY"],
      description: "Alternative AI provider behind the same AIProvider interface.", docsUrl: "https://platform.openai.com/docs" }, true),
    item({ id: "google_places", name: "Google Places", category: "discovery", envVars: ["GOOGLE_PLACES_API_KEY"],
      description: "Find Leads: discover businesses by sector and location.",
      docsUrl: "https://developers.google.com/maps/documentation/places/web-service/text-search" }, true),
    item({ id: "pagespeed", name: "PageSpeed Insights", category: "audit", envVars: ["GOOGLE_PAGESPEED_API_KEY"],
      description: "Adds Lighthouse mobile performance to website audits.",
      docsUrl: "https://developers.google.com/speed/docs/insights/v5/get-started" }, true),
    item({ id: "resend", name: "Resend", category: "email", envVars: ["RESEND_API_KEY", "RESEND_FROM_EMAIL"],
      description: "Send outreach emails directly from WIRE Sales OS.", docsUrl: "https://resend.com/docs" }, true),
    item({ id: "webhooks", name: "Webhooks (n8n, Make, Zapier)", category: "automation", envVars: [],
      description: "Signed event delivery (lead.created, deal.won…). Configure the URL in Settings → Automation." }, true),
    item({ id: "public_api", name: "Public Lead API", category: "automation", envVars: ["SUPABASE_SERVICE_ROLE_KEY"],
      description: "POST /api/v1/leads with a workspace API key — push leads from Apify, n8n or scrapers." }, true),
    item({ id: "gmail", name: "Gmail", category: "email", envVars: ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET"],
      description: "Send from and sync replies with a Gmail inbox." }, false),
    item({ id: "outlook", name: "Outlook", category: "email", envVars: ["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET"],
      description: "Send from and sync replies with an Outlook inbox." }, false),
    item({ id: "whatsapp_business", name: "WhatsApp Business", category: "messaging", envVars: ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"],
      description: "Send template messages through the WhatsApp Cloud API. Today: click-to-chat links." }, false),
    item({ id: "calendly", name: "Calendly", category: "scheduling", envVars: ["CALENDLY_TOKEN"],
      description: "Log booked meetings automatically on the timeline." }, false),
    item({ id: "stripe", name: "Stripe", category: "payments", envVars: ["STRIPE_SECRET_KEY"],
      description: "Payment links for proposals and MRR tracking." }, false),
    item({ id: "apify", name: "Apify", category: "discovery", envVars: ["APIFY_TOKEN"],
      description: "Run scrapers directly. Today: push Apify results to the Public Lead API." }, false),
    item({ id: "firecrawl", name: "Firecrawl", category: "enrichment", envVars: ["FIRECRAWL_API_KEY"],
      description: "Deep multi-page crawling for audits and enrichment." }, false),
    item({ id: "google_search", name: "Google Search", category: "discovery", envVars: ["GOOGLE_CSE_KEY", "GOOGLE_CSE_ID"],
      description: "Discover businesses from search results." }, false),
  ];
}
