import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";

export function Pagination({ page, per, total, basePath, params }: {
  page: number; per: number; total: number; basePath: string; params: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / per));
  const href = (p: number) => {
    const sp = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]);
    sp.set("page", String(p));
    return `${basePath}?${sp}`;
  };
  const from = total ? (page - 1) * per + 1 : 0;
  const to = Math.min(total, page * per);
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-muted-foreground">
      <span className="tabular">{formatNumber(from)}–{formatNumber(to)} of {formatNumber(total)}</span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon-sm" asChild={page > 1} disabled={page <= 1} aria-label="Previous page">
          {page > 1 ? <Link href={href(page - 1)}><ChevronLeft /></Link> : <ChevronLeft />}
        </Button>
        <span className="tabular px-2">{page} / {pages}</span>
        <Button variant="outline" size="icon-sm" asChild={page < pages} disabled={page >= pages} aria-label="Next page">
          {page < pages ? <Link href={href(page + 1)}><ChevronRight /></Link> : <ChevronRight />}
        </Button>
      </div>
    </div>
  );
}
