import "server-only";
import type { EmailVariant } from "@/lib/domain/constants";
import { isResendConfigured, sendEmailViaResend } from "@/lib/integrations/resend";
import { logActivity } from "./activity";
import { emitEvent } from "./events";
import { advanceDealTo } from "./pipeline";
import { loadSettings } from "./settings";
import type { Actor } from "./types";

export type OutreachKind = "email_sent" | "whatsapp_sent" | "call_logged" | "reply_received" | "meeting_scheduled" | "meeting_completed";

export type OutreachInput = {
  companyId: string;
  kind: OutreachKind;
  subject?: string | null;
  body?: string | null;
  to?: string | null;
  variant?: EmailVariant | string | null;
  generatedBy?: "rules" | "ai" | "template" | "manual";
  templateId?: string | null;
  campaignId?: string | null;
  aiGenerationId?: string | null;
  /** Email only: actually send through Resend (otherwise the user sent it from their own client). */
  sendViaProvider?: boolean;
  followUpInDays?: number | null;
  occurredAt?: string;
};

const DAY = 86_400_000;

/**
 * Record an outreach touchpoint and apply all CRM side effects:
 * message log, timeline, lead contact status, deal auto-advance,
 * campaign metrics, follow-up task and automation events.
 */
export async function recordOutreach(actor: Actor, input: OutreachInput) {
  const { data: lead } = await actor.db
    .from("leads")
    .select("id, primary_contact_id, contact_status, company:companies(name)")
    .eq("workspace_id", actor.workspaceId)
    .eq("company_id", input.companyId)
    .maybeSingle();
  const companyName = (lead?.company as unknown as { name: string } | null)?.name ?? "company";
  const now = input.occurredAt ?? new Date().toISOString();
  const outbound = input.kind === "email_sent" || input.kind === "whatsapp_sent" || input.kind === "call_logged";

  let providerMessageId: string | null = null;
  if (input.kind === "email_sent" && input.sendViaProvider) {
    if (!isResendConfigured()) throw new Error("Email sending is not configured (RESEND_API_KEY / RESEND_FROM_EMAIL)");
    if (!input.to) throw new Error("Recipient email is required");
    const settings = await loadSettings(actor.db, actor.workspaceId);
    const sent = await sendEmailViaResend({
      to: input.to,
      subject: input.subject ?? companyName,
      text: input.body ?? "",
      replyTo: settings.branding.senderEmail || null,
      idempotencyKey: `${input.companyId}:${(input.subject ?? "").slice(0, 60)}:${now.slice(0, 16)}`,
      tags: [{ name: "workspace", value: actor.workspaceId.replace(/[^a-zA-Z0-9_-]/g, "") }],
    });
    providerMessageId = sent.id;
  }

  const channel = input.kind === "whatsapp_sent" ? "whatsapp" : input.kind === "call_logged" ? "call" : "email";
  if (input.kind === "email_sent" || input.kind === "whatsapp_sent" || input.kind === "reply_received") {
    await actor.db.from("messages").insert({
      workspace_id: actor.workspaceId,
      company_id: input.companyId,
      lead_id: lead?.id ?? null,
      contact_id: lead?.primary_contact_id ?? null,
      campaign_id: input.campaignId ?? null,
      template_id: input.templateId ?? null,
      ai_generation_id: input.aiGenerationId ?? null,
      channel,
      direction: input.kind === "reply_received" ? "inbound" : "outbound",
      status: input.kind === "reply_received" ? "replied" : "sent",
      variant: input.variant ?? null,
      subject: input.subject ?? null,
      body: input.body ?? "",
      to_address: input.to ?? null,
      provider: providerMessageId ? "resend" : null,
      provider_message_id: providerMessageId,
      generated_by: input.generatedBy ?? "manual",
      sent_at: input.kind === "reply_received" ? null : now,
      replied_at: input.kind === "reply_received" ? now : null,
      created_by: actor.userId,
    });
  }

  const titles: Record<OutreachKind, string> = {
    email_sent: providerMessageId ? `Email sent: ${input.subject ?? ""}` : `Email sent (logged): ${input.subject ?? ""}`,
    whatsapp_sent: "WhatsApp sent",
    call_logged: "Call logged",
    reply_received: "Reply received",
    meeting_scheduled: "Meeting scheduled",
    meeting_completed: "Meeting completed",
  };
  await logActivity(actor, {
    type: input.kind,
    title: titles[input.kind].trim(),
    body: input.body?.slice(0, 2000) ?? null,
    companyId: input.companyId,
    leadId: lead?.id ?? null,
    occurredAt: now,
    metadata: { variant: input.variant ?? null, generated_by: input.generatedBy ?? "manual", provider_message_id: providerMessageId },
  });

  if (!lead) return { providerMessageId };

  // Lead status + deal auto-advance
  const statusRank = ["not_contacted", "unresponsive", "contacted", "replied", "meeting"];
  const nextStatus = input.kind === "reply_received" ? "replied" : input.kind.startsWith("meeting") ? "meeting" : "contacted";
  const keep = statusRank.indexOf(lead.contact_status) >= statusRank.indexOf(nextStatus) || lead.contact_status === "do_not_contact";
  const followUpDays = input.followUpInDays === undefined ? (outbound ? 3 : null) : input.followUpInDays;
  await actor.db
    .from("leads")
    .update({
      ...(keep ? {} : { contact_status: nextStatus }),
      ...(outbound ? { last_contacted_at: now } : {}),
      ...(followUpDays ? { next_follow_up_at: new Date(Date.parse(now) + followUpDays * DAY).toISOString() } : {}),
      ...(input.kind === "reply_received" ? { next_follow_up_at: null } : {}),
    })
    .eq("id", lead.id);
  await actor.db.from("deals").update({ last_contact_at: now }).eq("lead_id", lead.id).eq("status", "open");
  await advanceDealTo(actor, lead.id, input.kind === "reply_received" ? "replied" : input.kind.startsWith("meeting") ? "meeting" : "contacted");

  // Campaign metrics
  const column = input.kind === "reply_received" ? "replied_at" : input.kind.startsWith("meeting") ? "meeting_at" : "contacted_at";
  const campaignUpdate =
    column === "contacted_at"
      ? { contacted_at: now, ...(providerMessageId ? { delivered_at: now } : {}) }
      : column === "replied_at"
        ? { replied_at: now }
        : { meeting_at: now };
  let q = actor.db.from("campaign_leads").update(campaignUpdate).eq("lead_id", lead.id).is(column, null);
  if (input.campaignId) q = q.eq("campaign_id", input.campaignId);
  await q;

  // Follow-up task (only one open follow-up per lead)
  if (outbound && followUpDays) {
    const { count } = await actor.db.from("tasks").select("id", { count: "exact", head: true }).eq("lead_id", lead.id).eq("type", "follow_up").in("status", ["todo", "in_progress"]);
    if (!count) {
      await actor.db.from("tasks").insert({
        workspace_id: actor.workspaceId,
        title: `Follow up with ${companyName}`,
        type: "follow_up",
        priority: "high",
        due_at: new Date(Date.parse(now) + followUpDays * DAY).toISOString(),
        company_id: input.companyId,
        lead_id: lead.id,
        assignee_id: actor.userId,
        created_by: actor.userId,
      });
    }
  }
  if (input.kind === "reply_received") {
    await actor.db.from("tasks").update({ status: "done", completed_at: now }).eq("lead_id", lead.id).eq("type", "follow_up").in("status", ["todo", "in_progress"]);
  }

  if (input.kind === "email_sent") await emitEvent(actor, "email.sent", { type: "lead", id: lead.id }, { company_id: input.companyId, subject: input.subject ?? null, via: providerMessageId ? "resend" : "manual" });
  if (input.kind === "reply_received") await emitEvent(actor, "reply.received", { type: "lead", id: lead.id }, { company_id: input.companyId });
  return { providerMessageId };
}
