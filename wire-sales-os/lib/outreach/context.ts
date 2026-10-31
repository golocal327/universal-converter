import type { AuditOpportunity, AuditSignalsDetail } from "@/lib/audit/analyzer";
import type { Priority, ValueTier } from "@/lib/domain/constants";
import type { PricingRecommendation } from "@/lib/pricing/engine";
import type { ScoreFactor } from "@/lib/scoring/engine";

/**
 * Everything WIRE knows about a lead, in one structure. Generators (rules
 * engine), templates and AI prompts all consume this — so every message is
 * built from real data, never generic copy.
 */
export type LeadContext = {
  company: {
    id: string;
    name: string;
    city: string | null;
    province: string | null;
    sector: string | null;
    subsector: string | null;
    website: string | null;
    domain: string | null;
    phone: string | null;
    email: string | null;
    google_rating: number | null;
    google_reviews_count: number | null;
    instagram_url: string | null;
    description: string | null;
    services_offered: string[];
    employees_estimate: number | null;
  };
  contact: { name: string | null; role: string | null; email: string | null; phone: string | null } | null;
  sector: {
    name: string;
    value_tier: ValueTier;
    booking_relevant: boolean;
    whatsapp_relevant: boolean;
    common_problems: string[];
    sales_arguments: string[];
  } | null;
  lead: { id: string; score: number; priority: Priority; factors: ScoreFactor[] } | null;
  audit: {
    status: "completed" | "failed" | "pending";
    overall: number | null;
    performance: number | null;
    seo: number | null;
    ux: number | null;
    conversion: number | null;
    mobile: number | null;
    opportunities: AuditOpportunity[];
    signals: Partial<AuditSignalsDetail>;
    error?: string | null;
  } | null;
  pricing: PricingRecommendation | null;
  sender: { name: string; company: string; email?: string | null; phone?: string | null };
};

export type DetectedProblem = {
  key: string;
  title: string;
  /** Spanish title for client-facing documents (proposals). */
  titleEs: string;
  /** Spanish clause usable after "he visto que …" (lowercase start, no final period). */
  sentence: string;
  /** Business consequence, Spanish. */
  impact: string;
  service: string;
};

/** Ordered list of the lead's real problems, most commercially relevant first. */
export function detectProblems(ctx: LeadContext): DetectedProblem[] {
  const out: DetectedProblem[] = [];
  const { company, audit, sector } = ctx;
  const reviews = company.google_reviews_count ?? 0;
  const reviewsText = formatNumberEs(reviews);

  if (!company.website) {
    out.push({
      key: "no_website",
      title: "No website",
      titleEs: "Sin web propia",
      sentence: reviews >= 30
        ? `tenéis ${reviewsText} reseñas en Google pero no una web propia donde esa gente pueda informarse${sector?.booking_relevant ? " o reservar" : " o contactaros"}`
        : `no tenéis una web propia, así que quien os busca en Google no encuentra dónde informarse${sector?.booking_relevant ? " ni reservar" : ""}`,
      impact: "Cada búsqueda en Google o Instagram que no encuentra web es un cliente que se va a la competencia.",
      service: "website-premium",
    });
  } else if (audit?.status === "failed") {
    out.push({
      key: "website_broken",
      title: "Website not working",
      titleEs: "La web no funciona",
      sentence: "vuestra web no está cargando correctamente ahora mismo",
      impact: "Una web caída transmite que el negocio está cerrado o descuidado.",
      service: "website-redesign",
    });
  }

  const opp = new Map((audit?.opportunities ?? []).map((o) => [o.key, o]));
  const sig = audit?.signals ?? {};
  if (audit?.status === "completed") {
    if (sector?.booking_relevant && sig.hasBooking === false) {
      out.push({ key: "no_booking", title: "No online booking", titleEs: "Sin reservas online", service: "booking-system",
        sentence: "en la web no se puede reservar ni pedir cita online",
        impact: "Quien quiere reservar fuera de horario o sin llamar acaba eligiendo a otro." });
    }
    if (opp.has("weak_mobile") || sig.hasViewport === false) {
      out.push({ key: "weak_mobile", title: "Weak mobile experience", titleEs: "Mala experiencia en móvil", service: "website-redesign",
        sentence: "la web cuesta de usar desde el móvil",
        impact: "La mayoría de búsquedas locales se hacen desde el móvil." });
    }
    if (opp.has("outdated")) {
      out.push({ key: "outdated", title: "Outdated website", titleEs: "Web desactualizada", service: "website-redesign",
        sentence: "la web transmite una imagen más antigua que la de vuestro negocio real",
        impact: "La primera impresión online decide si os llaman o no." });
    }
    if (opp.has("no_cta")) {
      out.push({ key: "no_cta", title: "No clear CTA", titleEs: "Sin llamada a la acción clara", service: "website-redesign",
        sentence: "la web no deja claro qué hacer para contactaros o pedir presupuesto",
        impact: "Sin una llamada a la acción clara, las visitas no se convierten en contactos." });
    }
    if (opp.has("no_https")) {
      out.push({ key: "no_https", title: "No HTTPS", titleEs: "Sin HTTPS", service: "web-maintenance",
        sentence: "el navegador marca vuestra web como «No segura»",
        impact: "El aviso de 'No seguro' espanta a los visitantes y penaliza en Google." });
    }
    if (opp.has("slow")) {
      out.push({ key: "slow", title: "Slow website", titleEs: "Web lenta", service: "website-redesign",
        sentence: "la web tarda demasiado en cargar",
        impact: "Cada segundo de carga extra hace que parte de las visitas abandonen." });
    }
    if (opp.has("poor_seo_metadata")) {
      out.push({ key: "poor_seo", title: "Weak SEO", titleEs: "SEO local débil", service: "seo-local",
        sentence: `la web no está bien preparada para aparecer en Google cuando alguien busca ${sector?.name?.toLowerCase() ?? "vuestros servicios"} en ${company.city ?? "vuestra zona"}`,
        impact: "Si no aparecéis en las búsquedas locales, esos clientes se los lleva la competencia." });
    }
    if (sector?.whatsapp_relevant && sig.hasWhatsapp === false) {
      out.push({ key: "no_whatsapp", title: "No WhatsApp CTA", titleEs: "Sin botón de WhatsApp", service: "whatsapp-integration",
        sentence: "no hay un botón de WhatsApp para escribiros directamente",
        impact: "Muchos clientes prefieren escribir por WhatsApp antes que llamar." });
    }
    if (opp.has("no_lead_capture")) {
      out.push({ key: "no_lead_capture", title: "No lead capture", titleEs: "Sin captación de contactos", service: "automation",
        sentence: "no hay ningún formulario para recoger solicitudes",
        impact: "Los interesados que no llaman en ese momento se pierden." });
    }
  }

  if ((company.google_rating ?? 5) < 4 && reviews >= 10) {
    out.push({ key: "low_rating", title: "Low Google rating", titleEs: "Valoración mejorable en Google", service: "review-nfc",
      sentence: `la valoración en Google (${formatNumberEs(company.google_rating ?? 0)}★) está por debajo de lo que merece el negocio`,
      impact: "La nota en Google es uno de los primeros filtros para elegir negocio." });
  } else if (reviews > 0 && reviews < 20) {
    out.push({ key: "few_reviews", title: "Few Google reviews", titleEs: "Pocas reseñas en Google", service: "review-nfc",
      sentence: `tenéis pocas reseñas en Google (${reviews}) para todo el trabajo que hacéis`,
      impact: "Más reseñas recientes = más confianza y mejor posición en Google Maps." });
  }

  // De-duplicate by service+key, keep order.
  const seen = new Set<string>();
  return out.filter((p) => (seen.has(p.key) ? false : (seen.add(p.key), true)));
}

export function firstName(fullName: string | null | undefined): string | null {
  if (!fullName) return null;
  const first = fullName.trim().split(/\s+/)[0];
  return first || null;
}

/** Spanish number formatting for client-facing copy: 1240 → "1.240", 4.5 → "4,5". */
export function formatNumberEs(value: number): string {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1, useGrouping: true }).format(value).replace(/^(\d)(\d{3})$/, "$1.$2");
}

export function formatEuro(value: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}
