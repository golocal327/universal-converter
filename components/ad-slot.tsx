"use client";

import { useEffect, useRef } from "react";
import { adsenseConfig } from "@/lib/site-config";
import { cn } from "@/lib/utils";

type AdSlotPosition = "top" | "content" | "afterConverter" | "sidebar" | "beforeFaq" | "bottom";

const MIN_HEIGHT: Record<AdSlotPosition, number> = {
  top: 90,
  content: 120,
  afterConverter: 120,
  sidebar: 250,
  beforeFaq: 120,
  bottom: 90,
};

/**
 * Reserves a fixed-height slot for an AdSense unit so ads never shift layout
 * (no CLS) and never overlap converter controls or results — per the project's
 * AdSense UX rules. Renders nothing visible until NEXT_PUBLIC_ADSENSE_CLIENT
 * is configured; safe to leave in every page during development.
 */
export function AdSlot({ position, className }: { position: AdSlotPosition; className?: string }) {
  const ref = useRef<HTMLModElement>(null);

  useEffect(() => {
    if (!adsenseConfig.enabled) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
    } catch {
      // AdSense script not loaded yet (e.g. blocked by an ad blocker) — fail silently.
    }
  }, []);

  if (!adsenseConfig.enabled) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-md border border-dashed border-border text-xs text-muted",
          className
        )}
        style={{ minHeight: MIN_HEIGHT[position] }}
        data-ad-position={position}
        aria-hidden="true"
      >
        Ad space reserved ({position}) — configure NEXT_PUBLIC_ADSENSE_CLIENT to enable
      </div>
    );
  }

  const slotId = adsenseConfig.slots[position];
  if (!slotId) return null;

  return (
    <div className={className} style={{ minHeight: MIN_HEIGHT[position] }} data-ad-position={position}>
      <ins
        ref={ref}
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={adsenseConfig.client}
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
