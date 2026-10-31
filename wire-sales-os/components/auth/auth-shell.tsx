import { WireLogo } from "@/components/app/logo";

const FACTORS = [
  { points: "+25", label: "No website" },
  { points: "+15", label: "500+ Google reviews" },
  { points: "+12", label: "High-value sector" },
  { points: "+12", label: "No online booking" },
  { points: "+10", label: "Weak Google conversion" },
];

/** Split layout for auth screens. The right panel previews the product, no stock imagery. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <WireLogo />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} WIRE</p>
      </div>
      <div className="relative hidden overflow-hidden border-l bg-sidebar lg:block">
        <div className="absolute inset-0 [background-image:radial-gradient(var(--border)_1px,transparent_1px)] [background-size:22px_22px] opacity-70" />
        <div className="relative flex h-full flex-col justify-center px-16">
          <p className="max-w-md text-3xl font-semibold leading-tight tracking-tight">
            Know exactly who to sell to tomorrow — and what to say.
          </p>
          <div className="mt-10 w-full max-w-md rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium">Autoescuela Bahía Norte</p>
                <p className="text-xs text-muted-foreground">Autoescuelas · Cádiz</p>
              </div>
              <div className="text-right">
                <p className="tabular text-2xl font-semibold text-hot">87</p>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Lead score</p>
              </div>
            </div>
            <ul className="mt-4 space-y-1.5">
              {FACTORS.map((f) => (
                <li key={f.label} className="flex items-center gap-3 text-sm">
                  <span className="tabular w-8 font-mono text-xs text-success">{f.points}</span>
                  <span className="text-muted-foreground">{f.label}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 rounded-lg bg-muted px-3 py-2.5 text-xs">
              <span className="font-medium">Recommended:</span> Premium website · €2,400 + €180/mo
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
