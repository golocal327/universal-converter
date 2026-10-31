import { cn } from "@/lib/utils";

export function WireMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-6", className)}>
      <rect width="32" height="32" rx="8" className="fill-foreground" />
      <path d="M7 10l3.2 12L14 13h2l3.8 9L23 10" fill="none" className="stroke-background" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function WireLogo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2 font-semibold tracking-tight whitespace-nowrap", className)}>
      <WireMark />
      <span>
        WIRE <span className="font-normal text-muted-foreground">Sales OS</span>
      </span>
    </span>
  );
}
