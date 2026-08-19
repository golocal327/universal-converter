import Link from "next/link";
import { Icon } from "@/components/icon";
import type { CategoryDefinition } from "@/lib/units/types";

export function CategoryCard({ category }: { category: CategoryDefinition }) {
  return (
    <Link
      href={`/converters/${category.id}`}
      className="group flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-accent"
    >
      <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
        <Icon name={category.icon} size={20} />
      </span>
      <div>
        <p className="font-semibold">{category.name}</p>
        <p className="text-sm text-muted">{category.shortDescription}</p>
      </div>
      <p className="text-xs text-muted">{category.units.length} units</p>
    </Link>
  );
}
