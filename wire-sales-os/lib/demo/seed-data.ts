import type { StageKey } from "@/lib/domain/constants";

/**
 * Fictitious demo businesses. Names are invented, websites use the reserved
 * `.example` TLD and phone numbers are in a fictional range, so no real
 * company or person is represented.
 */
export type DemoAudit = {
  overall: number;
  performance: number;
  seo: number;
  ux: number;
  conversion: number;
  mobile: number;
  https: boolean;
  booking: boolean;
  whatsapp: boolean;
  cta: boolean;
  outdated: boolean;
  responseMs: number;
};

export type DemoCompany = {
  name: string;
  sector: string;
  city: string;
  province: string;
  website: string | null;
  rating: number | null;
  reviews: number | null;
  employees: number | null;
  instagram?: "active" | "abandoned";
  contact?: [string, string];
  audit?: DemoAudit | "broken";
  stage?: StageKey;
  campaign?: "autoescuelas-cadiz" | "clinicas-sevilla" | "restaurantes-malaga";
  daysAgo: number;
  growth?: string[];
};

const weak = (o: Partial<DemoAudit> = {}): DemoAudit => ({
  overall: 34, performance: 41, seo: 38, ux: 45, conversion: 22, mobile: 30, https: true, booking: false, whatsapp: false, cta: false, outdated: true, responseMs: 3400, ...o,
});
const average = (o: Partial<DemoAudit> = {}): DemoAudit => ({
  overall: 58, performance: 62, seo: 55, ux: 60, conversion: 48, mobile: 66, https: true, booking: false, whatsapp: true, cta: true, outdated: false, responseMs: 1500, ...o,
});
const strong = (o: Partial<DemoAudit> = {}): DemoAudit => ({
  overall: 84, performance: 80, seo: 88, ux: 86, conversion: 82, mobile: 90, https: true, booking: true, whatsapp: true, cta: true, outdated: false, responseMs: 600, ...o,
});

export const DEMO_COMPANIES: DemoCompany[] = [
  // Autoescuelas — Cádiz campaign
  { name: "Autoescuela Bahía Norte", sector: "autoescuelas", city: "Cádiz", province: "Cádiz", website: null, rating: 4.7, reviews: 612, employees: 9, instagram: "active", contact: ["Marta Lozano", "Directora"], stage: "meeting", campaign: "autoescuelas-cadiz", daysAgo: 21, growth: ["Hiring instructors"] },
  { name: "Autoescuela Vía Rápida", sector: "autoescuelas", city: "Jerez de la Frontera", province: "Cádiz", website: "https://autoescuela-viarapida.example", rating: 4.4, reviews: 287, employees: 6, contact: ["Rafael Moreno", "Gerente"], audit: weak({ https: false }), stage: "proposal", campaign: "autoescuelas-cadiz", daysAgo: 26 },
  { name: "Autoescuela El Carril", sector: "autoescuelas", city: "San Fernando", province: "Cádiz", website: "https://elcarril-autoescuela.example", rating: 4.1, reviews: 143, employees: 4, audit: weak(), stage: "contacted", campaign: "autoescuelas-cadiz", daysAgo: 12 },
  { name: "Autoescuela Puerto Real Centro", sector: "autoescuelas", city: "Puerto Real", province: "Cádiz", website: null, rating: 4.8, reviews: 98, employees: 3, instagram: "abandoned", campaign: "autoescuelas-cadiz", daysAgo: 9 },
  { name: "Autoescuela Atlántico", sector: "autoescuelas", city: "Chiclana de la Frontera", province: "Cádiz", website: "https://autoescuela-atlantico.example", rating: 4.6, reviews: 341, employees: 8, contact: ["Lucía Ramos", "Socia"], audit: average(), stage: "won", campaign: "autoescuelas-cadiz", daysAgo: 40 },
  { name: "Autoescuela Gades", sector: "autoescuelas", city: "Cádiz", province: "Cádiz", website: "https://gades-autoescuela.example", rating: 3.8, reviews: 76, employees: 3, audit: weak({ mobile: 22 }), campaign: "autoescuelas-cadiz", daysAgo: 5 },

  // Clínicas — Sevilla campaign
  { name: "Clínica Dental Arenal", sector: "clinicas", city: "Sevilla", province: "Sevilla", website: "https://dentalarenal.example", rating: 4.8, reviews: 823, employees: 14, instagram: "active", contact: ["Dra. Elena Prieto", "Directora médica"], audit: average({ booking: false, conversion: 41 }), stage: "negotiation", campaign: "clinicas-sevilla", daysAgo: 30 },
  { name: "Clínica Estética Giralda", sector: "clinicas", city: "Sevilla", province: "Sevilla", website: "https://esteticagiralda.example", rating: 4.5, reviews: 402, employees: 10, audit: weak({ https: true }), stage: "replied", campaign: "clinicas-sevilla", daysAgo: 15 },
  { name: "Centro Médico Nervión Salud", sector: "clinicas", city: "Sevilla", province: "Sevilla", website: "https://nervionsalud.example", rating: 4.2, reviews: 219, employees: 22, audit: average(), stage: "qualified", campaign: "clinicas-sevilla", daysAgo: 8 },
  { name: "Clínica Dental Triana Sonríe", sector: "clinicas", city: "Sevilla", province: "Sevilla", website: null, rating: 4.9, reviews: 355, employees: 7, instagram: "active", contact: ["Pablo Herrera", "Odontólogo"], campaign: "clinicas-sevilla", daysAgo: 3 },
  { name: "Policlínica Aljarafe", sector: "clinicas", city: "Mairena del Aljarafe", province: "Sevilla", website: "https://policlinica-aljarafe.example", rating: 4.6, reviews: 511, employees: 18, audit: strong(), stage: "lost", campaign: "clinicas-sevilla", daysAgo: 45 },

  // Fisioterapia
  { name: "Fisio Triana Movimiento", sector: "fisioterapia", city: "Sevilla", province: "Sevilla", website: "https://fisiotriana.example", rating: 4.9, reviews: 188, employees: 5, audit: weak({ outdated: false, overall: 44 }), stage: "contacted", daysAgo: 11 },
  { name: "Centro de Fisioterapia Bahía", sector: "fisioterapia", city: "Cádiz", province: "Cádiz", website: null, rating: 4.7, reviews: 64, employees: 3, daysAgo: 2 },
  { name: "Fisioactiva Jerez", sector: "fisioterapia", city: "Jerez de la Frontera", province: "Cádiz", website: "https://fisioactiva-jerez.example", rating: 4.3, reviews: 91, employees: 4, audit: average(), stage: "won", daysAgo: 52 },

  // Restaurantes — Málaga campaign
  { name: "Restaurante La Alacena del Puerto", sector: "restaurantes", city: "Málaga", province: "Málaga", website: "https://laalacena.example", rating: 4.5, reviews: 1240, employees: 16, instagram: "active", audit: weak({ booking: false }), stage: "proposal", campaign: "restaurantes-malaga", daysAgo: 18 },
  { name: "Taberna El Pimpi Chico", sector: "restaurantes", city: "Málaga", province: "Málaga", website: null, rating: 4.3, reviews: 860, employees: 12, instagram: "active", campaign: "restaurantes-malaga", daysAgo: 6 },
  { name: "Arrocería Malagueta", sector: "restaurantes", city: "Málaga", province: "Málaga", website: "https://arroceriamalagueta.example", rating: 3.9, reviews: 530, employees: 10, audit: "broken", stage: "contacted", campaign: "restaurantes-malaga", daysAgo: 10 },
  { name: "Bodega Las Columnas", sector: "restaurantes", city: "Marbella", province: "Málaga", website: "https://bodegalascolumnas.example", rating: 4.6, reviews: 690, employees: 14, audit: strong({ booking: true }), campaign: "restaurantes-malaga", daysAgo: 4 },

  // Barberías
  { name: "Barbería El Muelle", sector: "barberias", city: "El Puerto de Santa María", province: "Cádiz", website: null, rating: 4.9, reviews: 210, employees: 3, instagram: "active", daysAgo: 7 },
  { name: "Peluquería Estilo Sur", sector: "barberias", city: "Huelva", province: "Huelva", website: "https://estilosur.example", rating: 4.4, reviews: 57, employees: 2, audit: weak(), daysAgo: 14 },

  // Talleres
  { name: "Taller Mecánico Hermanos Vega", sector: "talleres", city: "Jerez de la Frontera", province: "Cádiz", website: null, rating: 4.6, reviews: 175, employees: 6, contact: ["Antonio Vega", "Propietario"], stage: "replied", daysAgo: 13 },
  { name: "Autoservicio Motor Sur", sector: "talleres", city: "Córdoba", province: "Córdoba", website: "https://motorsur-taller.example", rating: 4.0, reviews: 122, employees: 8, audit: weak({ https: false }), daysAgo: 20 },

  // Inmobiliarias
  { name: "Inmobiliaria Costa de la Luz", sector: "inmobiliarias", city: "Conil de la Frontera", province: "Cádiz", website: "https://costadelaluz-inmo.example", rating: 4.5, reviews: 96, employees: 7, audit: weak({ outdated: true }), stage: "meeting", daysAgo: 16, growth: ["New office"] },
  { name: "Habitat Sevilla Inmuebles", sector: "inmobiliarias", city: "Sevilla", province: "Sevilla", website: "https://habitatsevilla.example", rating: 4.2, reviews: 64, employees: 12, audit: average(), stage: "qualified", daysAgo: 6 },

  // Asesorías
  { name: "Asesoría Fiscal Gaditana", sector: "asesorias", city: "Cádiz", province: "Cádiz", website: "https://asesoriagaditana.example", rating: 4.7, reviews: 48, employees: 9, contact: ["Carmen Ruiz", "Socia directora"], audit: weak({ cta: false }), stage: "proposal", daysAgo: 24 },
  { name: "Gestoría Integral Andaluza", sector: "asesorias", city: "Granada", province: "Granada", website: "https://gestoria-integral.example", rating: 4.1, reviews: 33, employees: 15, audit: average(), daysAgo: 9 },

  // Veterinarios
  { name: "Clínica Veterinaria San Telmo", sector: "veterinarios", city: "Sevilla", province: "Sevilla", website: "https://vet-santelmo.example", rating: 4.8, reviews: 402, employees: 8, audit: weak({ booking: false, whatsapp: false }), stage: "contacted", daysAgo: 7 },
  { name: "Hospital Veterinario Bahía", sector: "veterinarios", city: "Cádiz", province: "Cádiz", website: null, rating: 4.6, reviews: 288, employees: 11, daysAgo: 1 },

  // Gimnasios
  { name: "Gimnasio Forja Fitness", sector: "gimnasios", city: "Málaga", province: "Málaga", website: "https://forjafitness.example", rating: 4.5, reviews: 377, employees: 13, instagram: "active", audit: average({ booking: false }), stage: "won", daysAgo: 60 },
  { name: "Box CrossTraining Levante", sector: "gimnasios", city: "Almería", province: "Almería", website: null, rating: 4.9, reviews: 142, employees: 4, instagram: "active", daysAgo: 5 },

  // Hoteles
  { name: "Hotel Mirador del Sur", sector: "hoteles", city: "Tarifa", province: "Cádiz", website: "https://miradordelsur-hotel.example", rating: 4.4, reviews: 980, employees: 25, audit: weak({ performance: 28, overall: 39 }), stage: "negotiation", daysAgo: 33 },
  { name: "Hostal Casa Azahar", sector: "hoteles", city: "Córdoba", province: "Córdoba", website: "https://casaazahar.example", rating: 4.7, reviews: 415, employees: 6, audit: strong(), daysAgo: 19 },

  // Seguros
  { name: "Correduría Atlántica Seguros", sector: "seguros", city: "Huelva", province: "Huelva", website: "https://atlantica-seguros.example", rating: 4.3, reviews: 51, employees: 10, audit: weak(), stage: "qualified", daysAgo: 4 },
  { name: "Seguros Familiares del Sur", sector: "seguros", city: "Sevilla", province: "Sevilla", website: null, rating: 4.0, reviews: 22, employees: 5, daysAgo: 2 },
];

export const DEMO_CAMPAIGNS = [
  { key: "autoescuelas-cadiz", name: "Autoescuelas Cádiz", sector: "autoescuelas", location: "Cádiz", website_requirement: "missing_or_weak", status: "active", channel: "email" },
  { key: "clinicas-sevilla", name: "Clínicas Sevilla", sector: "clinicas", location: "Sevilla", website_requirement: "weak", status: "active", channel: "email" },
  { key: "restaurantes-malaga", name: "Restaurantes Málaga", sector: "restaurantes", location: "Málaga", website_requirement: "any", status: "paused", channel: "whatsapp" },
] as const;
