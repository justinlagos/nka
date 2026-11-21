import "server-only";
import { lookup } from "node:dns/promises";
import { isPrivateAddress, publicUrl } from "./net";
import type { Fetched } from "./types";

// Fetching files that someone else points us at: a caller's logo, an asset to check, a client's
// website. Used by the API and by the brand scan.

export const UA = "NkaStudioBot/1.0 (+https://nka.studio/developers)";

export async function resolvesPublic(host: string): Promise<boolean> {
  const bare = host.replace(/^\[|\]$/g, "");
  if (/^[\d.]+$/.test(bare) || bare.includes(":")) return !isPrivateAddress(bare);
  try {
    const found = await lookup(bare, { all: true });
    return found.length > 0 && found.every((a) => !isPrivateAddress(a.address));
  } catch {
    return false;
  }
}

// Redirects are followed by hand so every hop is checked, and the body is read with a hard size cap.
export async function fetchPublic(raw: string, accept: string, maxBytes: number): Promise<Fetched | null> {
  let url = publicUrl(raw);
  for (let hop = 0; url && hop < 4; hop++) {
    if (!(await resolvesPublic(url.hostname))) return null;
    try {
      const res = await fetch(url, { redirect: "manual", headers: { "user-agent": UA, accept }, signal: AbortSignal.timeout(10_000) });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        url = loc ? publicUrl(new URL(loc, url).toString()) : null;
        continue;
      }
      if (!res.ok || !res.body) return null;
      if (Number(res.headers.get("content-length") ?? 0) > maxBytes) return null;
      const chunks: Uint8Array[] = [];
      let size = 0;
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) {
          await reader.cancel();
          return null;
        }
        chunks.push(value);
      }
      const body = new Uint8Array(size);
      let at = 0;
      for (const c of chunks) {
        body.set(c, at);
        at += c.byteLength;
      }
      return { body, type: res.headers.get("content-type") ?? "", url: url.toString() };
    } catch {
      return null;
    }
  }
  return null;
}
