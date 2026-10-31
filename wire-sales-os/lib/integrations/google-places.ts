import "server-only";
import type { RawLead } from "@/lib/lead-pipeline/validate";

/**
 * Google Places API (New) — Text Search adapter used by "Find Leads".
 * Docs: https://developers.google.com/maps/documentation/places/web-service/text-search
 * Max 20 results per page and 60 results per query (Google's limit).
 */
const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.addressComponents",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.googleMapsUri",
  "places.types",
  "places.primaryType",
  "places.businessStatus",
  "nextPageToken",
].join(",");

type AddressComponent = { longText?: string; shortText?: string; types?: string[] };
export type PlaceResult = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  addressComponents?: AddressComponent[];
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  types?: string[];
  primaryType?: string;
  businessStatus?: string;
};

export class PlacesNotConfiguredError extends Error {
  constructor() {
    super("GOOGLE_PLACES_API_KEY is not configured");
  }
}

export function isPlacesConfigured() {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY);
}

function component(place: PlaceResult, type: string) {
  return place.addressComponents?.find((c) => c.types?.includes(type));
}

/** Map a Places result into the shared RawLead shape (Lead Source → Normalizer). */
export function placeToRawLead(place: PlaceResult, sector: string | null): RawLead {
  return {
    company_name: place.displayName?.text,
    sector,
    subsector: place.primaryType?.replace(/_/g, " "),
    address: place.formattedAddress,
    city: component(place, "locality")?.longText ?? component(place, "postal_town")?.longText,
    province: component(place, "administrative_area_level_2")?.longText,
    country: component(place, "country")?.shortText,
    postal_code: component(place, "postal_code")?.longText,
    phone: place.internationalPhoneNumber ?? place.nationalPhoneNumber,
    website: place.websiteUri,
    rating: place.rating,
    reviews: place.userRatingCount,
    google_maps_url: place.googleMapsUri,
    google_place_id: place.id,
    source_ref: place.id,
  };
}

export async function searchPlaces(query: string, options: { maxResults?: number; languageCode?: string; regionCode?: string } = {}) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new PlacesNotConfiguredError();
  const max = Math.min(options.maxResults ?? 60, 60);
  const results: PlaceResult[] = [];
  let pageToken: string | undefined;
  do {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELD_MASK },
      body: JSON.stringify({
        textQuery: query,
        pageSize: Math.min(20, max - results.length),
        languageCode: options.languageCode ?? "es",
        regionCode: options.regionCode ?? "ES",
        ...(pageToken ? { pageToken } : {}),
      }),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Google Places error ${res.status}: ${text.slice(0, 300)}`);
    }
    const json = (await res.json()) as { places?: PlaceResult[]; nextPageToken?: string };
    results.push(...(json.places ?? []).filter((p) => p.businessStatus !== "CLOSED_PERMANENTLY"));
    pageToken = json.nextPageToken;
  } while (pageToken && results.length < max);
  return results.slice(0, max);
}
