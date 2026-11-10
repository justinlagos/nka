import "server-only";
import { headers } from "next/headers";
import { env } from "@/lib/env";

// The site's own address, for links in emails and Stripe redirects.
export async function siteOrigin(): Promise<string> {
  if (env.siteUrl) return env.siteUrl;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// Only allow redirects to our own pages. /go sends each person to their own area.
export function safeNext(next: string | null | undefined, fallback = "/go"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
