// Address checks for fetching files that callers point us at. Pure, so they can be tested.

// True for addresses that must never be fetched on a caller's say-so: loopback, private ranges,
// link-local (which includes cloud metadata at 169.254.169.254), carrier NAT, multicast and reserved.
export function isPrivateAddress(ip: string): boolean {
  const v4 = ip.match(/^(?:::ffff:)?(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/i);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 0 || a === 10 || a === 127 || a >= 224) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && (b === 168 || b === 0)) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    return false;
  }
  const v6 = ip.toLowerCase();
  if (!v6.includes(":")) return true; // not an address we understand
  if (v6 === "::" || v6 === "::1") return true;
  if (/^f[cd]/.test(v6)) return true; // unique local fc00::/7
  if (/^fe[89ab]/.test(v6)) return true; // link-local fe80::/10
  if (/^ff/.test(v6)) return true; // multicast
  if (v6.startsWith("64:ff9b:") || v6.startsWith("2001:db8:")) return true;
  if (v6.startsWith("::ffff:")) return true; // mapped v4 in hex form
  return false;
}

// A public http(s) URL on a normal port, or null.
export function publicUrl(raw: string): URL | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (u.username || u.password) return null;
    if (u.port && !["80", "443", "8080", "8443"].includes(u.port)) return null;
    const host = u.hostname.replace(/^\[|\]$/g, "");
    if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return null;
    // A bare IP address is allowed only if it's public.
    if (/^[\d.]+$/.test(host) || host.includes(":")) {
      if (isPrivateAddress(host)) return null;
    } else if (!host.includes(".")) {
      return null;
    }
    u.hash = "";
    return u;
  } catch {
    return null;
  }
}
