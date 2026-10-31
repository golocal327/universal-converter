import { slugify, stripAccents } from "./normalize";

export type SectorRef = { id: string; name: string; slug: string; keywords: string[] };

/** Match a free-text sector/category ("Dentista", "driving_school", "Autoescuela") to a configured sector. */
export function matchSector(raw: string | null | undefined, sectors: SectorRef[]): SectorRef | null {
  if (!raw) return null;
  const value = stripAccents(raw.toLowerCase()).replace(/[_-]+/g, " ").trim();
  const slug = slugify(raw);
  for (const s of sectors) if (s.slug === slug || stripAccents(s.name.toLowerCase()) === value) return s;
  for (const s of sectors) {
    const terms = [s.name, s.slug.replace(/-/g, " "), ...s.keywords].map((k) => stripAccents(k.toLowerCase()));
    if (terms.some((t) => t.length >= 4 && (value.includes(t) || t.includes(value)))) return s;
  }
  // Singular/plural tolerance ("autoescuela" vs "autoescuelas").
  for (const s of sectors) {
    const base = stripAccents(s.name.toLowerCase()).replace(/s$/, "");
    if (base.length >= 4 && value.replace(/s$/, "").includes(base)) return s;
  }
  return null;
}
