// The brand kit every endpoint takes, and the colour maths built on it. No network, no model.
import type { Schema } from "./schema.ts";

export type BrandColour = { hex: string; name: string; role: string };
export type BrandKit = {
  name: string;
  colours: BrandColour[];
  fonts: { heading: string; body: string };
  logo_url: string;
  about: string;
  voice: string;
  rules: string;
  website: string;
};

export const brandSchema: Schema = {
  type: "object",
  description: "The brand to work in. Give colours and fonts, or a website to read them from.",
  properties: {
    name: { type: "string", description: "Brand or company name.", minLength: 1, maxLength: 120 },
    colours: {
      type: "array",
      description: "Brand colours, most important first. The first is treated as the primary colour.",
      maxItems: 12,
      items: {
        type: "object",
        properties: {
          hex: { type: "string", format: "hex-colour", description: "Hex value, e.g. #a3361e." },
          name: { type: "string", maxLength: 60, description: "What the brand calls it, e.g. Laterite." },
          role: { type: "string", enum: ["primary", "secondary", "accent", "neutral"], description: "How it is used." },
        },
        required: ["hex"],
      },
    },
    fonts: {
      type: "object",
      description: "Typeface family names as licensed by the brand.",
      properties: {
        heading: { type: "string", maxLength: 80 },
        body: { type: "string", maxLength: 80 },
      },
    },
    logo_url: { type: "string", format: "uri", maxLength: 500, description: "Public https link to the logo (PNG, JPEG or SVG)." },
    about: { type: "string", maxLength: 2000, description: "What the organisation does, in its own words." },
    voice: { type: "string", maxLength: 2000, description: "How the brand writes: tone, words it uses or avoids." },
    rules: { type: "string", maxLength: 2000, description: "Any other brand rules to respect." },
    website: { type: "string", format: "uri", maxLength: 300, description: "If set, missing colours, fonts, logo and description are read from this site." },
  },
};

export function normaliseHex(raw: string): string | null {
  let h = String(raw ?? "").trim().toLowerCase();
  if (!h.startsWith("#")) h = `#${h}`;
  if (/^#[0-9a-f]{3}$/.test(h)) h = "#" + h.slice(1).split("").map((c) => c + c).join("");
  return /^#[0-9a-f]{6}$/.test(h) ? h : null;
}

export function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

export function toHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")).join("");
}

// WCAG 2 relative luminance and contrast ratio.
export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

// Mix towards white (amount > 0) or black (amount < 0). amount is -1..1.
export function shade(hex: string, amount: number): string {
  const target = amount >= 0 ? 255 : 0;
  const t = Math.abs(amount);
  const [r, g, b] = rgb(hex).map((v) => v + (target - v) * t);
  return toHex(r, g, b);
}

export function saturation(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  return max === min ? 0 : l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
}

// Straight-line distance in RGB. Good enough to tell "this is the brand red" from "this is a different red".
export function distance(a: string, b: string): number {
  const [x, y] = [rgb(a), rgb(b)];
  return Math.sqrt(x.reduce((t, v, i) => t + (v - y[i]) ** 2, 0));
}

// Black or white text, whichever reads better on this colour.
export function textOn(hex: string): string {
  return contrast(hex, "#ffffff") >= contrast(hex, "#111111") ? "#ffffff" : "#111111";
}

// Naive conversion with no colour profile. Printers should match to a proof, and the output says so.
export function cmyk(hex: string): [number, number, number, number] {
  const [r, g, b] = rgb(hex).map((v) => v / 255);
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) return [0, 0, 0, 100];
  return [(1 - r - k) / (1 - k), (1 - g - k) / (1 - k), (1 - b - k) / (1 - k), k].map((v) => Math.round(v * 100)) as [number, number, number, number];
}

const DEFAULT_COLOURS: BrandColour[] = [
  { hex: "#1a1b3a", name: "Ink", role: "primary" },
  { hex: "#e0a526", name: "Ochre", role: "accent" },
];

export function normaliseBrand(input: unknown): BrandKit {
  const src = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const seen = new Set<string>();
  const colours: BrandColour[] = [];
  for (const c of Array.isArray(src.colours) ? src.colours : []) {
    const item = (typeof c === "string" ? { hex: c } : c ?? {}) as Record<string, unknown>;
    const hex = normaliseHex(String(item.hex ?? ""));
    if (!hex || seen.has(hex)) continue;
    seen.add(hex);
    colours.push({ hex, name: str(item.name, 60), role: str(item.role, 20) });
  }
  const fonts = (src.fonts && typeof src.fonts === "object" ? src.fonts : {}) as Record<string, unknown>;
  const heading = cleanFont(str(fonts.heading, 80));
  const body = cleanFont(str(fonts.body, 80));
  return {
    name: str(src.name, 120),
    colours,
    fonts: { heading: heading || body, body: body || heading },
    logo_url: str(src.logo_url, 500),
    about: str(src.about, 2000),
    voice: str(src.voice, 2000),
    rules: str(src.rules, 2000),
    website: str(src.website, 300),
  };
}

// Font names end up inside CSS and SVG attributes. Keep letters, digits, spaces and hyphens only.
export function cleanFont(name: string): string {
  return name.replace(/[^\p{L}\p{N} \-]/gu, "").replace(/\s+/g, " ").trim();
}

export type Roles = { primary: string; secondary: string; accent: string; ink: string; paper: string; onPrimary: string; onAccent: string };

// Which colour does which job. Explicit roles win; otherwise by order. Ink and paper are derived
// so text is always readable, whatever the palette.
export function roles(brand: BrandKit): Roles {
  const list = brand.colours.length ? brand.colours : DEFAULT_COLOURS;
  const byRole = (r: string) => list.find((c) => c.role === r)?.hex;
  const rest = list.filter((c) => c.role !== "neutral").map((c) => c.hex);
  const primary = byRole("primary") ?? rest[0] ?? list[0].hex;
  const others = rest.filter((h) => h !== primary);
  const secondary = byRole("secondary") ?? others[0] ?? shade(primary, luminance(primary) > 0.4 ? -0.45 : 0.55);
  const accent = byRole("accent") ?? others.find((h) => h !== secondary) ?? secondary;
  const darkest = [...list].sort((a, b) => luminance(a.hex) - luminance(b.hex))[0].hex;
  // Running text is set in the brand's own near-black if it has one. A mid-dark brand colour
  // (a navy, a forest green) stays a brand colour and text gets a neutral near-black.
  const ink = contrast(darkest, "#ffffff") >= 12 ? darkest : "#14151a";
  return { primary, secondary, accent, ink, paper: "#ffffff", onPrimary: textOn(primary), onAccent: textOn(accent) };
}

const FALLBACK_SANS = `"Helvetica Neue", Helvetica, Arial, sans-serif`;

export function fontStack(name: string): string {
  const n = cleanFont(name);
  return n ? `"${n}", ${FALLBACK_SANS}` : FALLBACK_SANS;
}

// A Google Fonts stylesheet link for the brand's families. If a family isn't on Google Fonts the
// request for it simply returns nothing and the fallback stack is used.
export function fontsHref(brand: BrandKit): string {
  const names = [...new Set([brand.fonts.heading, brand.fonts.body].map(cleanFont).filter(Boolean))];
  if (!names.length) return "";
  return `https://fonts.googleapis.com/css2?${names.map((n) => `family=${encodeURIComponent(n).replace(/%20/g, "+")}:wght@400;600;700`).join("&")}&display=swap`;
}

export function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Only http(s) links are ever written into a file we hand back.
export function safeLink(url: string): string {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : "";
  } catch {
    return "";
  }
}

export type OutFile = { name: string; mime: string; data: string | Uint8Array };

export function slug(s: string, fallback = "file"): string {
  const out = s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return out || fallback;
}

// ---------- Hue, saturation, lightness ----------

export function toHsl(hex: string): [number, number, number] {
  const [r, g, b] = rgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

export function fromHsl(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360;
  const sat = Math.max(0, Math.min(1, s));
  const lig = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lig - c / 2;
  const [r, g, b] = hue < 60 ? [c, x, 0] : hue < 120 ? [x, c, 0] : hue < 180 ? [0, c, x] : hue < 240 ? [0, x, c] : hue < 300 ? [x, 0, c] : [c, 0, x];
  return toHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

// The same hue, darkened (or lightened) one step at a time until it reaches the contrast asked
// for against `against`. Returns the colour unchanged if it already passes.
export function withContrast(hex: string, against: string, min: number): string {
  if (contrast(hex, against) >= min) return hex;
  const [h, s, l] = toHsl(hex);
  const darker = luminance(against) > 0.5;
  for (let step = 1; step <= 100; step++) {
    const next = fromHsl(h, s, darker ? l - step * 0.01 : l + step * 0.01);
    if (contrast(next, against) >= min) return next;
  }
  return darker ? "#000000" : "#ffffff";
}
