// API keys and webhook signatures. Keys are random, shown once, and stored only as a hash.
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const KEY_PREFIX = "nka_live_";

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function generateKey(): { key: string; prefix: string; hash: string; webhookSecret: string } {
  const key = KEY_PREFIX + randomBytes(32).toString("base64url");
  return { key, prefix: key.slice(0, KEY_PREFIX.length + 6), hash: hashKey(key), webhookSecret: "whsec_" + randomBytes(32).toString("base64url") };
}

// Reads "Authorization: Bearer nka_live_..." (or X-API-Key). Returns the key's hash, or null.
export function keyHashFrom(authorization: string | null, xApiKey: string | null = null): string | null {
  const raw = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? xApiKey?.trim() ?? "";
  if (!raw.startsWith(KEY_PREFIX) || raw.length < KEY_PREFIX.length + 40 || raw.length > 120) return null;
  return hashKey(raw);
}

// Webhook signature, sent as "Nka-Signature: t=<unix seconds>,v1=<hex>". The signed text is
// "<t>.<body>", so a captured request can't be replayed later with a new timestamp.
export function signWebhook(secret: string, body: string, t: number): string {
  return `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;
}

export function verifyWebhook(secret: string, body: string, header: string, nowSeconds: number, toleranceSeconds = 300): boolean {
  const t = Number(header.match(/(?:^|,)t=(\d+)/)?.[1]);
  const v1 = header.match(/(?:^|,)v1=([0-9a-f]{64})/)?.[1];
  if (!t || !v1 || Math.abs(nowSeconds - t) > toleranceSeconds) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(v1, "hex"));
}
