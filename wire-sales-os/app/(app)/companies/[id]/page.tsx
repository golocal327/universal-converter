import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AtSign, ExternalLink, Globe, Link2, Mail, MapPin, Phone, Star, Users } from "lucide-react";
import { PriorityBadge, ScoreBadge, StageBadge } from "@/components/app/badges";
import { Section } from "@/components/app/page-header";
import { AiAnalysisCard } from "@/components/company/ai-analysis-card";
import { AuditPanel, type AuditView } from "@/components/company/audit-panel";
import { CompanyActions } from "@/components/company/company-actions";
import { ContactsCard } from "@/components/company/contacts-card";
import { DealsCard, type DealRow } from "@/components/company/deals-card";
import { DocumentsCard } from "@/components/company/documents-card";
import { LeadNotes } from "@/components/company/lead-notes";
import { LogInteraction } from "@/components/company/log-interaction";
import { OpportunityPanel } from "@/components/company/opportunity-panel";
import { OutreachPanel } from "@/components/company/outreach-panel";
import { ScoreBreakdown } from "@/components/company/score-breakdown";
import { Timeline } from "@/components/company/timeline";
import { TaskList, type TaskRow } from "@/components/tasks/task-list";
import { isAIConfigured } from "@/lib/ai";
import type { LeadAnalysis } from "@/lib/ai/prompts";
import type { AuditCheck, AuditOpportunity } from "@/lib/audit/analyzer";
import { getActor } from "@/lib/auth/actor";
import { getWorkspaceContext } from "@/lib/auth/session";
import { CONTACT_STATUS_LABELS, LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS, type ContactStatus, type LeadSource, type LeadStatus } from "@/lib/domain/constants";
import { formatDate, formatNumber, formatRelative } from "@/lib/format";
import { isResendConfigured } from "@/lib/integrations/resend";
import { analyzeOpportunity, generateCallScript, generateEmails, generateObjections, generateWhatsApp } from "@/lib/outreach/generators";
import { buildLeadContext } from "@/lib/services/lead-context";
import { buildTemplateValues, renderTemplate } from "@/lib/templates/render";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "audit", label: "Website audit" },
  { key: "outreach", label: "Outreach" },
  { key: "timeline", label: "Timeline" },
  { key: "tasks", label: "Tasks" },
  { key: "deals", label: "Deals" },
  { key: "documents", label: "Documents" },
  { key: "ai", label: "AI analysis" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export async function generateMetadata({ params }: PageProps<"/companies/[id]">): Promise<Metadata> {
  const { id } = await params;
  const { supabase } = await getWorkspaceContext();
  const { data } = await supabase.from("companies").select("name").eq("id", id).maybeSingle();
  return { title: data?.name ?? "Company" };
}

export default async function CompanyPage({ params, searchParams }: PageProps<"/companies/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sp = await searchParams;
  const tab: Tab = (TABS.find((t) => t.key === sp.tab)?.key ?? "overview") as Tab;
  const { supabase, workspace, isAdmin } = await getWorkspaceContext();
  const actor = await getActor();

  const { data: company } = await supabase.from("companies").select("*, sector:sectors(id, name)").eq("workspace_id", workspace.id).eq("id", id).maybeSingle();
  if (!company) notFound();

  const [ctx, { data: lead }, { data: contacts }, { data: audit }, { data: deals }, { data: tasks }, { data: activities }, { data: proposals }, { data: documents }, { data: lastAI }, { data: stages }, { data: templates }, { data: sectors }] =
    await Promise.all([
      buildLeadContext(actor, id),
      supabase.from("leads").select("id, status, source, score, priority, contact_status, last_contacted_at, next_follow_up_at, notes, created_at").eq("company_id", id).maybeSingle(),
      supabase.from("contacts").select("id, full_name, role, email, phone, whatsapp, linkedin_url, is_primary").eq("company_id", id).order("is_primary", { ascending: false }).order("created_at"),
      supabase.from("website_audits").select("*").eq("company_id", id).neq("status", "pending").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("deal_overview").select("id, title, stage_id, stage_key, stage_name, status, setup_value, monthly_value, value, probability, weighted_value, expected_close_date, next_action, service_name").eq("company_id", id).order("created_at", { ascending: false }),
      supabase.from("tasks").select("id, title, description, type, priority, status, due_at, company_id").eq("company_id", id).order("status").order("due_at", { nullsFirst: false }),
      supabase.from("activities").select("id, type, title, body, occurred_at").eq("company_id", id).order("occurred_at", { ascending: false }).limit(100),
      supabase.from("proposals").select("id, title, status, setup_total, monthly_total, generated_by, created_at").eq("company_id", id).order("created_at", { ascending: false }),
      supabase.from("documents").select("id, name, size_bytes, created_at").eq("company_id", id).order("created_at", { ascending: false }),
      supabase.from("ai_generations").select("response, created_at, model").eq("company_id", id).eq("kind", "lead_analysis").eq("status", "success").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("pipeline_stages").select("id, key, name").eq("workspace_id", workspace.id).order("position"),
      supabase.from("email_templates").select("id, name, channel, subject, body, sector_id").eq("workspace_id", workspace.id).eq("is_archived", false).order("category"),
      supabase.from("sectors").select("id, name").eq("workspace_id", workspace.id).order("name"),
    ]);
  if (!ctx) notFound();

  const analysis = analyzeOpportunity(ctx);
  const openDeal = (deals ?? []).find((d) => d.status === "open") ?? deals?.[0] ?? null;
  const sector = company.sector as unknown as { id: string; name: string } | null;
  const values = buildTemplateValues(ctx);
  const aiConfigured = isAIConfigured();
  const whatsappNumber = (ctx.contact?.phone ?? company.phone_normalized ?? company.phone)?.replace(/[^\d]/g, "") || null;
  let lastAnalysis: { analysis: LeadAnalysis; created_at: string; model: string } | null = null;
  try {
    if (lastAI?.response) lastAnalysis = { analysis: JSON.parse(lastAI.response) as LeadAnalysis, created_at: lastAI.created_at, model: lastAI.model };
  } catch {
    lastAnalysis = null;
  }
  const taskRows: TaskRow[] = (tasks ?? []).map((t) => ({ ...t, company_name: company.name }));

  const info = (icon: React.ReactNode, content: React.ReactNode) => content ? <li className="flex items-start gap-2.5 text-sm"><span className="mt-0.5 text-muted-foreground">{icon}</span><span className="min-w-0 break-words">{content}</span></li> : null;

  return (
    <>
      <div className="border-b px-4 pt-5 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">
              <Link href="/leads" className="hover:text-foreground">Leads</Link> / {sector?.name ?? company.subsector ?? "Company"}
            </p>
            <h1 className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
              {company.name}
              {company.is_customer && <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success">Customer</span>}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {[company.city, company.province].filter(Boolean).join(", ") || "No location"}
              {company.google_reviews_count !== null && <> · <Star className="mb-0.5 inline size-3 fill-current text-warm" /> {company.google_rating ?? "—"} ({formatNumber(company.google_reviews_count)} reviews)</>}
            </p>
          </div>
          <div className="flex items-center gap-5">
            {lead && (
              <div className="text-right">
                <ScoreBadge score={lead.score} size="lg" />
                <div className="mt-1 flex items-center justify-end gap-1.5"><PriorityBadge priority={lead.priority} />{openDeal && <StageBadge stageKey={openDeal.stage_key} name={openDeal.stage_name} />}</div>
              </div>
            )}
          </div>
        </div>
        <div className="mt-4">
          <CompanyActions
            company={{ ...company, google_rating: company.google_rating === null ? null : Number(company.google_rating) }}
            leadId={lead?.id ?? null}
            hasOpenDeal={Boolean((deals ?? []).some((d) => d.status === "open"))}
            aiConfigured={aiConfigured}
            isAdmin={isAdmin}
            sectors={sectors ?? []}
          />
        </div>
        <nav aria-label="Company sections" className="-mb-px mt-5 flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <Link key={t.key} href={`/companies/${id}?tab=${t.key}`} scroll={false} aria-current={tab === t.key ? "page" : undefined}
              className={cn("whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors", tab === t.key ? "border-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}>
              {t.label}
              {t.key === "tasks" && taskRows.filter((x) => x.status !== "done").length > 0 && <span className="tabular ml-1.5 text-xs text-muted-foreground">{taskRows.filter((x) => x.status !== "done").length}</span>}
            </Link>
          ))}
        </nav>
      </div>

      <div className="px-4 py-6 sm:px-6 lg:px-8">
        {tab === "overview" && (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="space-y-6">
              <div>
                <h2 className="mb-3 text-sm font-semibold">Why this lead?</h2>
                <OpportunityPanel analysis={analysis} />
              </div>
              {analysis.problems.length > 0 && (
                <Section title="Detected problems">
                  <ul className="divide-y">
                    {analysis.problems.map((p) => (
                      <li key={p.key} className="px-4 py-3">
                        <p className="text-sm font-medium">{p.title}</p>
                        <p className="text-sm text-muted-foreground">{p.impact}</p>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
              <Section title="Recent activity" actions={<Link href={`/companies/${id}?tab=timeline`} className="text-xs text-muted-foreground hover:text-foreground">View all</Link>}>
                <div className="space-y-4 p-4">
                  <LogInteraction companyId={id} />
                  <Timeline items={(activities ?? []).slice(0, 6)} />
                </div>
              </Section>
            </div>
            <aside className="space-y-6">
              <Section title={`Lead score ${lead?.score ?? "—"}/100`} description="Every point is explained; categories are capped">
                <div className="p-4"><ScoreBreakdown factors={ctx.lead?.factors ?? []} score={lead?.score} /></div>
              </Section>
              <Section title="Contact & presence">
                <ul className="space-y-2.5 p-4">
                  {info(<Phone className="size-4" />, company.phone && <a href={`tel:${company.phone}`} className="hover:underline">{company.phone}</a>)}
                  {info(<Mail className="size-4" />, company.email && <a href={`mailto:${company.email}`} className="hover:underline">{company.email}</a>)}
                  {info(<Globe className="size-4" />, company.website ? <a href={company.website} target="_blank" rel="noopener noreferrer nofollow" className="hover:underline">{company.domain ?? company.website}</a> : <span className="font-medium text-hot">No website</span>)}
                  {info(<AtSign className="size-4" />, company.instagram_url && <a href={company.instagram_url} target="_blank" rel="noopener noreferrer nofollow" className="hover:underline">Instagram{company.instagram_followers ? ` · ${formatNumber(company.instagram_followers)} followers` : ""}{company.instagram_last_post_at ? ` · last post ${formatRelative(company.instagram_last_post_at)}` : ""}</a>)}
                  {info(<Link2 className="size-4" />, company.linkedin_url && <a href={company.linkedin_url} target="_blank" rel="noopener noreferrer nofollow" className="hover:underline">LinkedIn</a>)}
                  {info(<MapPin className="size-4" />, company.address ?? null)}
                  {info(<ExternalLink className="size-4" />, company.google_maps_url && <a href={company.google_maps_url} target="_blank" rel="noopener noreferrer nofollow" className="hover:underline">Google Maps</a>)}
                  {info(<Users className="size-4" />, company.employees_estimate ? `~${company.employees_estimate} employees` : null)}
                </ul>
                {company.description && <p className="border-t px-4 py-3 text-sm text-muted-foreground">{company.description}</p>}
              </Section>
              <Section title="Contacts"><div className="px-4 py-2"><ContactsCard companyId={id} contacts={contacts ?? []} /></div></Section>
              {lead && (
                <Section title="Lead">
                  <dl className="grid grid-cols-2 gap-3 p-4 text-sm">
                    <div><dt className="text-xs text-muted-foreground">Status</dt><dd>{LEAD_STATUS_LABELS[lead.status as LeadStatus]}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Contact</dt><dd>{CONTACT_STATUS_LABELS[lead.contact_status as ContactStatus]}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Source</dt><dd>{LEAD_SOURCE_LABELS[lead.source as LeadSource]}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Created</dt><dd>{formatDate(lead.created_at)}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Last contact</dt><dd>{lead.last_contacted_at ? formatRelative(lead.last_contacted_at) : "—"}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Next follow-up</dt><dd>{lead.next_follow_up_at ? formatRelative(lead.next_follow_up_at) : "—"}</dd></div>
                  </dl>
                  <div className="border-t p-4"><p className="mb-2 text-xs font-medium text-muted-foreground">Notes</p><LeadNotes leadId={lead.id} initial={lead.notes} /></div>
                </Section>
              )}
            </aside>
          </div>
        )}

        {tab === "audit" && (
          audit ? (
            <AuditPanel audit={{ ...(audit as unknown as AuditView), checks: (audit.checks ?? []) as unknown as AuditCheck[], opportunities: (audit.opportunities ?? []) as unknown as AuditOpportunity[], tech: (audit.tech ?? {}) as AuditView["tech"] }} />
          ) : (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              {company.website ? "This website has not been audited yet. Use “Audit website” above — it takes ~10 seconds." : "This company has no website. That is the opportunity: pitch a new premium website."}
            </div>
          )
        )}

        {tab === "outreach" && (
          <div className="max-w-4xl">
            <OutreachPanel
              companyId={id}
              emails={generateEmails(ctx)}
              whatsapp={generateWhatsApp(ctx)}
              callScript={generateCallScript(ctx)}
              objections={generateObjections(ctx)}
              templates={(templates ?? []).filter((t) => !t.sector_id || t.sector_id === sector?.id).map((t) => {
                const s = t.subject ? renderTemplate(t.subject, values) : null;
                const b = renderTemplate(t.body, values);
                return { id: t.id, name: t.name, channel: t.channel, subject: s?.output ?? null, body: b.output, missing: [...new Set([...(s?.missing ?? []), ...b.missing])] };
              })}
              recipientEmail={ctx.contact?.email ?? company.email}
              whatsappNumber={whatsappNumber}
              aiConfigured={aiConfigured}
              resendConfigured={isResendConfigured()}
            />
          </div>
        )}

        {tab === "timeline" && (
          <div className="max-w-3xl space-y-6">
            <LogInteraction companyId={id} />
            <Timeline items={activities ?? []} />
          </div>
        )}

        {tab === "tasks" && <div className="max-w-3xl"><TaskList tasks={taskRows} showCompany={false} newTaskDefaults={{ company_id: id, company_name: company.name }} emptyLabel="No tasks for this company." /></div>}

        {tab === "deals" && <div className="max-w-3xl"><DealsCard companyId={id} deals={(deals ?? []) as DealRow[]} stages={stages ?? []} /></div>}

        {tab === "documents" && <DocumentsCard workspaceId={workspace.id} companyId={id} proposals={proposals ?? []} documents={documents ?? []} />}

        {tab === "ai" && <AiAnalysisCard companyId={id} aiConfigured={aiConfigured} last={lastAnalysis} />}
      </div>
    </>
  );
}
