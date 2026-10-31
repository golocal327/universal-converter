import Link from "next/link";
import { cn } from "@/lib/utils";

export function RangeTabs({ basePath, active }: { basePath: string; active: string }) {
  return (
    <div className="inline-flex rounded-lg border p-0.5" role="tablist" aria-label="Date range">
      {["7d", "30d", "90d", "365d"].map((r) => (
        <Link key={r} role="tab" aria-selected={active === r} href={`${basePath}?range=${r}`} scroll={false}
          className={cn("rounded-md px-2.5 py-1 text-xs font-medium", active === r ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
          {r === "365d" ? "12m" : r}
        </Link>
      ))}
    </div>
  );
}
