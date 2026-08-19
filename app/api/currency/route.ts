import { NextResponse } from "next/server";
import { getCurrencyRates, SUPPORTED_CURRENCIES, type CurrencyCode } from "@/lib/tools/currency";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const baseParam = searchParams.get("base")?.toUpperCase() ?? "EUR";
  const base = (SUPPORTED_CURRENCIES as readonly string[]).includes(baseParam) ? (baseParam as CurrencyCode) : "EUR";

  const rates = await getCurrencyRates(base);
  return NextResponse.json(rates);
}
