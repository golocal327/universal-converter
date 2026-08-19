import * as icons from "lucide-react";
import type { LucideProps } from "lucide-react";

/** Renders a lucide icon by its string name (as stored in CategoryDefinition.icon). */
export function Icon({ name, ...props }: { name: string } & LucideProps) {
  const IconComponent = (icons as unknown as Record<string, icons.LucideIcon>)[name] ?? icons.CircleDashed;
  return <IconComponent {...props} />;
}
