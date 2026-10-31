import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AuthField({ name, label, type = "text", autoComplete, error, defaultValue }: {
  name: string; label: string; type?: string; autoComplete?: string; error?: string[]; defaultValue?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} autoComplete={autoComplete} defaultValue={defaultValue} aria-invalid={Boolean(error?.length)} className="h-9" required />
      {error?.length ? <p className="text-xs text-destructive">{error[0]}</p> : null}
    </div>
  );
}
