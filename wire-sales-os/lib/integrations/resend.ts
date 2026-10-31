import "server-only";

/**
 * Resend adapter for sending outreach emails (optional).
 * Docs: https://resend.com/docs/api-reference/emails/send-email
 */
const ENDPOINT = "https://api.resend.com/emails";

export function isResendConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

export async function sendEmailViaResend(input: {
  to: string;
  subject: string;
  text: string;
  replyTo?: string | null;
  idempotencyKey?: string;
  tags?: { name: string; value: string }[];
}): Promise<{ id: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!key || !from) throw new Error("Resend is not configured (RESEND_API_KEY, RESEND_FROM_EMAIL)");
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      ...(input.tags?.length ? { tags: input.tags } : {}),
    }),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Resend error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as { id: string };
}
