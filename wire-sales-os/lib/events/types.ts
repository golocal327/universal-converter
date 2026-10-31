/** Automation events (outbox). Payloads are delivered to the workspace webhook (n8n, Make, Zapier). */
export const EVENT_TYPES = [
  "lead.created",
  "lead.scored",
  "lead.qualified",
  "audit.completed",
  "email.generated",
  "email.sent",
  "reply.received",
  "deal.created",
  "deal.won",
  "deal.lost",
  "task.created",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];
