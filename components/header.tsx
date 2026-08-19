import { ArrowLeftRight, Menu } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { categories } from "@/lib/units/registry";

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <ArrowLeftRight size={16} />
          </span>
          <span className="hidden sm:inline">Universal Converter</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
          <Link href="/convert" className="text-muted transition-colors hover:text-foreground">
            Convert
          </Link>
          <div className="group relative">
            <button className="text-muted transition-colors hover:text-foreground">Categories</button>
            <div className="invisible absolute top-full left-1/2 z-40 grid w-[560px] -translate-x-1/2 grid-cols-3 gap-1 rounded-2xl border border-border bg-surface p-3 opacity-0 shadow-lg transition-all group-hover:visible group-hover:opacity-100">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/converters/${category.id}`}
                  className="rounded-lg px-3 py-2 text-sm hover:bg-accent-soft"
                >
                  {category.name}
                </Link>
              ))}
            </div>
          </div>
          <Link href="/tools" className="text-muted transition-colors hover:text-foreground">
            Tools
          </Link>
          <Link href="/guides" className="text-muted transition-colors hover:text-foreground">
            Guides
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button className="text-muted md:hidden" aria-label="Open menu">
            <Menu size={20} />
          </button>
        </div>
      </div>
    </header>
  );
}
