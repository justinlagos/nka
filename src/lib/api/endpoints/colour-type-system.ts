// Colour and type system: one seed colour and a mood in, a full working system out. Supporting
// colours by colour-wheel rule, a 50 to 900 scale for each, tinted neutrals, status colours that
// pass contrast, a typeface pairing and a type scale. All arithmetic; no model.
import { cleanFont, contrast, fromHsl, normaliseBrand, normaliseHex, round2, slug, textOn, toHsl, withContrast, type OutFile } from "../brand.ts";
import { ApiError, type Deps, type Endpoint, type EndpointResult } from "../types.ts";
import { guidelinesHtml, pairings, typeScale } from "./brand-guidelines.ts";

const SCHEMES = ["analogous", "complementary", "split-complementary", "triadic", "monochrome"] as const;
type Scheme = (typeof SCHEMES)[number];
const MOODS = ["modern", "classic", "friendly", "technical", "editorial", "bold", "elegant"] as const;
type Mood = (typeof MOODS)[number];

// Pairings of typefaces published under open licences on Google Fonts. Heading first, then body.
export const PAIRINGS: Record<Mood, [string, string][]> = {
  modern: [["Sora", "Inter"], ["Outfit", "DM Sans"]],
  classic: [["Playfair Display", "Source Sans 3"], ["Libre Baskerville", "Libre Franklin"]],
  friendly: [["Poppins", "Nunito"], ["Plus Jakarta Sans", "Work Sans"]],
  technical: [["Space Grotesk", "IBM Plex Sans"], ["IBM Plex Sans", "IBM Plex Sans"]],
  editorial: [["Fraunces", "Inter"], ["DM Serif Display", "DM Sans"]],
  bold: [["Archivo", "Inter"], ["Montserrat", "Source Sans 3"]],
  elegant: [["Playfair Display", "Lora"], ["Fraunces", "Manrope"]],
};

type Input = { name?: string; seed: string; scheme?: Scheme; mood?: Mood; secondary?: string; accent?: string; fonts?: { heading?: string; body?: string } };

const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
const LIGHTNESS = [0.96, 0.91, 0.82, 0.71, 0.6, 0.5, 0.41, 0.33, 0.25, 0.17];

// Ten steps of one hue, light to dark. Saturation eases off at both ends so the palest and
// darkest steps don't look neon or muddy.
export function scale(hex: string): Record<string, string> {
  const [h, s] = toHsl(hex);
  return Object.fromEntries(STEPS.map((step, i) => [String(step), fromHsl(h, s * (i === 0 ? 0.55 : i === 1 ? 0.7 : i >= 8 ? 0.85 : 1), LIGHTNESS[i])]));
}

export function harmony(seed: string, scheme: Scheme): { secondary: string; accent: string } {
  const [h, s, l] = toHsl(seed);
  // Supporting colours are held to a middle band of saturation and lightness. A hue turned
  // round the wheel at full strength (a pure green beside a red) comes out neon.
  const mid = Math.min(0.5, Math.max(0.36, l));
  const turn = (deg: number, sat = s, lig = mid) => fromHsl(h + deg, Math.min(0.6, Math.max(0.35, sat)), lig);
  switch (scheme) {
    case "complementary":
      return { secondary: fromHsl(h, s * 0.6, Math.min(0.3, l)), accent: turn(180) };
    case "split-complementary":
      return { secondary: turn(150), accent: turn(210) };
    case "triadic":
      return { secondary: turn(120), accent: turn(240) };
    case "monochrome":
      return { secondary: fromHsl(h, s * 0.7, Math.max(0.2, l - 0.2)), accent: fromHsl(h, Math.min(1, s * 1.1), Math.min(0.7, l + 0.22)) };
    default:
      return { secondary: turn(-30), accent: turn(40, s, Math.min(0.56, mid + 0.06)) };
  }
}

// Greys carrying a little of the brand hue, so they sit with the palette instead of beside it.
export function neutrals(seed: string): Record<string, string> {
  const [h] = toHsl(seed);
  const l = [0.98, 0.95, 0.9, 0.82, 0.68, 0.52, 0.4, 0.29, 0.19, 0.11];
  return Object.fromEntries(STEPS.map((step, i) => [String(step), fromHsl(h, 0.07, l[i])]));
}

// Fixed hues people already read as success, warning, danger and information, each darkened
// until white text on it passes WCAG AA.
export function status(): Record<string, string> {
  return {
    success: withContrast(fromHsl(145, 0.6, 0.38), "#ffffff", 4.5),
    warning: withContrast(fromHsl(35, 0.9, 0.45), "#ffffff", 4.5),
    danger: withContrast(fromHsl(4, 0.72, 0.48), "#ffffff", 4.5),
    info: withContrast(fromHsl(212, 0.75, 0.46), "#ffffff", 4.5),
  };
}

export function buildSystem(input: Input) {
  const seed = normaliseHex(input.seed);
  if (!seed) throw new ApiError(422, "invalid_request", "seed must be a hex colour.", [{ path: "seed", message: "must be a hex colour" }]);
  const scheme = input.scheme ?? "analogous";
  const mood = input.mood ?? "modern";
  const auto = harmony(seed, scheme);
  const secondary = normaliseHex(input.secondary ?? "") ?? auto.secondary;
  const accent = normaliseHex(input.accent ?? "") ?? auto.accent;
  const grey = neutrals(seed);
  const [pairHead, pairBody] = PAIRINGS[mood][0];
  // Caller's typefaces are cleaned: the names are written into CSS.
  const own = { heading: cleanFont(input.fonts?.heading ?? ""), body: cleanFont(input.fonts?.body ?? "") };
  const fonts = { heading: own.heading || pairHead, body: own.body || own.heading || pairBody };
  const colours = { primary: seed, secondary, accent };
  return {
    scheme,
    mood,
    colours,
    // The nearest shade of each colour that is safe for body text on white. Same as the colour when it already passes.
    text_safe: Object.fromEntries(Object.entries(colours).map(([k, v]) => [k, withContrast(v, "#ffffff", 4.5)])),
    on: Object.fromEntries(Object.entries(colours).map(([k, v]) => [k, textOn(v)])),
    scales: { primary: scale(seed), secondary: scale(secondary), accent: scale(accent), neutral: grey },
    status: status(),
    fonts,
    alternative_fonts: { heading: PAIRINGS[mood][1][0], body: PAIRINGS[mood][1][1] },
    type_scale: typeScale(),
  };
}

function css(name: string, sys: ReturnType<typeof buildSystem>): string {
  const lines: string[] = [];
  for (const [k, v] of Object.entries(sys.colours)) lines.push(`  --color-${k}: ${v};`, `  --color-on-${k}: ${sys.on[k]};`, `  --color-${k}-text: ${sys.text_safe[k]};`);
  for (const [group, steps] of Object.entries(sys.scales)) for (const [step, v] of Object.entries(steps)) lines.push(`  --${group}-${step}: ${v};`);
  for (const [k, v] of Object.entries(sys.status)) lines.push(`  --color-${k}: ${v};`);
  lines.push(`  --font-heading: "${sys.fonts.heading}", system-ui, sans-serif;`, `  --font-body: "${sys.fonts.body}", system-ui, sans-serif;`);
  for (const s of sys.type_scale) lines.push(`  --size-${s.step}: ${s.px}px;`);
  return `/* ${name.replace(/\*\//g, "")} colour and type system */\n:root {\n${lines.join("\n")}\n}\n`;
}

async function run(input: Input, _deps: Deps): Promise<EndpointResult> {
  const sys = buildSystem(input);
  const name = input.name?.trim() || "Brand";
  // Reuse the guideline layout for the printable sheet, so both documents look like one family.
  const brand = normaliseBrand({
    name,
    colours: [
      { hex: sys.colours.primary, name: "Primary", role: "primary" },
      { hex: sys.colours.secondary, name: "Secondary", role: "secondary" },
      { hex: sys.colours.accent, name: "Accent", role: "accent" },
      { hex: sys.scales.neutral["900"], name: "Ink", role: "neutral" },
      { hex: sys.scales.neutral["100"], name: "Mist", role: "neutral" },
    ],
    fonts: sys.fonts,
  });
  const base = slug(name, "brand");
  const files: OutFile[] = [
    { name: `${base}-colour-type-system.html`, mime: "text/html; charset=utf-8", data: guidelinesHtml(brand, null, [], ["colour", "typography"]) },
    { name: `${base}-system-tokens.json`, mime: "application/json", data: JSON.stringify({ brand: name, ...sys }, null, 2) + "\n" },
    { name: `${base}-system-tokens.css`, mime: "text/css; charset=utf-8", data: css(name, sys) },
  ];
  const usable = pairings(brand).filter((p) => p.aa_body);
  const weak = Object.entries(sys.colours).filter(([, v]) => contrast(v, "#ffffff") < 4.5 && contrast(v, "#111111") < 4.5);
  return {
    result: {
      brand: name,
      ...sys,
      accessible_pairs: usable.slice(0, 24).map((p) => ({ text: p.text, background: p.background, ratio: round2(p.ratio) })),
      notes: [
        "Supporting colours come from colour-wheel rules, not from taste. Treat them as a starting point and adjust by eye.",
        "Typefaces are suggestions from Google Fonts under open licences. Check the licence before commercial use.",
        ...(weak.length ? [`${weak.map(([k]) => k).join(", ")} can't carry body text in black or white. Use the text-safe shade for words.`] : []),
      ],
    },
    files,
  };
}

export const colourTypeSystem: Endpoint = {
  id: "colour_type_system",
  path: "colour-type-systems",
  group: "Brand and identity",
  title: "Colour and type system",
  summary: "Builds a full colour and type system from one seed colour: supporting colours, 50 to 900 scales, neutrals, status colours, a typeface pairing and a type scale, with contrast checked.",
  returns: "The system as data, design tokens as JSON and CSS, and a printable HTML sheet.",
  units: 2,
  input: {
    type: "object",
    properties: {
      name: { type: "string", maxLength: 120, description: "Brand name, for file names and the sheet's title." },
      seed: { type: "string", format: "hex-colour", description: "The one colour the system is built around." },
      scheme: { type: "string", enum: SCHEMES, default: "analogous", description: "How supporting colours relate to the seed on the colour wheel." },
      mood: { type: "string", enum: MOODS, default: "modern", description: "Picks the typeface pairing." },
      secondary: { type: "string", format: "hex-colour", description: "Use this instead of a generated secondary." },
      accent: { type: "string", format: "hex-colour", description: "Use this instead of a generated accent." },
      fonts: { type: "object", description: "Use these instead of a suggested pairing.", properties: { heading: { type: "string", maxLength: 80 }, body: { type: "string", maxLength: 80 } } },
    },
    required: ["seed"],
  },
  example: { name: "Acme Bank", seed: "#0b3d91", scheme: "complementary", mood: "modern" },
  run: run as Endpoint["run"],
};
