"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowUp, Building2, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { AnalysisView } from "@/components/company/ai-analysis-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { copilotAsk, type CopilotReply } from "@/lib/actions/ai";
import { globalSearch, type SearchHit } from "@/lib/actions/search";
import { COPILOT_QUICK_PROMPTS } from "@/lib/ai/prompts";
import { cn } from "@/lib/utils";

type Turn = { role: "user"; content: string } | { role: "assistant"; reply: CopilotReply };

function assistantText(reply: CopilotReply) {
  return reply.mode === "text" ? reply.text : JSON.stringify(reply.analysis);
}

export function CopilotChat({ company, aiConfigured }: { company: { id: string; name: string; subtitle: string } | null; aiConfigured: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [pending, startTransition] = useTransition();
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [turns, pending]);
  useEffect(() => {
    if (query.trim().length < 2) return;
    const t = setTimeout(async () => setHits((await globalSearch(query)).filter((h) => h.kind === "company")), 200);
    return () => clearTimeout(t);
  }, [query]);

  const ask = (prompt: string) => {
    if (!prompt.trim() || pending) return;
    const history = turns.map((t) => (t.role === "user" ? { role: "user" as const, content: t.content } : { role: "assistant" as const, content: assistantText(t.reply) }));
    setTurns((t) => [...t, { role: "user", content: prompt }]);
    setInput("");
    startTransition(async () => {
      const r = await copilotAsk({ companyId: company?.id ?? null, prompt, history });
      if (!r.ok) {
        toast.error(r.error);
        setTurns((t) => t.slice(0, -1));
        setInput(prompt);
        return;
      }
      setTurns((t) => [...t, { role: "assistant", reply: r.data }]);
    });
  };

  return (
    <div className="flex h-[calc(100svh-3.5rem)] flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3 sm:px-6">
        <Building2 className="size-4 text-muted-foreground" />
        {company ? (
          <span className="flex items-center gap-2 text-sm">
            <Link href={`/companies/${company.id}`} className="font-medium hover:underline">{company.name}</Link>
            <span className="text-xs text-muted-foreground">{company.subtitle}</span>
            <Button size="icon-xs" variant="ghost" aria-label="Clear lead context" onClick={() => { setTurns([]); router.push(pathname); }}><X /></Button>
          </span>
        ) : (
          <div className="relative w-full max-w-sm">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Pick a lead for context (optional)…" className="h-8" />
            {hits.length > 0 && query.length >= 2 && (
              <ul className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md">
                {hits.map((h) => (
                  <li key={h.id}><button type="button" className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted" onClick={() => { setQuery(""); setHits([]); setTurns([]); router.push(`${pathname}?company=${h.id}`); }}>{h.title} <span className="text-xs text-muted-foreground">{h.subtitle}</span></button></li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {turns.length === 0 && (
            <div className="py-10 text-center">
              <Sparkles className="mx-auto size-6 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">{company ? `Ask anything about ${company.name}` : "Ask about your pipeline, pricing, objections — or pick a lead"}</p>
              <p className="mt-1 text-sm text-muted-foreground">Answers are grounded in the lead’s real data: score, audit, sector playbook and pricing rules.</p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {COPILOT_QUICK_PROMPTS.filter((p) => company || !/this (lead|company)|the meeting/i.test(p)).map((p) => (
                  <button key={p} type="button" disabled={!aiConfigured || pending} onClick={() => ask(p)} className="rounded-full border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50">{p}</button>
                ))}
              </div>
            </div>
          )}
          {turns.map((t, i) =>
            t.role === "user" ? (
              <div key={i} className="flex justify-end"><p className="max-w-[85%] rounded-2xl rounded-br-md bg-foreground px-4 py-2.5 text-sm whitespace-pre-line text-background">{t.content}</p></div>
            ) : (
              <div key={i} className="space-y-2">
                {t.reply.mode === "analysis" ? <AnalysisView analysis={t.reply.analysis} /> : <div className="text-sm leading-relaxed whitespace-pre-line">{t.reply.text}</div>}
                <p className="text-[11px] text-muted-foreground">{t.reply.model}</p>
              </div>
            ),
          )}
          {pending && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Thinking…</p>}
          <div ref={bottom} />
        </div>
      </div>

      <div className="border-t px-4 py-3 sm:px-6">
        <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="mx-auto flex max-w-3xl items-end gap-2">
          <Textarea value={input} onChange={(e) => setInput(e.target.value)} rows={1} disabled={!aiConfigured}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input); } }}
            placeholder={aiConfigured ? (company ? `Message the Copilot about ${company.name}…` : "Message the Copilot…") : "AI is not configured"} className={cn("max-h-40 min-h-10 resize-none")} aria-label="Message" />
          <Button type="submit" size="icon" disabled={!aiConfigured || pending || !input.trim()} aria-label="Send"><ArrowUp /></Button>
        </form>
      </div>
    </div>
  );
}
