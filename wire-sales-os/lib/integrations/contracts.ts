import type { RawLead } from "@/lib/lead-pipeline/validate";

/**
 * Adapter contracts for integrations. Implementations live next to this file
 * (google-places.ts, resend.ts…); planned ones (Gmail, Outlook, WhatsApp
 * Business, Calendly, Stripe, Apify, Firecrawl) implement these interfaces.
 */

/** Lead Source → produces raw leads that go through Normalizer → Validator → Deduplicator → Scoring → CRM. */
export interface LeadSourceAdapter {
  id: string;
  isConfigured(): boolean;
  search(query: { sector: string; location: string; limit?: number }): Promise<RawLead[]>;
}

/** Outbound email provider (Resend today; Gmail/Outlook later). */
export interface EmailProviderAdapter {
  id: string;
  isConfigured(): boolean;
  send(message: { to: string; subject: string; text: string; replyTo?: string | null }): Promise<{ providerMessageId: string }>;
}

/** Messaging provider (WhatsApp Business Cloud API). */
export interface MessagingProviderAdapter {
  id: string;
  isConfigured(): boolean;
  send(message: { to: string; text: string }): Promise<{ providerMessageId: string }>;
}

/** Enrichment provider (Firecrawl, Apify actors, Clearbit-like APIs). */
export interface EnrichmentAdapter {
  id: string;
  isConfigured(): boolean;
  enrich(company: { name: string; website?: string | null; city?: string | null }): Promise<Partial<RawLead>>;
}
