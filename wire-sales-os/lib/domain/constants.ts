/**
 * Closed vocabularies shared by the UI, validators and engines.
 * Values mirror the Postgres enums / check constraints in supabase/migrations.
 */

export const LEAD_STATUSES = ["new", "qualified", "disqualified", "converted"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  qualified: "Qualified",
  disqualified: "Disqualified",
  converted: "In pipeline",
};

export const LEAD_SOURCES = ["manual", "csv", "api", "google_places", "scraper", "enrichment", "referral", "inbound"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];
export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  manual: "Manual",
  csv: "CSV import",
  api: "API",
  google_places: "Google Places",
  scraper: "Scraper",
  enrichment: "Enrichment",
  referral: "Referral",
  inbound: "Inbound",
};

export const CONTACT_STATUSES = ["not_contacted", "contacted", "replied", "meeting", "unresponsive", "do_not_contact"] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];
export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  not_contacted: "Not contacted",
  contacted: "Contacted",
  replied: "Replied",
  meeting: "Meeting",
  unresponsive: "Unresponsive",
  do_not_contact: "Do not contact",
};

export const PRIORITIES = ["hot", "warm", "cold"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const TASK_TYPES = ["contact", "email", "call", "follow_up", "proposal", "meeting", "demo", "close", "other"] as const;
export type TaskType = (typeof TASK_TYPES)[number];
export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  contact: "Contact",
  email: "Send email",
  call: "Call",
  follow_up: "Follow-up",
  proposal: "Prepare proposal",
  meeting: "Meeting",
  demo: "Demo",
  close: "Close",
  other: "Other",
};

export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_STATUSES = ["todo", "in_progress", "done", "cancelled"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
  cancelled: "Cancelled",
};

export const CAMPAIGN_STATUSES = ["draft", "active", "paused", "completed"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const WEBSITE_REQUIREMENTS = ["any", "missing", "weak", "missing_or_weak"] as const;
export type WebsiteRequirement = (typeof WEBSITE_REQUIREMENTS)[number];
export const WEBSITE_REQUIREMENT_LABELS: Record<WebsiteRequirement, string> = {
  any: "Any",
  missing: "Missing",
  weak: "Weak",
  missing_or_weak: "Missing / weak",
};

export const WEBSITE_STATES = ["missing", "unknown", "weak", "good"] as const;
export type WebsiteState = (typeof WEBSITE_STATES)[number];

export const CHANNELS = ["email", "whatsapp", "call", "linkedin", "sms"] as const;
export type Channel = (typeof CHANNELS)[number];

export const TEMPLATE_CATEGORIES = ["cold_outreach", "follow_up", "proposal", "meeting", "reactivation", "other"] as const;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];
export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
  cold_outreach: "Cold outreach",
  follow_up: "Follow-up",
  proposal: "Proposal",
  meeting: "Meeting",
  reactivation: "Reactivation",
  other: "Other",
};

export const EMAIL_VARIANTS = ["direct", "professional", "high_ticket", "follow_up"] as const;
export type EmailVariant = (typeof EMAIL_VARIANTS)[number];
export const EMAIL_VARIANT_LABELS: Record<EmailVariant, string> = {
  direct: "Direct",
  professional: "Professional",
  high_ticket: "High-ticket",
  follow_up: "Follow-up",
};

export const SERVICE_CATEGORIES = [
  "website",
  "maintenance",
  "seo",
  "automation",
  "booking",
  "chatbot",
  "ai",
  "integration",
  "nfc",
  "whatsapp",
  "other",
] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export const VALUE_TIERS = ["high", "medium", "low"] as const;
export type ValueTier = (typeof VALUE_TIERS)[number];

/** Activity types written to the timeline. Free-form in the DB, closed here. */
export const ACTIVITY_TYPES = [
  "lead_created",
  "lead_scored",
  "lead_qualified",
  "lead_disqualified",
  "website_audited",
  "email_generated",
  "email_sent",
  "email_opened",
  "whatsapp_generated",
  "whatsapp_sent",
  "reply_received",
  "call_logged",
  "call_scheduled",
  "meeting_scheduled",
  "meeting_completed",
  "proposal_created",
  "proposal_sent",
  "deal_created",
  "deal_stage_changed",
  "deal_won",
  "deal_lost",
  "note_added",
  "task_created",
  "task_completed",
  "campaign_added",
  "ai_analysis",
  "document_uploaded",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  lead_created: "Lead created",
  lead_scored: "Lead scored",
  lead_qualified: "Lead qualified",
  lead_disqualified: "Lead disqualified",
  website_audited: "Website audited",
  email_generated: "Email generated",
  email_sent: "Email sent",
  email_opened: "Email opened",
  whatsapp_generated: "WhatsApp generated",
  whatsapp_sent: "WhatsApp sent",
  reply_received: "Reply received",
  call_logged: "Call logged",
  call_scheduled: "Call scheduled",
  meeting_scheduled: "Meeting scheduled",
  meeting_completed: "Meeting completed",
  proposal_created: "Proposal created",
  proposal_sent: "Proposal sent",
  deal_created: "Deal created",
  deal_stage_changed: "Stage changed",
  deal_won: "Deal won",
  deal_lost: "Deal lost",
  note_added: "Note",
  task_created: "Task created",
  task_completed: "Task completed",
  campaign_added: "Added to campaign",
  ai_analysis: "AI analysis",
  document_uploaded: "Document uploaded",
};

/** Default pipeline keys, in order (mirrors create_workspace()). */
export const STAGE_KEYS = ["new", "qualified", "contacted", "replied", "meeting", "proposal", "negotiation", "won", "lost"] as const;
export type StageKey = (typeof STAGE_KEYS)[number];
