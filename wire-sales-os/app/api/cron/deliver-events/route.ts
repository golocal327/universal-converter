import { NextResponse, type NextRequest } from "next/server";
import { deliverPendingEvents } from "@/lib/services/events";

/** Retries undelivered automation events. Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await deliverPendingEvents(null, 200);
  return NextResponse.json(result);
}
