import {
  Bot, Briefcase, CalendarCheck, CalendarPlus, CheckCircle2, Crosshair, FileText, Gauge, Mail, MailOpen, Megaphone, MessageCircle, MessageSquareReply,
  Phone, StickyNote, Trophy, Upload, XCircle, type LucideIcon,
} from "lucide-react";
import { ACTIVITY_LABELS, type ActivityType } from "@/lib/domain/constants";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

const ICONS: Partial<Record<ActivityType, LucideIcon>> = {
  lead_created: Crosshair, lead_scored: Gauge, lead_qualified: CheckCircle2, lead_disqualified: XCircle, website_audited: Gauge,
  email_generated: Mail, email_sent: Mail, email_opened: MailOpen, whatsapp_generated: MessageCircle, whatsapp_sent: MessageCircle,
  reply_received: MessageSquareReply, call_logged: Phone, call_scheduled: Phone, meeting_scheduled: CalendarPlus, meeting_completed: CalendarCheck,
  proposal_created: FileText, proposal_sent: FileText, deal_created: Briefcase, deal_stage_changed: Briefcase, deal_won: Trophy, deal_lost: XCircle,
  note_added: StickyNote, task_created: CheckCircle2, task_completed: CheckCircle2, campaign_added: Megaphone, ai_analysis: Bot, document_uploaded: Upload,
};

export type TimelineItem = { id: string; type: string; title: string; body: string | null; occurred_at: string };

export function Timeline({ items }: { items: TimelineItem[] }) {
  if (!items.length) return <p className="py-6 text-sm text-muted-foreground">No activity yet.</p>;
  return (
    <ol className="relative space-y-5 before:absolute before:top-2 before:bottom-2 before:left-[13px] before:w-px before:bg-border">
      {items.map((a) => {
        const Icon = ICONS[a.type as ActivityType] ?? StickyNote;
        const highlight = a.type === "deal_won" || a.type === "reply_received";
        return (
          <li key={a.id} className="relative flex gap-3">
            <span className={cn("relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border bg-background", highlight && "border-success/40 bg-success-soft")}>
              <Icon className={cn("size-3.5", highlight ? "text-success" : "text-muted-foreground")} />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="text-sm font-medium">{a.title || ACTIVITY_LABELS[a.type as ActivityType] || a.type}</p>
                <time dateTime={a.occurred_at} title={formatDateTime(a.occurred_at)} className="text-xs text-muted-foreground">{formatRelative(a.occurred_at)}</time>
              </div>
              {a.body && <p className="mt-1 line-clamp-4 whitespace-pre-line text-sm text-muted-foreground">{a.body}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
