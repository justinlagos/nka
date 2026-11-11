import "server-only";
import { headers } from "next/headers";
import { currencyForCountry, isCurrency, type Currency } from "@/lib/plans";

// The currency to show a visitor: what they picked, else their country (Vercel's geo header), else dollars.
export async function visitorCurrency(picked?: string | null): Promise<Currency> {
  if (isCurrency(picked)) return picked;
  const h = await headers();
  return currencyForCountry(h.get("x-vercel-ip-country"));
}
