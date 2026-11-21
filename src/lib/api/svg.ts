// Making someone else's SVG safe to store and hand back, and recolouring it. SVG can carry
// scripts, event handlers and links to other servers, so only a short list of drawing elements
// and attributes is kept. Everything else is dropped, not escaped.
import { esc, luminance, normaliseHex, toHex } from "./brand.ts";

const ELEMENTS = new Set([
  "svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "defs", "lineargradient", "radialgradient",
  "stop", "clippath", "mask", "symbol", "use", "title", "desc", "text", "tspan",
]);
// Proper-case names for the elements SVG spells with capitals.
const CASED: Record<string, string> = { lineargradient: "linearGradient", radialgradient: "radialGradient", clippath: "clipPath" };
const TEXTUAL = new Set(["title", "desc", "text", "tspan"]);
const ATTRS = new Set([
  "d", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "stroke-dasharray", "stroke-dashoffset",
  "opacity", "fill-opacity", "stroke-opacity", "fill-rule", "clip-rule", "transform", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry",
  "width", "height", "points", "viewbox", "xmlns", "id", "offset", "stop-color", "stop-opacity", "gradientunits", "gradienttransform",
  "spreadmethod", "fx", "fy", "clip-path", "mask", "href", "xlink:href", "font-family", "font-size", "font-weight", "text-anchor",
  "letter-spacing", "preserveaspectratio", "dx", "dy", "clippathunits", "maskunits",
]);
const ATTR_CASED: Record<string, string> = {
  viewbox: "viewBox", gradientunits: "gradientUnits", gradienttransform: "gradientTransform", spreadmethod: "spreadMethod",
  preserveaspectratio: "preserveAspectRatio", clippathunits: "clipPathUnits", maskunits: "maskUnits",
};
// Style properties that may be lifted out of style="..." or a <style> block into attributes.
const STYLE_PROPS = new Set([
  "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "stroke-dasharray", "opacity", "fill-opacity",
  "stroke-opacity", "fill-rule", "clip-rule", "stop-color", "stop-opacity", "font-family", "font-size", "font-weight", "letter-spacing",
]);

const decodeEntities = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

function safeValue(name: string, raw: string): string | null {
  const v = decodeEntities(raw).trim();
  if (v.length > 20000 && name !== "d" && name !== "points") return null;
  if (/[<>\\\u0000-\u001f]/.test(v)) return null;
  if (/javascript:|data:|vbscript:|expression\(|@import|&#/i.test(v)) return null;
  if (name === "href" || name === "xlink:href") return /^#[\w.-]+$/.test(v) ? v : null;
  // url(...) may only point inside this file.
  if (/url\(/i.test(v) && !/^url\(\s*["']?#[\w.-]+["']?\s*\)$/i.test(v)) return null;
  if (name === "d" && !/^[\sMmLlHhVvCcSsQqTtAaZz0-9.,eE+-]*$/.test(v)) return null;
  if (name === "xmlns" && v !== "http://www.w3.org/2000/svg") return null;
  return v;
}

function parseAttrs(raw: string): [string, string][] {
  const out: [string, string][] = [];
  for (const m of raw.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) out.push([m[1].toLowerCase(), m[2] ?? m[3] ?? ""]);
  return out;
}

function declarations(css: string): [string, string][] {
  return css
    .split(";")
    .map((d) => d.split(":"))
    .filter((p) => p.length === 2)
    .map(([k, v]) => [k.trim().toLowerCase(), v.trim()] as [string, string])
    .filter(([k]) => STYLE_PROPS.has(k));
}

// Class rules from <style> blocks, as Illustrator and Figma export them: .cls-1{fill:#0b3d91}
function classRules(svg: string): Map<string, [string, string][]> {
  const rules = new Map<string, [string, string][]>();
  for (const block of svg.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    const css = block[1].replace(/<!\[CDATA\[|\]\]>/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      for (const sel of rule[1].split(",")) {
        const cls = sel.trim().match(/^\.([\w-]+)$/)?.[1];
        if (cls) rules.set(cls, [...(rules.get(cls) ?? []), ...declarations(rule[2])]);
      }
    }
  }
  return rules;
}

const TOKEN = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<[!?][^>]*>|<(\/?)([A-Za-z][\w:.-]*)((?:\s+[\w:.-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'))?)*)\s*(\/?)>|[^<]+|</g;

// Returns a cleaned SVG, or null if the input isn't a usable SVG. Class and inline styles are
// turned into plain attributes so colours survive.
export function sanitiseSvg(input: string, maxBytes = 400_000): string | null {
  if (typeof input !== "string" || input.length > maxBytes) return null;
  // Entity definitions can expand without limit and pull in other files. Refuse outright.
  if (/<!ENTITY/i.test(input)) return null;
  const rules = classRules(input);
  let out = "";
  const open: string[] = [];
  let skip: string | null = null;
  let skipDepth = 0;
  let sawRoot = false;
  for (const m of input.matchAll(TOKEN)) {
    const token = m[0];
    const name = m[2]?.toLowerCase();
    if (!name) {
      // Text between tags: kept only inside text-bearing elements, and always escaped.
      if (!token.startsWith("<") && !skip && open.length && TEXTUAL.has(open[open.length - 1])) out += esc(decodeEntities(token));
      continue;
    }
    const closing = m[1] === "/";
    const selfClosing = m[4] === "/";
    if (skip) {
      if (name === skip) {
        if (closing) skipDepth--;
        else if (!selfClosing) skipDepth++;
        if (skipDepth === 0) skip = null;
      }
      continue;
    }
    // Wrappers that draw nothing themselves: drop the tag, keep what's inside.
    if (name === "a" || name === "switch") continue;
    if (!ELEMENTS.has(name)) {
      if (!closing && !selfClosing) {
        skip = name;
        skipDepth = 1;
      }
      continue;
    }
    const tag = CASED[name] ?? name;
    if (closing) {
      const at = open.lastIndexOf(name);
      if (at < 0) continue;
      // Close anything left open inside it too, so the output always nests properly.
      while (open.length > at) {
        const n = open.pop() as string;
        out += `</${CASED[n] ?? n}>`;
      }
      continue;
    }
    if (!sawRoot) {
      if (name !== "svg") return null;
      sawRoot = true;
    }
    const attrs = new Map<string, string>();
    const raw = parseAttrs(m[3] ?? "");
    // Lowest priority first: class rules, then presentation attributes, then inline style.
    for (const [k, v] of raw) if (k === "class") for (const c of v.split(/\s+/)) for (const [p, pv] of rules.get(c) ?? []) attrs.set(p, pv);
    for (const [k, v] of raw) if (ATTRS.has(k)) attrs.set(k, v);
    for (const [k, v] of raw) if (k === "style") for (const [p, pv] of declarations(decodeEntities(v))) attrs.set(p, pv);
    if (name === "svg" && open.length === 0) attrs.set("xmlns", "http://www.w3.org/2000/svg");
    let text = `<${tag}`;
    for (const [k, v] of attrs) {
      const safe = safeValue(k, v);
      // xlink:href needs a namespace declaration we don't keep; plain href means the same.
      if (safe !== null) text += ` ${k === "xlink:href" ? "href" : (ATTR_CASED[k] ?? k)}="${esc(safe)}"`;
    }
    out += selfClosing ? `${text}/>` : `${text}>`;
    if (!selfClosing) open.push(name);
  }
  while (open.length) {
    const n = open.pop() as string;
    out += `</${CASED[n] ?? n}>`;
  }
  if (!sawRoot || !/<(path|rect|circle|ellipse|line|polyline|polygon|text|use)\b/.test(out)) return null;
  return out;
}

const COLOUR_ATTR = /\s(fill|stroke|stop-color)="([^"]*)"/g;

// One flat colour throughout: for single-colour and reversed versions of a logo. Works on
// sanitised SVG only. Shapes with no fill are black by default in SVG, so the root sets one.
export function recolourSvg(clean: string, hex: string): string {
  const colour = normaliseHex(hex) ?? "#000000";
  const body = clean.replace(COLOUR_ATTR, (whole, attr: string, value: string) => (/^(none|transparent)$/i.test(value.trim()) ? whole : ` ${attr}="${colour}"`));
  return body.replace(/^<svg\b([^>]*)>/, (_, attrs: string) => `<svg${attrs.replace(/\sfill="[^"]*"/, "")} fill="${colour}">`);
}

// Width and height of the drawing, from viewBox or width/height. null if neither is usable.
export function svgSize(clean: string): { w: number; h: number } | null {
  const root = clean.match(/^<svg\b[^>]*>/)?.[0] ?? "";
  const vb = root.match(/viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/);
  if (vb && +vb[1] > 0 && +vb[2] > 0) return { w: +vb[1], h: +vb[2] };
  const w = parseFloat(root.match(/\swidth="([\d.]+)/)?.[1] ?? "");
  const h = parseFloat(root.match(/\sheight="([\d.]+)/)?.[1] ?? "");
  return w > 0 && h > 0 ? { w, h } : null;
}

const NAMED: Record<string, string> = {
  black: "#000000", white: "#ffffff", red: "#ff0000", green: "#008000", blue: "#0000ff", yellow: "#ffff00", orange: "#ffa500", purple: "#800080",
  gray: "#808080", grey: "#808080", silver: "#c0c0c0", navy: "#000080", teal: "#008080", maroon: "#800000", olive: "#808000", lime: "#00ff00",
  aqua: "#00ffff", cyan: "#00ffff", fuchsia: "#ff00ff", magenta: "#ff00ff", pink: "#ffc0cb", brown: "#a52a2a", gold: "#ffd700",
};

// A colour as written in an SVG attribute: hex, rgb() or a common name. null for none, url(#...)
// and anything unrecognised.
export function parseColour(value: string): string | null {
  const v = value.trim().toLowerCase();
  if (v.startsWith("#")) return normaliseHex(v);
  const m = v.match(/^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/);
  if (m) return toHex(+m[1], +m[2], +m[3]);
  return NAMED[v] ?? null;
}

// Every distinct colour the drawing uses, most frequent first.
export function svgColours(clean: string): string[] {
  const counts = new Map<string, number>();
  for (const m of clean.matchAll(COLOUR_ATTR)) {
    const hex = parseColour(m[2]);
    if (hex) counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([h]) => h);
}

// A black or white version that keeps the logo readable. A one-colour logo becomes solid black
// or white. A logo with several colours can't simply be flooded with one, because shapes drawn
// on top of each other would merge into a blob, so each colour becomes a grey by its lightness:
// darkest to black and the rest up to light grey, or the reverse for the white version.
export function tonalSvg(clean: string, mode: "black" | "white"): { svg: string; flat: boolean } {
  const solid = mode === "black" ? "#000000" : "#ffffff";
  const used = svgColours(clean);
  const hasGradient = /<(linearGradient|radialGradient)\b/.test(clean);
  if (used.length <= 1 && !hasGradient) return { svg: recolourSvg(clean, solid), flat: true };
  const lums = used.map(luminance);
  const [lo, hi] = [Math.min(...lums), Math.max(...lums)];
  const grey = (hex: string) => {
    const t = hi > lo ? (luminance(hex) - lo) / (hi - lo) : 0;
    const level = Math.round((mode === "black" ? t * 0.62 : 1 - t * 0.62) * 255);
    return toHex(level, level, level);
  };
  const body = clean.replace(COLOUR_ATTR, (whole, attr: string, value: string) => {
    if (/^(none|transparent)$/i.test(value.trim()) || /^url\(/i.test(value.trim())) return whole;
    const hex = parseColour(value);
    return ` ${attr}="${hex ? grey(hex) : solid}"`;
  });
  // Shapes with no fill are black in SVG: the darkest tone.
  const svg = /^<svg\b[^>]*\sfill="/.test(body) ? body : body.replace(/^<svg\b/, `<svg fill="${solid}"`);
  return { svg, flat: false };
}
