import type { NormalizedLead } from "./validate";
import type { ScoreResult } from "@/lib/scoring/engine";

/** One-line "biggest opportunity" + "recommended action" for a discovered business. */
export function prospectInsights(lead: Pick<NormalizedLead, "website" | "phone" | "email" | "google_reviews_count" | "google_rating">, score: ScoreResult) {
  const reviews = lead.google_reviews_count ?? 0;
  let biggest: string;
  if (!lead.website) biggest = reviews >= 100 ? `No website despite ${reviews} reviews` : "No website";
  else if ((lead.google_rating ?? 5) < 4 && reviews >= 10) biggest = `Low rating (${lead.google_rating}★)`;
  else if (reviews < 20) biggest = "Few Google reviews";
  else biggest = "Website needs an audit";

  const channel = lead.phone ? "Call" : lead.email ? "Email" : "Find a contact for";
  const action =
    score.priority === "hot"
      ? `${channel} this week — pitch ${lead.website ? "a redesign" : "a premium website"}`
      : score.priority === "warm"
        ? lead.website ? "Add to CRM and audit the website" : `${channel} with a short WhatsApp/email`
        : "Low priority — add to a nurture campaign";
  return { biggestOpportunity: biggest, recommendedAction: action };
}
