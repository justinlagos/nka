// Logo file pack: one SVG logo in, the full set of files a brand needs out. Colour, black and
// white versions, PNGs at working sizes, favicons and app icons, social avatars and a clear-space
// drawing, in one zip. The artwork is never redrawn: every file is the caller's own logo, cleaned.
import { contrast, esc, normaliseHex, slug, textOn, type OutFile } from "../brand.ts";
import { svgToPng, zip } from "../raster.ts";
import { recolourSvg, sanitiseSvg, svgColours, svgSize, tonalSvg } from "../svg.ts";
import { ApiError, type Deps, type Endpoint, type EndpointResult } from "../types.ts";

type Input = { name: string; logo: { svg?: string; url?: string }; brand_colour?: string; background?: string };

// The logo's own drawing, fitted inside a box at x, y, keeping its proportions.
export function place(clean: string, size: { w: number; h: number }, x: number, y: number, w: number, h: number): string {
  return clean.replace(/^<svg\b[^>]*>/, (root) => {
    const fill = root.match(/\sfill="[^"]*"/)?.[0] ?? "";
    return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 ${size.w} ${size.h}" preserveAspectRatio="xMidYMid meet"${fill}>`;
  });
}

// A square tile with the logo centred and padded: for avatars, favicons and app icons.
export function tile(clean: string, size: { w: number; h: number }, background: string | null, padding = 0.18, side = 1000): string {
  const inner = side * (1 - padding * 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}" width="${side}" height="${side}">${background ? `<rect width="${side}" height="${side}" fill="${background}"/>` : ""}${place(clean, size, side * padding, side * padding, inner, inner)}</svg>`;
}

// A drawing of the logo with its clear space marked: a margin of a quarter of the logo's height.
export function clearSpace(clean: string, size: { w: number; h: number }): string {
  const h = 400;
  const w = Math.round((size.w / size.h) * h);
  const m = h / 4;
  const W = w + m * 2;
  const H = h + m * 2;
  const guide = `stroke="#e5484d" stroke-width="2" stroke-dasharray="10 8" fill="none"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H + 70}" width="${W}" height="${H + 70}"><rect width="${W}" height="${H + 70}" fill="#ffffff"/><rect x="1" y="1" width="${W - 2}" height="${H - 2}" ${guide}/><rect x="${m}" y="${m}" width="${w}" height="${h}" ${guide}/>${place(clean, size, m, m, w, h)}<text x="${m / 2}" y="${H / 2}" font-family="Helvetica, Arial, sans-serif" font-size="22" fill="#e5484d" text-anchor="middle">x</text><text x="${W / 2}" y="${m / 2 + 8}" font-family="Helvetica, Arial, sans-serif" font-size="22" fill="#e5484d" text-anchor="middle">x</text><text x="${m}" y="${H + 42}" font-family="Helvetica, Arial, sans-serif" font-size="24" fill="#14151a">Clear space: x = one quarter of the logo's height. Keep it empty on all sides.</text></svg>`;
}

const README = (name: string, list: string[], notes: string[]) =>
  [`${name} logo files`, "", "svg/      Vector files. Use these for print and anywhere they are accepted.", "png/      Transparent PNGs for documents, slides and the web.", "icons/    Favicons, the Apple touch icon and app icons.", "social/   Square profile pictures.", "", "Use the colour logo first. Use black or white only where colour isn't possible.", "Leave clear space around the logo: see svg/clear-space.svg.", "Don't stretch, rotate, recolour or add effects.", "", ...(notes.length ? ["Notes", ...notes.map((n) => `- ${n}`), ""] : []), "Files", ...list.map((f) => `- ${f}`), ""].join("\n");

async function run(input: Input, deps: Deps): Promise<EndpointResult> {
  let raw = input.logo.svg ?? "";
  if (!raw && input.logo.url) {
    const file = await deps.fetchFile(input.logo.url, "image/svg+xml,*/*", 400_000);
    if (!file) throw new ApiError(422, "asset_unreadable", "The logo couldn't be fetched. It must be a public SVG under 400 KB.");
    raw = new TextDecoder().decode(file.body);
  }
  if (!raw) throw new ApiError(422, "invalid_request", "logo needs svg content or a url.", [{ path: "logo", message: "needs svg or url" }]);
  const clean = sanitiseSvg(raw);
  if (!clean) throw new ApiError(422, "asset_unreadable", "That isn't a usable SVG. Send the logo as an SVG file with shapes in it; PNG and JPEG logos can't be turned into a file pack.");
  const size = svgSize(clean);
  if (!size) throw new ApiError(422, "asset_unreadable", "The SVG needs a viewBox, or a width and height, so its proportions are known.");
  if (size.w / size.h > 12 || size.h / size.w > 12) throw new ApiError(422, "asset_unreadable", "The logo is more than twelve times wider than it is tall (or the reverse). Check the SVG's viewBox.");

  const base = slug(input.name, "logo");
  const used = svgColours(clean);
  const brandColour = normaliseHex(input.brand_colour ?? "") ?? used.find((c) => contrast(c, "#ffffff") >= 3) ?? used[0] ?? "#14151a";
  const tileBg = normaliseHex(input.background ?? "") ?? "#ffffff";
  const blackVersion = tonalSvg(clean, "black");
  const black = blackVersion.svg;
  const white = tonalSvg(clean, "white").svg;
  // On the brand colour: solid black or white if the logo has one colour, otherwise the tonal version that reads on it.
  const onBrand = blackVersion.flat ? recolourSvg(clean, textOn(brandColour)) : textOn(brandColour) === "#ffffff" ? white : black;
  const hasText = /<text\b/.test(clean);
  const notes: string[] = [];

  const packed: OutFile[] = [
    { name: `svg/${base}.svg`, mime: "image/svg+xml", data: clean },
    { name: `svg/${base}-black.svg`, mime: "image/svg+xml", data: black },
    { name: `svg/${base}-white.svg`, mime: "image/svg+xml", data: white },
    { name: `svg/${base}-on-colour.svg`, mime: "image/svg+xml", data: tile(onBrand, size, brandColour) },
    { name: "svg/clear-space.svg", mime: "image/svg+xml", data: clearSpace(clean, size) },
  ];

  let pngs = 0;
  if (hasText) {
    // A PNG is drawn on the server, which doesn't have the brand's typeface. The words would
    // come out in the wrong face or not at all, so no PNG is better than a wrong one.
    notes.push("The logo contains live text, so PNGs, favicons and avatars were not made. Convert the text to outlines and send it again.");
  } else {
    const png = async (name: string, svg: string, width: number, bg?: string) => {
      packed.push({ name, mime: "image/png", data: await svgToPng(svg, width, bg) });
      pngs++;
    };
    const wide = size.w >= size.h;
    for (const w of [512, 1024, 2048]) await png(`png/${base}-${w}.png`, clean, wide ? w : Math.round((w * size.w) / size.h));
    await png(`png/${base}-black-1024.png`, black, wide ? 1024 : Math.round((1024 * size.w) / size.h));
    await png(`png/${base}-white-1024.png`, white, wide ? 1024 : Math.round((1024 * size.w) / size.h));
    const light = tile(clean, size, tileBg);
    const onColour = tile(onBrand, size, brandColour);
    for (const s of [16, 32, 48]) await png(`icons/favicon-${s}.png`, tile(clean, size, null, 0.06), s);
    await png("icons/apple-touch-icon.png", light, 180);
    await png("icons/icon-192.png", light, 192);
    await png("icons/icon-512.png", light, 512);
    await png(`social/${base}-avatar-light-800.png`, light, 800);
    await png(`social/${base}-avatar-colour-800.png`, onColour, 800);
    if (used.length && used.every((c) => contrast(c, tileBg) < 1.6)) notes.push(`The logo is close in colour to the tile background (${tileBg}). Send a different background, or use the colour avatar.`);
  }
  if (!blackVersion.flat) notes.push("The logo has more than one colour, so the black and white versions use tones of grey to keep its detail. A strict one-ink version (for engraving, embroidery or a rubber stamp) needs a designer to decide what is cut out.");
  if (size.w / size.h > 2 || size.h / size.w > 2) notes.push("The logo isn't close to square, so it is small inside favicons and avatars. Send the mark on its own for a second pack to use there.");
  packed.push({ name: "README.txt", mime: "text/plain", data: README(input.name, packed.map((f) => f.name), notes) });

  const preview = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(input.name)} logo files</title>
<style>body{margin:0;padding:24px;font:14px/1.4 "Helvetica Neue",Arial,sans-serif;color:#14151a;background:#f1f1ee}h1{font-size:20px;margin:0 0 16px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}figure{margin:0}.box{height:160px;display:grid;place-items:center;padding:24px;border:1px solid #dcddd6}.box svg{max-width:100%;max-height:112px;width:auto;height:auto}figcaption{font-size:12px;color:#5b5e72;margin-top:6px}</style></head><body><h1>${esc(input.name)} logo files</h1><div class="grid">
<figure><div class="box" style="background:#fff">${clean}</div><figcaption>Colour</figcaption></figure>
<figure><div class="box" style="background:#fff">${black}</div><figcaption>Black</figcaption></figure>
<figure><div class="box" style="background:#14151a">${white}</div><figcaption>White</figcaption></figure>
<figure><div class="box" style="background:${brandColour}">${onBrand}</div><figcaption>On brand colour ${brandColour}</figcaption></figure>
</div></body></html>
`;
  return {
    result: {
      name: input.name,
      proportions: { width: size.w, height: size.h },
      colours_found: used,
      brand_colour: brandColour,
      files_in_zip: packed.map((f) => f.name),
      png_count: pngs,
      notes: [...notes, "Every file is your own artwork, cleaned of scripts and outside links. Nothing was redrawn."],
    },
    files: [
      { name: `${base}-logo-pack.zip`, mime: "application/zip", data: await zip(packed) },
      { name: `${base}-logo-preview.html`, mime: "text/html; charset=utf-8", data: preview },
      { name: `${base}.svg`, mime: "image/svg+xml", data: clean },
    ],
  };
}

export const logoPack: Endpoint = {
  id: "logo_pack",
  path: "logo-packs",
  group: "Brand and identity",
  title: "Logo file pack",
  summary: "Turns one SVG logo into the full working set: colour, black and white versions, PNGs, favicons and app icons, social avatars and a clear-space drawing.",
  returns: "A zip of every file with a README, an HTML preview, and the cleaned SVG.",
  units: 3,
  input: {
    type: "object",
    properties: {
      name: { type: "string", minLength: 1, maxLength: 120, description: "Brand name, used for file names." },
      logo: {
        type: "object",
        description: "The logo as SVG: paste the markup or give a public link. Text should be converted to outlines.",
        properties: { svg: { type: "string", maxLength: 400000 }, url: { type: "string", format: "uri", maxLength: 1000 } },
      },
      brand_colour: { type: "string", format: "hex-colour", description: "Background for the on-colour versions. Default: the logo's main colour." },
      background: { type: "string", format: "hex-colour", description: "Background for light icons and avatars. Default: white." },
    },
    required: ["name", "logo"],
  },
  example: {
    name: "Acme Bank",
    logo: { svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 80"><rect x="4" y="12" width="56" height="56" rx="12" fill="#0b3d91"/><path d="M20 54 L32 26 L44 54 Z" fill="#f2a900"/><rect x="76" y="30" width="150" height="8" fill="#0b3d91"/><rect x="76" y="46" width="104" height="8" fill="#0b3d91"/></svg>' },
  },
  run: run as Endpoint["run"],
};
