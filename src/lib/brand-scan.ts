// Reads a client's website and works out their brand: logo, colours, fonts and how they
// describe themselves. The parsing helpers are pure so they can be tested without a network.

export type SiteFacts = {
  url: string;
  title: string;
  description: string;
  siteName: string;
  themeColor: string;
  headings: string[];
  text: string;
  logoCandidates: string[];
  css: string;
  fontLinks: string[];
};

export type BrandScan = {
  website: string;
  company: string;
  about: string;
  audiences: string;
  voice: string;
  palette: string[];
  fonts: string[];
  logoUrl: string | null;
};

export function normaliseUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".")) return null;
    // Never fetch private or local addresses.
    if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[)/i.test(u.hostname) || /^172\.(1[6-9]|2\d|3[01])\./.test(u.hostname)) return null;
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

const attr = (tag: string, name: string) => {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? (m[2] ?? m[3] ?? m[4] ?? "").trim() : "";
};

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

export function parseHtml(html: string, url: string): SiteFacts {
  const abs = (href: string) => {
    try {
      return new URL(decode(href), url).toString();
    } catch {
      return "";
    }
  };
  const metas = html.match(/<meta\b[^>]*>/gi) ?? [];
  const meta = (key: string) => {
    for (const m of metas) {
      const k = (attr(m, "name") || attr(m, "property")).toLowerCase();
      if (k === key) return decode(attr(m, "content"));
    }
    return "";
  };
  const title = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s+/g, " ").trim());

  const logos: string[] = [];
  for (const img of html.match(/<img\b[^>]*>/gi) ?? []) {
    const hint = `${attr(img, "src")} ${attr(img, "alt")} ${attr(img, "class")} ${attr(img, "id")}`.toLowerCase();
    if (/logo|brand/.test(hint) && attr(img, "src")) logos.push(abs(attr(img, "src")));
  }
  const links = html.match(/<link\b[^>]*>/gi) ?? [];
  const icon = (rel: RegExp) => links.filter((l) => rel.test(attr(l, "rel"))).map((l) => abs(attr(l, "href")));
  logos.push(...icon(/apple-touch-icon/i), ...icon(/^icon$|shortcut icon/i));
  const og = meta("og:image");
  if (og) logos.push(abs(og));

  const css = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) ?? []).join("\n") +
    "\n" + (html.match(/style\s*=\s*"[^"]*"/gi) ?? []).join("\n");
  const fontLinks = links.map((l) => attr(l, "href")).filter((h) => /fonts\.googleapis|use\.typekit|fonts\.bunny/i.test(h));

  const headings = (html.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi) ?? [])
    .map((h) => decode(h.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim())
    .filter((h) => h.length > 2)
    .slice(0, 12);
  const text = decode(
    html
      .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 6000);

  return {
    url,
    title,
    description: meta("description") || meta("og:description"),
    siteName: meta("og:site_name"),
    themeColor: meta("theme-color"),
    headings,
    text,
    logoCandidates: [...new Set(logos.filter(Boolean))],
    css,
    fontLinks,
  };
}

function hexOf(raw: string): string | null {
  let h = raw.toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(h)) h = "#" + h.slice(1).split("").map((c) => c + c).join("");
  if (/^#[0-9a-f]{8}$/.test(h)) h = h.slice(0, 7);
  return /^#[0-9a-f]{6}$/.test(h) ? h : null;
}

function rgbToHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")).join("");
}

// Saturation and lightness, to drop greys, near-white and near-black.
function sl(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const s = max === min ? 0 : l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
  return { s, l };
}

function distance(a: string, b: string) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return Math.sqrt(x.reduce((t, v, i) => t + (v - y[i]) ** 2, 0));
}

// Most-used brand colours: frequent, not grey, not near-white or near-black, not near-duplicates.
export function pickPalette(css: string, themeColor = "", max = 5): string[] {
  const counts = new Map<string, number>();
  const add = (hex: string | null, weight = 1) => {
    if (!hex) return;
    counts.set(hex, (counts.get(hex) ?? 0) + weight);
  };
  for (const m of css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []) add(hexOf(m));
  for (const m of css.matchAll(/rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/gi)) add(rgbToHex(+m[1], +m[2], +m[3]));
  add(hexOf(themeColor), 25);
  const ranked = [...counts.entries()]
    .filter(([hex]) => {
      const { s, l } = sl(hex);
      return s > 0.18 && l > 0.08 && l < 0.92;
    })
    .sort((a, b) => b[1] - a[1])
    .map(([hex]) => hex);
  const out: string[] = [];
  for (const hex of ranked) {
    if (out.every((o) => distance(o, hex) > 48)) out.push(hex);
    if (out.length >= max) break;
  }
  return out;
}

const GENERIC = new Set([
  "sans-serif", "serif", "monospace", "system-ui", "inherit", "initial", "cursive", "fantasy", "arial", "helvetica",
  "helvetica neue", "-apple-system", "blinkmacsystemfont", "segoe ui", "roboto", "ui-sans-serif", "ui-serif",
  "ui-monospace", "apple color emoji", "segoe ui emoji", "segoe ui symbol", "noto color emoji", "times new roman",
  "var", "georgia", "verdana", "tahoma", "courier new", "menlo", "monaco", "consolas", "unset", "revert",
]);

export function pickFonts(css: string, fontLinks: string[] = [], max = 3): string[] {
  const counts = new Map<string, number>();
  for (const link of fontLinks) {
    for (const m of link.matchAll(/family=([^&:]+)/g)) {
      const name = decodeURIComponent(m[1].replace(/\+/g, " ")).trim();
      if (name) counts.set(name, (counts.get(name) ?? 0) + 20);
    }
  }
  for (const m of css.matchAll(/font-family\s*:\s*([^;}"]+)/gi)) {
    const first = m[1].split(",")[0].replace(/["']/g, "").trim();
    if (!first || first.startsWith("var(") || GENERIC.has(first.toLowerCase())) continue;
    counts.set(first, (counts.get(first) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([f]) => f).slice(0, max);
}

// Best guess at a logo: an <img> marked as the logo, then the touch icon, then the favicon, then the share image.
export function pickLogo(candidates: string[]): string | null {
  const ok = candidates.filter((c) => /^https?:\/\//.test(c) && !/\.ico(\?|$)/i.test(c));
  return ok[0] ?? candidates.find((c) => /^https?:\/\//.test(c)) ?? null;
}
