"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Copy, ExternalLink, Loader2, Mail, MessageCircle, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { aiGenerateEmails, aiGenerateWhatsApp } from "@/lib/actions/ai";
import { recordOutreachAction } from "@/lib/actions/company";
import { EMAIL_VARIANT_LABELS, type EmailVariant } from "@/lib/domain/constants";
import { cn } from "@/lib/utils";

type Email = { variant: string; subject: string; body: string };
type WhatsApp = { variant: string; body: string };
export type RenderedTemplate = { id: string; name: string; channel: string; subject: string | null; body: string; missing: string[] };

export type OutreachProps = {
  companyId: string;
  emails: Email[];
  whatsapp: WhatsApp[];
  callScript: string;
  objections: { objection: string; response: string }[];
  templates: RenderedTemplate[];
  recipientEmail: string | null;
  whatsappNumber: string | null;
  aiConfigured: boolean;
  resendConfigured: boolean;
};

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  return {
    copied,
    copy: async (key: string, text: string) => {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    },
  };
}

export function OutreachPanel(props: OutreachProps) {
  const router = useRouter();
  const [emails, setEmails] = useState<Email[]>(props.emails);
  const [emailSource, setEmailSource] = useState<"rules" | "ai" | "template">("rules");
  const [aiGenerationId, setAiGenerationId] = useState<string | null>(null);
  const [variant, setVariant] = useState(0);
  const [subject, setSubject] = useState(props.emails[0]?.subject ?? "");
  const [body, setBody] = useState(props.emails[0]?.body ?? "");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [to, setTo] = useState(props.recipientEmail ?? "");
  const [wa, setWa] = useState<WhatsApp[]>(props.whatsapp);
  const [waIndex, setWaIndex] = useState(0);
  const [waBody, setWaBody] = useState(props.whatsapp[0]?.body ?? "");
  const [pending, startTransition] = useTransition();
  const { copied, copy } = useCopy();

  const pickEmail = (i: number, list = emails) => {
    setVariant(i);
    setSubject(list[i]?.subject ?? "");
    setBody(list[i]?.body ?? "");
    setTemplateId(null);
  };

  const log = (kind: "email_sent" | "whatsapp_sent", sendViaProvider = false) =>
    startTransition(async () => {
      const r = await recordOutreachAction({
        companyId: props.companyId,
        kind,
        subject: kind === "email_sent" ? subject : null,
        body: kind === "email_sent" ? body : waBody,
        to: kind === "email_sent" ? to || null : props.whatsappNumber,
        variant: kind === "email_sent" ? (templateId ? "template" : emails[variant]?.variant ?? null) : wa[waIndex]?.variant ?? null,
        generatedBy: templateId ? "template" : emailSource === "ai" ? "ai" : "rules",
        templateId,
        aiGenerationId: emailSource === "ai" ? aiGenerationId : null,
        sendViaProvider,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(r.data.sent ? "Email sent · follow-up task created for 3 days" : "Logged as sent · pipeline updated, follow-up in 3 days");
      router.refresh();
    });

  const rewriteWithAI = () =>
    startTransition(async () => {
      const r = await aiGenerateEmails(props.companyId);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setEmails(r.data.variants);
      setEmailSource("ai");
      setAiGenerationId(r.data.generationId);
      pickEmail(0, r.data.variants);
      toast.success("AI wrote 4 new versions");
    });

  const waWithAI = () =>
    startTransition(async () => {
      const r = await aiGenerateWhatsApp(props.companyId);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setWa(r.data.messages);
      setWaIndex(0);
      setWaBody(r.data.messages[0]?.body ?? "");
      toast.success("AI wrote new WhatsApp messages");
    });

  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const waLink = props.whatsappNumber ? `https://wa.me/${props.whatsappNumber}?text=${encodeURIComponent(waBody)}` : null;

  return (
    <Tabs defaultValue="email">
      <TabsList>
        <TabsTrigger value="email"><Mail /> Email</TabsTrigger>
        <TabsTrigger value="whatsapp"><MessageCircle /> WhatsApp</TabsTrigger>
        <TabsTrigger value="call">Call script</TabsTrigger>
        <TabsTrigger value="objections">Objections</TabsTrigger>
        <TabsTrigger value="templates">Templates</TabsTrigger>
      </TabsList>

      <TabsContent value="email" className="mt-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Email version">
            {emails.map((e, i) => (
              <button key={`${e.variant}-${i}`} type="button" role="radio" aria-checked={variant === i && !templateId} onClick={() => pickEmail(i)}
                className={cn("h-7 rounded-md border px-2.5 text-xs font-medium transition-colors", variant === i && !templateId ? "border-foreground bg-foreground text-background" : "hover:bg-muted")}>
                {EMAIL_VARIANT_LABELS[e.variant as EmailVariant] ?? e.variant}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{templateId ? "From template" : emailSource === "ai" ? "Written by AI" : "Generated from lead data"}</span>
            <Button size="sm" variant="outline" onClick={rewriteWithAI} disabled={pending || !props.aiConfigured} title={props.aiConfigured ? undefined : "Configure ANTHROPIC_API_KEY or OPENAI_API_KEY"}>
              {pending ? <Loader2 className="animate-spin" /> : <Sparkles />} Rewrite with AI
            </Button>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-[4rem_1fr] sm:items-center">
          <label htmlFor="out-to" className="text-xs text-muted-foreground">To</label>
          <Input id="out-to" value={to} onChange={(e) => setTo(e.target.value)} placeholder="email@business.com" className="h-8" />
          <label htmlFor="out-subject" className="text-xs text-muted-foreground">Subject</label>
          <Input id="out-subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="h-8" />
        </div>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} className="font-[inherit] text-sm leading-relaxed" aria-label="Email body" />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => copy("email", `${subject}\n\n${body}`)}>{copied === "email" ? <Check /> : <Copy />} Copy</Button>
          <Button size="sm" variant="outline" asChild><a href={mailto}><ExternalLink /> Open in mail app</a></Button>
          {props.resendConfigured ? (
            <Button size="sm" onClick={() => log("email_sent", true)} disabled={pending || !to}><Send /> Send now</Button>
          ) : (
            <span className="self-center text-xs text-muted-foreground">Direct sending needs Resend (Settings → Integrations).</span>
          )}
          <Button size="sm" variant="secondary" onClick={() => log("email_sent")} disabled={pending}>Mark as sent</Button>
        </div>
      </TabsContent>

      <TabsContent value="whatsapp" className="mt-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {wa.map((m, i) => (
              <button key={`${m.variant}-${i}`} type="button" onClick={() => { setWaIndex(i); setWaBody(m.body); }}
                className={cn("h-7 rounded-md border px-2.5 text-xs font-medium capitalize", waIndex === i ? "border-foreground bg-foreground text-background" : "hover:bg-muted")}>
                {m.variant.replace(/_/g, " ")}
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={waWithAI} disabled={pending || !props.aiConfigured}><Sparkles /> Rewrite with AI</Button>
        </div>
        <Textarea value={waBody} onChange={(e) => setWaBody(e.target.value)} rows={6} aria-label="WhatsApp message" />
        <p className="text-xs text-muted-foreground">{waBody.length} characters · keep it under ~400 for WhatsApp</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => copy("wa", waBody)}>{copied === "wa" ? <Check /> : <Copy />} Copy</Button>
          {waLink ? (
            <Button size="sm" variant="outline" asChild><a href={waLink} target="_blank" rel="noopener noreferrer"><ExternalLink /> Open WhatsApp</a></Button>
          ) : (
            <span className="self-center text-xs text-muted-foreground">Add a phone number to open WhatsApp directly.</span>
          )}
          <Button size="sm" variant="secondary" onClick={() => log("whatsapp_sent")} disabled={pending}>Mark as sent</Button>
        </div>
      </TabsContent>

      <TabsContent value="call" className="mt-4">
        <pre className="whitespace-pre-wrap rounded-xl border bg-muted/30 p-4 font-sans text-sm leading-relaxed">{props.callScript}</pre>
        <Button size="sm" variant="outline" className="mt-3" onClick={() => copy("call", props.callScript)}>{copied === "call" ? <Check /> : <Copy />} Copy script</Button>
      </TabsContent>

      <TabsContent value="objections" className="mt-4">
        <dl className="divide-y rounded-xl border">
          {props.objections.map((o) => (
            <div key={o.objection} className="p-4">
              <dt className="text-sm font-medium">“{o.objection}”</dt>
              <dd className="mt-1 text-sm text-muted-foreground">{o.response}</dd>
            </div>
          ))}
        </dl>
      </TabsContent>

      <TabsContent value="templates" className="mt-4">
        {props.templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No templates yet — create them in Templates.</p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {props.templates.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t.name} <span className="ml-1 text-xs font-normal text-muted-foreground">{t.channel}</span></p>
                  <p className="truncate text-xs text-muted-foreground">{t.subject ?? t.body.slice(0, 90)}</p>
                  {t.missing.length > 0 && <p className="text-xs text-destructive">Missing data: {t.missing.join(", ")}</p>}
                </div>
                <Button size="sm" variant="outline" onClick={() => {
                  if (t.channel === "whatsapp") { setWaBody(t.body); toast.info("Loaded into the WhatsApp tab"); }
                  else { setSubject(t.subject ?? ""); setBody(t.body); setTemplateId(t.id); toast.info("Loaded into the Email tab"); }
                }}>Use</Button>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>
    </Tabs>
  );
}
