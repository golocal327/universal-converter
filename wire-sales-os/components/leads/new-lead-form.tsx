"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { FormField } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createLead } from "@/lib/actions/leads";

const optionalNumber = (min: number, max: number, msg: string) =>
  z.string().refine((v) => v === "" || (!Number.isNaN(Number(v.replace(",", "."))) && Number(v.replace(",", ".")) >= min && Number(v.replace(",", ".")) <= max), msg);

const schema = z.object({
  company_name: z.string().trim().min(1, "Company name is required").max(200),
  sector: z.string(),
  city: z.string().max(120),
  province: z.string().max(120),
  address: z.string().max(300),
  phone: z.string().max(40),
  email: z.string().refine((v) => v === "" || z.string().email().safeParse(v).success, "Invalid email"),
  website: z.string().max(500),
  instagram: z.string().max(200),
  facebook: z.string().max(300),
  linkedin: z.string().max(300),
  google_maps_url: z.string().max(1000),
  rating: optionalNumber(0, 5, "Rating must be between 0 and 5"),
  reviews: optionalNumber(0, 10_000_000, "Invalid number"),
  employees: optionalNumber(0, 1_000_000, "Invalid number"),
  description: z.string().max(4000),
  contact_name: z.string().max(160),
  contact_role: z.string().max(120),
  contact_email: z.string().refine((v) => v === "" || z.string().email().safeParse(v).success, "Invalid email"),
  contact_phone: z.string().max(40),
  notes: z.string().max(4000),
  audit_now: z.boolean(),
});
type Values = z.infer<typeof schema>;

export function NewLeadForm({ sectors }: { sectors: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, setValue, control, setError, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      company_name: "", sector: "", city: "", province: "", address: "", phone: "", email: "", website: "", instagram: "", facebook: "", linkedin: "",
      google_maps_url: "", rating: "", reviews: "", employees: "", description: "", contact_name: "", contact_role: "", contact_email: "", contact_phone: "", notes: "", audit_now: true,
    },
  });
  const website = useWatch({ control, name: "website" });
  const auditNow = useWatch({ control, name: "audit_now" });

  const onSubmit = (values: Values) =>
    startTransition(async () => {
      const result = await createLead({ ...values, rating: values.rating.replace(",", ".") });
      if (!result.ok) {
        for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) setError(field as keyof Values, { message: messages[0] });
        toast.error(result.error);
        return;
      }
      toast.success(result.data.audited ? "Lead created and website audited" : "Lead created and scored");
      router.push(`/companies/${result.data.companyId}`);
    });

  const text = (name: keyof Values, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <FormField id={name} label={label} error={errors[name]}>
      <Input id={name} aria-invalid={Boolean(errors[name])} {...register(name)} {...props} />
    </FormField>
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-8" noValidate>
      <fieldset className="grid gap-4">
        <legend className="mb-1 text-sm font-semibold">Business</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {text("company_name", "Company name *", { autoFocus: true })}
          <FormField id="sector" label="Sector">
            <Select onValueChange={(v) => setValue("sector", v === "none" ? "" : v)}>
              <SelectTrigger id="sector" className="w-full"><SelectValue placeholder="Select a sector" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No sector</SelectItem>
                {sectors.map((s) => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
          {text("city", "City")}
          {text("province", "Province")}
          {text("address", "Address", { className: "sm:col-span-2" })}
        </div>
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="mb-1 text-sm font-semibold">Contact channels & presence</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {text("website", "Website", { placeholder: "example.com" })}
          {text("phone", "Phone", { type: "tel" })}
          {text("email", "Email", { type: "email" })}
          {text("instagram", "Instagram", { placeholder: "@handle or URL" })}
          {text("facebook", "Facebook URL")}
          {text("linkedin", "LinkedIn URL")}
          {text("google_maps_url", "Google Maps URL")}
          <div className="grid grid-cols-3 gap-3">
            {text("rating", "Rating", { inputMode: "decimal", placeholder: "4.6" })}
            {text("reviews", "Reviews", { inputMode: "numeric" })}
            {text("employees", "Employees", { inputMode: "numeric" })}
          </div>
        </div>
        <FormField id="description" label="Description">
          <Textarea id="description" rows={3} {...register("description")} />
        </FormField>
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="mb-1 text-sm font-semibold">Primary contact</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {text("contact_name", "Name")}
          {text("contact_role", "Role", { placeholder: "Owner, Director…" })}
          {text("contact_email", "Email", { type: "email" })}
          {text("contact_phone", "Phone", { type: "tel" })}
        </div>
        <FormField id="notes" label="Notes">
          <Textarea id="notes" rows={3} {...register("notes")} />
        </FormField>
      </fieldset>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-6">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={auditNow} disabled={!website} onCheckedChange={(v) => setValue("audit_now", v === true)} />
          Audit the website right after creating
        </label>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />} Create lead</Button>
        </div>
      </div>
    </form>
  );
}
