"use client";

import { ArrowRight, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatNumber } from "@/lib/format";
import { parseAndConvert } from "@/lib/parser";
import { search as searchIndex, slugForPair } from "@/lib/search-index";
import { cn } from "@/lib/utils";

const EXAMPLES = [
  "100 kg to lbs",
  "25 celsius to fahrenheit",
  "60 mph to kmh",
  "10 gallons to liters",
  "500 watts to horsepower",
  "100 psi to bar",
];

export function SmartSearch({ size = "lg" }: { size?: "lg" | "sm" }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const directResult = useMemo(() => {
    if (!query.trim() || !/\d/.test(query)) return null;
    const result = parseAndConvert(query);
    return "reason" in result ? null : result;
  }, [query]);

  const suggestions = useMemo(() => {
    if (!query.trim() || directResult) return [];
    return searchIndex(query, 6);
  }, [query, directResult]);

  function goToDirectResult() {
    if (!directResult) return;
    const slug = slugForPair(directResult.fromUnit.id, directResult.toUnit.id);
    router.push(`/converters/${slug}?value=${encodeURIComponent(String(directResult.value))}`);
  }

  return (
    <div className="relative w-full">
      <div
        className={cn(
          "flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 shadow-sm transition-shadow focus-within:shadow-md",
          size === "lg" ? "h-16 sm:h-[72px]" : "h-11"
        )}
      >
        <Search className={cn("shrink-0 text-muted", size === "lg" ? "size-6" : "size-4")} />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && directResult) goToDirectResult();
          }}
          placeholder="100 kg to lbs, 25 celsius to fahrenheit, 60 mph to kmh…"
          aria-label="Convert anything"
          className={cn(
            "w-full bg-transparent outline-none placeholder:text-muted",
            size === "lg" ? "text-lg sm:text-xl" : "text-sm"
          )}
        />
        {directResult && (
          <button
            onClick={goToDirectResult}
            className="flex shrink-0 items-center gap-1 rounded-xl bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
          >
            {formatNumber(directResult.result, "auto")} {directResult.toUnit.symbol}
            <ArrowRight size={14} />
          </button>
        )}
      </div>

      {open && (suggestions.length > 0 || (!query.trim() && size === "lg")) && (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-border bg-surface shadow-lg">
          {!query.trim() && size === "lg" && (
            <div className="p-3">
              <p className="px-2 pb-2 text-xs font-medium tracking-wide text-muted uppercase">Try an example</p>
              <div className="flex flex-wrap gap-2 px-2">
                {EXAMPLES.map((example) => (
                  <button
                    key={example}
                    onMouseDown={() => setQuery(example)}
                    className="rounded-full border border-border bg-background px-3 py-1.5 text-sm hover:border-accent hover:text-accent"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          )}
          {suggestions.map((item) => (
            <button
              key={item.href + item.label}
              onMouseDown={() => router.push(item.href)}
              className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-accent-soft"
            >
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                {item.description && <p className="text-xs text-muted">{item.description}</p>}
              </div>
              <ArrowRight size={14} className="shrink-0 text-muted" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
