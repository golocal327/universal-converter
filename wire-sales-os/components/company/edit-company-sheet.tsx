"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { FormField } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { updateCompany } from "@/lib/actions/company";

export type EditableCompany = {
  id: string; name: string; legal_name: string | null; sector_id: string | null; subsector: string | null; city: string | null; province: string | null;
  address: string | null; postal_code: string | null; phone: string | null; email: string | null; website: string | null; instagram_url: string | null;
  instagram_followers: number | null; instagram_last_post_at: string | null; facebook_url: string | null; linkedin_url: string | null; google_maps_url: string | null;
  google_rating: number | null; google_reviews_count: number | null; google_last_review_at: string | null; employees_estimate: number | null;
  description: string | null; opening_hours: string | null; services_offered: string[]; growth_signals: string[];
};

type Values = Record<Exclude<keyof EditableCompany, "id" | "services_offered" | "growth_signals">, string> & { services_offered: string; growth_signals: string };

const FIELDS: { name: keyof Values; label: string; type?: string; wide?: boolean }[] = [
  { name: "name", label: "Company name" }, { name: "legal_name", label: "Legal name" },
  { name: "subsector", label: "Subsector" }, { name: "employees_estimate", label: "Employees", type: "number" },
  { name: "city", label: "City" }, { name: "province", label: "Province" },
  { name: "address", label: "Address", wide: true }, { name: "postal_code", label: "Postal code" },
  { name: "phone", label: "Phone" }, { name: "email", label: "Email" }, { name: "website", label: "Website" },
  { name: "instagram_url", label: "Instagram" }, { name: "instagram_followers", label: "Instagram followers", type: "number" },
  { name: "instagram_last_post_at", label: "Last Instagram post", type: "date" }, { name: "facebook_url", label: "Facebook" },
  { name: "linkedin_url", label: "LinkedIn" }, { name: "google_maps_url", label: "Google Maps URL", wide: true },
  { name: "google_rating", label: "Google rating" }, { name: "google_reviews_count", label: "Google reviews", type: "number" },
  { name: "google_last_review_at", label: "Last review date", type: "date" }, { name: "opening_hours", label: "Opening hours" },
  { name: "services_offered", label: "Services (comma separated)", wide: true }, { name: "growth_signals", label: "Growth signals (comma separated)", wide: true },
];

export function EditCompanySheet({ open, onOpenChange, company, sectors }: {
  open: boolean; onOpenChange: (v: boolean) => void; company: EditableCompany; sectors: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const toStr = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  const { register, handleSubmit, setValue, control, setError, formState: { errors } } = useForm<Values>({
    defaultValues: {
      ...(Object.fromEntries(Object.entries(company).map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : toStr(v)])) as Values),
    },
  });

  const sectorId = useWatch({ control, name: "sector_id" });

  const onSubmit = (v: Values) =>
    startTransition(async () => {
      const r = await updateCompany({ ...v, id: company.id, sector_id: v.sector_id || null });
      if (!r.ok) {
        for (const [k, m] of Object.entries(r.fieldErrors ?? {})) setError(k as keyof Values, { message: m[0] });
        toast.error(r.error);
        return;
      }
      toast.success("Company updated and rescored");
      onOpenChange(false);
      router.refresh();
    });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Edit company</SheetTitle>
          <SheetDescription>Changes are normalized and the lead is rescored on save.</SheetDescription>
        </SheetHeader>
        <form id="edit-company" onSubmit={handleSubmit(onSubmit)} className="grid gap-4 px-4 sm:grid-cols-2">
          <FormField id="sector_id" label="Sector" className="sm:col-span-2">
            <Select value={sectorId || "none"} onValueChange={(v) => setValue("sector_id", v === "none" ? "" : v)}>
              <SelectTrigger id="sector_id" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No sector</SelectItem>
                {sectors.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
          {FIELDS.map((f) => (
            <FormField key={f.name} id={`ec-${f.name}`} label={f.label} error={errors[f.name]} className={f.wide ? "sm:col-span-2" : undefined}>
              <Input id={`ec-${f.name}`} type={f.type ?? "text"} {...register(f.name, f.name === "name" ? { required: "Required" } : {})} />
            </FormField>
          ))}
          <FormField id="ec-description" label="Description" className="sm:col-span-2">
            <Textarea id="ec-description" rows={4} {...register("description")} />
          </FormField>
        </form>
        <SheetFooter>
          <Button type="submit" form="edit-company" disabled={pending}>{pending && <Loader2 className="animate-spin" />} Save changes</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
