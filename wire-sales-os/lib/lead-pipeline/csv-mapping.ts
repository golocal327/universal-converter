import type { RawLead } from "./validate";
import { stripAccents } from "./normalize";

/** Fields a CSV column can be mapped to. */
export const IMPORT_FIELDS = [
  "company_name",
  "legal_name",
  "website",
  "phone",
  "email",
  "city",
  "province",
  "country",
  "address",
  "postal_code",
  "sector",
  "subsector",
  "rating",
  "reviews",
  "last_review_at",
  "instagram",
  "facebook",
  "linkedin",
  "google_maps_url",
  "google_place_id",
  "employees",
  "description",
  "services",
  "opening_hours",
  "contact_name",
  "contact_role",
  "contact_email",
  "contact_phone",
  "notes",
] as const satisfies readonly (keyof RawLead)[];
export type ImportField = (typeof IMPORT_FIELDS)[number];

export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  company_name: "Company name",
  legal_name: "Legal name",
  website: "Website",
  phone: "Phone",
  email: "Email",
  city: "City",
  province: "Province",
  country: "Country",
  address: "Address",
  postal_code: "Postal code",
  sector: "Sector",
  subsector: "Subsector",
  rating: "Google rating",
  reviews: "Google reviews",
  last_review_at: "Last review date",
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  google_maps_url: "Google Maps URL",
  google_place_id: "Google Place ID",
  employees: "Employees",
  description: "Description",
  services: "Services",
  opening_hours: "Opening hours",
  contact_name: "Contact name",
  contact_role: "Contact role",
  contact_email: "Contact email",
  contact_phone: "Contact phone",
  notes: "Notes",
};

/** Header synonyms (normalized: lowercase, no accents, single spaces). English + Spanish. */
const SYNONYMS: Record<ImportField, string[]> = {
  company_name: ["company name", "company", "empresa", "nombre", "name", "business", "business name", "negocio", "nombre comercial", "title", "titulo"],
  legal_name: ["legal name", "razon social", "denominacion social"],
  website: ["website", "web", "url", "sitio web", "pagina web", "domain", "dominio", "site"],
  phone: ["phone", "telefono", "tel", "telephone", "movil", "mobile", "phone number", "numero", "phone unformatted"],
  email: ["email", "e mail", "correo", "correo electronico", "mail"],
  city: ["city", "ciudad", "localidad", "municipio", "town", "poblacion"],
  province: ["province", "provincia", "state", "region", "comunidad"],
  country: ["country", "pais", "country code"],
  address: ["address", "direccion", "domicilio", "street", "calle", "full address", "formatted address"],
  postal_code: ["postal code", "codigo postal", "cp", "zip", "zip code", "postcode"],
  sector: ["sector", "category", "categoria", "industry", "industria", "actividad", "category name", "type"],
  subsector: ["subsector", "subcategory", "subcategoria", "specialty", "especialidad"],
  rating: ["rating", "valoracion", "puntuacion", "stars", "estrellas", "google rating", "total score", "totalscore"],
  reviews: ["reviews", "resenas", "opiniones", "review count", "reviews count", "number of reviews", "user ratings total", "num reviews", "reviewscount"],
  last_review_at: ["last review", "last review date", "ultima resena", "fecha ultima resena"],
  instagram: ["instagram", "ig", "instagram url"],
  facebook: ["facebook", "fb", "facebook url"],
  linkedin: ["linkedin", "linkedin url"],
  google_maps_url: ["google maps", "google maps url", "maps", "maps url", "gmaps", "url maps"],
  google_place_id: ["place id", "placeid", "google place id"],
  employees: ["employees", "empleados", "employee count", "plantilla", "trabajadores", "size"],
  description: ["description", "descripcion", "about", "sobre nosotros"],
  services: ["services", "servicios"],
  opening_hours: ["opening hours", "horario", "hours", "horarios"],
  contact_name: ["contact", "contact name", "contacto", "nombre contacto", "persona de contacto", "owner", "propietario"],
  contact_role: ["role", "cargo", "position", "puesto", "job title", "title contact"],
  contact_email: ["contact email", "email contacto", "correo contacto"],
  contact_phone: ["contact phone", "telefono contacto", "movil contacto"],
  notes: ["notes", "notas", "comments", "comentarios", "observaciones"],
};

export function normalizeHeader(header: string): string {
  return stripAccents(header.toLowerCase())
    .replace(/[_\-./]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type ColumnMapping = Record<string, ImportField | null>;

/** Auto-detect a mapping from headers; each field is used at most once (first exact match wins). */
export function detectMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<ImportField>();
  const normalized = headers.map(normalizeHeader);

  // Pass 1: exact synonym matches. Pass 2: header contains a multi-word synonym.
  for (const pass of [1, 2] as const) {
    normalized.forEach((h, i) => {
      const header = headers[i];
      if (mapping[header]) return;
      for (const field of IMPORT_FIELDS) {
        if (used.has(field)) continue;
        const hit =
          pass === 1
            ? SYNONYMS[field].includes(h)
            : SYNONYMS[field].some((s) => s.includes(" ") && h.includes(s));
        if (hit) {
          mapping[header] = field;
          used.add(field);
          return;
        }
      }
    });
  }
  for (const header of headers) if (!(header in mapping)) mapping[header] = null;
  return mapping;
}

/** Apply a mapping to a parsed CSV row. */
export function applyMapping(row: Record<string, unknown>, mapping: ColumnMapping): RawLead {
  const raw: RawLead = {};
  for (const [header, field] of Object.entries(mapping)) {
    if (!field) continue;
    const value = row[header];
    if (value === undefined || value === null || value === "") continue;
    raw[field] = value;
  }
  return raw;
}
