import { ChevronRight } from "lucide-react";
import Link from "next/link";

export interface Breadcrumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: Breadcrumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-sm text-muted">
      {items.map((item, index) => (
        <span key={item.label} className="flex items-center gap-1.5">
          {index > 0 && <ChevronRight size={12} />}
          {item.href ? (
            <Link href={item.href} className="hover:text-foreground">
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
