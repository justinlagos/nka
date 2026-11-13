import { createHmac, timingSafeEqual } from "node:crypto";

// Small, pure helpers for the Custard AI connection (Abigail). No Next.js imports, so tests can load them.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function sameText(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function mac(secret: string, text: string): string {
  return createHmac("sha256", secret).update(text).digest("base64url");
}

// The id Abigail knows a client by: "nka1.<user id>.<org id>.<signature>". Only Nka's server can make
// one, so a browser that sets its own user id gets nothing from a lookup. It stays the same for a
// person in an organisation, so Custard keeps recognising them from one chat to the next.
export function signIdentity(userId: string, orgId: string, secret: string): string {
  if (!secret) throw new Error("CUSTARD_IDENTITY_SECRET is not set.");
  const body = `nka1.${userId}.${orgId}`;
  return `${body}.${mac(secret, body)}`;
}

export function readIdentity(token: unknown, secret: string): { userId: string; orgId: string } | null {
  if (!secret || typeof token !== "string" || token.length > 200) return null;
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "nka1") return null;
  const [, userId, orgId, sig] = parts;
  if (!UUID.test(userId) || !UUID.test(orgId)) return null;
  return sameText(sig, mac(secret, `nka1.${userId}.${orgId}`)) ? { userId, orgId } : null;
}

// Custard sends the lookup secret as "Authorization: Bearer <secret>" and as X-Custard-Secret.
export function bearerMatches(authorization: string | null, custardSecret: string | null, secret: string): boolean {
  if (!secret) return false;
  const fromAuth = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? "";
  return (fromAuth !== "" && sameText(fromAuth, secret)) || (Boolean(custardSecret) && sameText(custardSecret!.trim(), secret));
}

// X-Custard-Signature: "t=<unix seconds>,v1=<hex HMAC-SHA256 of `${t}.${raw body}`>", at most 5 minutes old.
export function custardSignatureValid(rawBody: string, header: string | null, secret: string, nowSeconds = Date.now() / 1000): boolean {
  if (!secret || !header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const i = p.indexOf("=");
      return i < 0 ? [p.trim(), ""] : [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    }),
  );
  const t = Number(parts.t);
  if (!parts.t || !parts.v1 || !Number.isFinite(t) || Math.abs(nowSeconds - t) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${parts.t}.${rawBody}`).digest("hex");
  return sameText(expected, String(parts.v1).toLowerCase());
}

// "1042", "#1042", "NKA-1042", "project 1042" -> 1042. Anything else -> null.
export function projectNumber(ref: unknown): number | null {
  const s = typeof ref === "number" ? String(ref) : typeof ref === "string" ? ref.trim() : "";
  const m = s.match(/^(?:nka[-\s]?|project\s*|brief\s*)?#?\s*(\d{1,9})$/i);
  return m ? Number(m[1]) : null;
}

// UK calendar periods for the owner's questions ("how much have we made this week?").
export type Period = "today" | "yesterday" | "this_week" | "last_7_days" | "this_month" | "last_30_days";
export const PERIODS: Period[] = ["today", "yesterday", "this_week", "last_7_days", "this_month", "last_30_days"];

function londonParts(d: Date) {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    timeZoneName: "shortOffset",
  }).formatToParts(d);
  const get = (type: string) => f.find((p) => p.type === type)?.value ?? "";
  const offset = get("timeZoneName").match(/GMT([+-]\d+)?/)?.[1];
  return {
    y: Number(get("year")),
    m: Number(get("month")),
    d: Number(get("day")),
    weekday: get("weekday"),
    offsetHours: offset ? Number(offset) : 0,
  };
}

// Midnight in London on the London calendar day `daysBack` days before `now`'s.
function londonMidnight(now: Date, daysBack = 0, toFirstOfMonth = false): Date {
  const p = londonParts(now);
  const utcMidnight = Date.UTC(p.y, p.m - 1, toFirstOfMonth ? 1 : p.d - daysBack);
  const offset = londonParts(new Date(utcMidnight)).offsetHours;
  return new Date(utcMidnight - offset * 3_600_000);
}

export function periodRange(period: unknown, now = new Date()): { from: Date; to: Date } | null {
  const day = 86_400_000;
  switch (period) {
    case "today":
      return { from: londonMidnight(now), to: now };
    case "yesterday":
      return { from: londonMidnight(now, 1), to: londonMidnight(now) };
    case "this_week": {
      const back = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(londonParts(now).weekday);
      return { from: londonMidnight(now, Math.max(0, back)), to: now };
    }
    case "last_7_days":
      return { from: new Date(now.getTime() - 7 * day), to: now };
    case "this_month":
      return { from: londonMidnight(now, 0, true), to: now };
    case "last_30_days":
      return { from: new Date(now.getTime() - 30 * day), to: now };
    default:
      return null;
  }
}
