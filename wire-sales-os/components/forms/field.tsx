import type { FieldError } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Label + control + error, wired for accessibility (aria-invalid / aria-describedby by id). */
export function FormField({ id, label, error, hint, className, children }: {
  id: string; label: string; error?: FieldError | string; hint?: string; className?: string; children: React.ReactNode;
}) {
  const message = typeof error === "string" ? error : error?.message;
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id} className="text-xs font-medium">{label}</Label>
      {children}
      {message ? <p id={`${id}-error`} className="text-xs text-destructive">{message}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
