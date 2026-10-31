"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

/** Debounced search box bound to the `q` URL param (server-side filtering). */
export function SearchInput({ placeholder }: { placeholder: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    if ((params.get("q") ?? "") === value) return;
    const t = setTimeout(() => {
      const sp = new URLSearchParams(params);
      if (value) sp.set("q", value); else sp.delete("q");
      sp.delete("page");
      startTransition(() => router.replace(`${pathname}?${sp}`, { scroll: false }));
    }, 300);
    return () => clearTimeout(t);
  }, [value, params, pathname, router]);
  return (
    <div className="relative w-full sm:w-72">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} className="h-8 pl-8" aria-label={placeholder} />
      {pending && <Loader2 className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
    </div>
  );
}

export function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <a href={href} aria-current={active ? "true" : undefined} className={`inline-flex h-8 items-center rounded-md border px-2.5 text-xs font-medium transition-colors ${active ? "border-foreground bg-foreground text-background" : "hover:bg-muted"}`}>
      {children}
    </a>
  );
}
