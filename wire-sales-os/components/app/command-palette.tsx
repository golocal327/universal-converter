"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useTheme } from "next-themes";
import { Building2, CheckSquare, FileText, Loader2, Mail, Megaphone, Moon, Plus, Sparkles, User } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { globalSearch, type SearchHit } from "@/lib/actions/search";
import { NAV_ITEMS } from "./nav";

export const OPEN_PALETTE_EVENT = "wire:open-palette";

const KIND_ICON: Record<string, typeof Building2> = { company: Building2, contact: User, campaign: Megaphone, task: CheckSquare, template: FileText };

/** Global ⌘K palette + "g x" navigation shortcuts. */
export function CommandPalette() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [pending, startTransition] = useTransition();
  const lastKey = useRef<{ key: string; at: number } | null>(null);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      const target = e.target as HTMLElement | null;
      if (!target || e.metaKey || e.ctrlKey || e.altKey) return;
      if (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      const key = e.key.toLowerCase();
      const prev = lastKey.current;
      lastKey.current = { key, at: Date.now() };
      if (prev && Date.now() - prev.at < 900) {
        if (prev.key === "g") {
          const item = NAV_ITEMS.find((i) => i.shortcut === `G ${key.toUpperCase()}`);
          if (item) {
            e.preventDefault();
            router.push(item.href);
            lastKey.current = null;
          }
        } else if (prev.key === "c") {
          if (key === "l") router.push("/leads/new");
          if (key === "t") router.push("/tasks?new=1");
          lastKey.current = null;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, [router]);

  useEffect(() => {
    if (query.trim().length < 2) return;
    const handle = setTimeout(() => startTransition(async () => setHits(await globalSearch(query))), 180);
    return () => clearTimeout(handle);
  }, [query]);

  const visibleHits = query.trim().length >= 2 ? hits : [];

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Command palette" description="Search or run a command">
      <CommandInput placeholder="Search companies, contacts, campaigns… or type a command" value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>{pending ? <Loader2 className="mx-auto size-4 animate-spin" /> : "No results."}</CommandEmpty>
        {visibleHits.length > 0 && (
          <CommandGroup heading="Results">
            {visibleHits.map((hit) => {
              const Icon = KIND_ICON[hit.kind] ?? Building2;
              return (
                <CommandItem key={`${hit.kind}-${hit.id}`} value={`${hit.kind} ${hit.title} ${hit.subtitle}`} onSelect={() => go(hit.href)}>
                  <Icon className="text-muted-foreground" />
                  <span className="truncate">{hit.title}</span>
                  <span className="truncate text-xs text-muted-foreground">{hit.subtitle}</span>
                </CommandItem>
              );
            })}
            {visibleHits.filter((h) => h.kind === "company").slice(0, 2).map((hit) => (
              <CommandItem key={`ai-${hit.id}`} value={`analyze ${hit.title}`} onSelect={() => go(`/copilot?company=${hit.id}`)}>
                <Sparkles className="text-muted-foreground" /> Run AI analysis on {hit.title}
              </CommandItem>
            ))}
            {visibleHits.filter((h) => h.kind === "company").slice(0, 2).map((hit) => (
              <CommandItem key={`mail-${hit.id}`} value={`email ${hit.title}`} onSelect={() => go(`/companies/${hit.id}?tab=outreach`)}>
                <Mail className="text-muted-foreground" /> Generate email for {hit.title}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandGroup heading="Actions">
          <CommandItem value="create lead new" onSelect={() => go("/leads/new")}>
            <Plus /> Create lead <CommandShortcut>C L</CommandShortcut>
          </CommandItem>
          <CommandItem value="create task new" onSelect={() => go("/tasks?new=1")}>
            <CheckSquare /> Create task <CommandShortcut>C T</CommandShortcut>
          </CommandItem>
          <CommandItem value="import csv leads" onSelect={() => go("/leads/import")}>
            <FileText /> Import leads from CSV
          </CommandItem>
          <CommandItem value="find leads discovery prospects" onSelect={() => go("/prospects")}>
            <Building2 /> Find new leads
          </CommandItem>
          <CommandItem value="ai analysis copilot daily briefing" onSelect={() => go("/copilot")}>
            <Sparkles /> Run AI analysis
          </CommandItem>
          <CommandItem value="generate email outreach" onSelect={() => go("/leads?sort=score")}>
            <Mail /> Generate email (pick a lead)
          </CommandItem>
          <CommandItem value="toggle theme dark light" onSelect={() => { setTheme(resolvedTheme === "dark" ? "light" : "dark"); setOpen(false); }}>
            <Moon /> Toggle dark mode
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Go to">
          {NAV_ITEMS.map((item) => (
            <CommandItem key={item.href} value={`go ${item.label}`} onSelect={() => go(item.href)}>
              <item.icon /> {item.label}
              {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
