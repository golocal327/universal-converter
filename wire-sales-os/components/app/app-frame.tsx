"use client";
import Link from "next/link";
import { useState } from "react";
import { Menu, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { CommandPalette, OPEN_PALETTE_EVENT } from "./command-palette";
import { WireLogo } from "./logo";
import { Sidebar, type SidebarProps } from "./sidebar";

/** App chrome: fixed sidebar on desktop, sheet on mobile, slim top bar with search. */
export function AppFrame({ children, ...sidebar }: SidebarProps & { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const openPalette = () => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT));
  return (
    <div className="flex min-h-svh">
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 border-r border-sidebar-border lg:block print:hidden">
        <Sidebar {...sidebar} />
      </aside>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0" showCloseButton={false}>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Sidebar {...sidebar} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Menu />
          </Button>
          <Link href="/" className="lg:hidden"><WireLogo className="text-sm" /></Link>
          <button
            type="button"
            onClick={openPalette}
            className="ml-auto flex h-8 w-full max-w-sm items-center gap-2 rounded-lg border bg-muted/40 px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted lg:ml-0"
          >
            <Search className="size-4" />
            <span className="hidden flex-1 text-left sm:inline">Search or jump to…</span>
            <kbd className="hidden rounded border bg-background px-1.5 font-mono text-[10px] sm:inline">⌘K</kbd>
          </button>
          <div className="ml-auto hidden items-center gap-2 sm:flex">
            <Button asChild size="sm">
              <Link href="/leads/new"><Plus /> New lead</Link>
            </Button>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
      <CommandPalette />
    </div>
  );
}
