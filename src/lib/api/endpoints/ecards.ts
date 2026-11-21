// E-cards: one interactive card, a personal link for every recipient, and open counts.
// No model involved. We make the links; the caller sends them, so nobody is emailed by us.
import { randomBytes } from "node:crypto";
import { brandSchema, fontsHref, fontStack, roles, safeLink, slug, type OutFile } from "../brand.ts";
import { ApiError, logoData, resolveBrand, type Deps, type Endpoint, type EndpointResult } from "../types.ts";

export const TEMPLATES = ["snow", "confetti", "glow"] as const;
export type Template = (typeof TEMPLATES)[number];
const OCCASIONS = ["christmas", "new-year", "eid", "diwali", "easter", "birthday", "anniversary", "thank-you", "congratulations", "custom"] as const;
type Occasion = (typeof OCCASIONS)[number];

const DEFAULT_TEMPLATE: Record<Occasion, Template> = {
  christmas: "snow", "new-year": "confetti", eid: "glow", diwali: "glow", easter: "glow", birthday: "confetti",
  anniversary: "confetti", "thank-you": "glow", congratulations: "confetti", custom: "glow",
};

type Recipient = { name: string; ref?: string; fields?: Record<string, string> };
type Input = {
  brand: unknown;
  occasion: Occasion;
  template?: Template;
  headline: string;
  message: string;
  sender?: { name?: string; title?: string };
  cta?: { label: string; url: string };
  recipients: Recipient[];
  expires_on?: string;
};

// What the card page needs to draw a card. Stored once per card; each recipient adds their own fields.
export type CardSpec = {
  brand: string;
  occasion: string;
  template: Template;
  headline: string;
  message: string;
  sender: { name: string; title: string };
  cta: { label: string; url: string } | null;
  colours: { primary: string; accent: string; onPrimary: string; ink: string };
  fonts: { heading: string; body: string; href: string };
  logo: string;
};

// Replaces {{name}} and any {{field}} the recipient has. Unknown fields become nothing, so a
// card never shows a raw {{placeholder}} to the person reading it.
export function merge(template: string, fields: Record<string, string>): string {
  return template
    .replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => (Object.hasOwn(fields, key.toLowerCase()) ? fields[key.toLowerCase()] : ""))
    .replace(/[ \t]+([,.!?;:])/g, "$1")
    // A missing field can leave "Ikeja, ." behind; drop the stranded comma.
    .replace(/,+([.!?;:])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function fieldsFor(r: { name: string; fields?: Record<string, string> }): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(r.fields ?? {})) {
    if (/^[a-zA-Z0-9_]+$/.test(k) && k !== "__proto__") out[k.toLowerCase()] = String(v);
  }
  out.name = r.name;
  out.first_name = r.name.split(/\s+/)[0] ?? "";
  return out;
}

export const newToken = () => randomBytes(16).toString("base64url");

// Spreadsheets run cells that start with = + - or @ as formulas.
export function csvCell(v: string): string {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
}

async function run(input: Input, deps: Deps): Promise<EndpointResult> {
  const brand = await resolveBrand(input.brand, deps);
  const cta = input.cta ? { label: input.cta.label, url: safeLink(input.cta.url) } : null;
  if (cta && !cta.url.startsWith("https://")) throw new ApiError(422, "invalid_request", "cta.url must be an https link.", [{ path: "cta.url", message: "must be https" }]);
  let expiresAt: string | null = null;
  if (input.expires_on) {
    const d = new Date(`${input.expires_on}T23:59:59Z`);
    if (Number.isNaN(d.getTime()) || d.getTime() < Date.now()) throw new ApiError(422, "invalid_request", "expires_on must be a date in the future.", [{ path: "expires_on", message: "must be in the future" }]);
    expiresAt = d.toISOString();
  }
  for (const [i, p] of input.recipients.entries()) {
    if (Object.keys(p.fields ?? {}).length > 12) throw new ApiError(422, "invalid_request", "A recipient takes at most 12 fields.", [{ path: `recipients[${i}].fields`, message: "at most 12 fields" }]);
  }
  // Small logos travel with the card. A big one would be loaded again by every recipient.
  const logo = await logoData(brand, deps, 200_000);
  const r = roles(brand);
  const spec: CardSpec = {
    brand: brand.name,
    occasion: input.occasion,
    template: input.template ?? DEFAULT_TEMPLATE[input.occasion],
    headline: input.headline,
    message: input.message,
    sender: { name: input.sender?.name ?? "", title: input.sender?.title ?? "" },
    cta,
    colours: { primary: r.primary, accent: r.accent, onPrimary: r.onPrimary, ink: r.ink },
    fonts: { heading: fontStack(brand.fonts.heading), body: fontStack(brand.fonts.body), href: fontsHref(brand) },
    logo: logo?.uri ?? "",
  };
  const rows = input.recipients.map((p) => ({ token: newToken(), name: p.name, ref: p.ref ?? "", fields: Object.fromEntries(Object.entries(p.fields ?? {}).map(([k, v]) => [k.toLowerCase(), String(v)])) }));
  const cardId = await deps.saveCard(spec as unknown as Record<string, unknown>, rows, expiresAt);
  const links = rows.map((p) => ({ name: p.name, ref: p.ref, url: `${deps.origin}/c/${p.token}` }));
  const csv = ["name,ref,url", ...links.map((l) => [l.name, l.ref, l.url].map(csvCell).join(","))].join("\r\n") + "\r\n";
  const files: OutFile[] = [{ name: `${slug(brand.name, "card")}-${input.occasion}-links.csv`, mime: "text/csv; charset=utf-8", data: csv }];
  return {
    result: {
      card_id: cardId,
      brand: brand.name,
      template: spec.template,
      preview_url: `${links[0].url}?preview=1`,
      stats_url: `${deps.origin}/api/v1/ecards/${cardId}`,
      expires_at: expiresAt,
      recipients: links,
      notes: [
        "Send each person their own link. Nka doesn't email recipients.",
        "An open is counted when the recipient taps to open the card. The preview link doesn't count.",
        ...(brand.logo_url && !logo ? ["The logo couldn't be fetched or is over 200 KB, so the brand name is shown in its place."] : []),
      ],
    },
    files,
  };
}

export const ecards: Endpoint = {
  id: "ecard",
  path: "ecards",
  group: "Events",
  title: "Personalised e-cards",
  summary: "Makes an animated, branded greeting card with a personal link for each recipient, and counts who opened it.",
  returns: "A card id, a preview link, one link per recipient (also as a CSV) and a stats address for open counts.",
  units: 2,
  input: {
    type: "object",
    properties: {
      brand: brandSchema,
      occasion: { type: "string", enum: OCCASIONS },
      template: { type: "string", enum: TEMPLATES, description: "Animation style. Default depends on the occasion." },
      headline: { type: "string", minLength: 1, maxLength: 120, description: "Shown large. May use {{name}}, {{first_name}} or any recipient field." },
      message: { type: "string", minLength: 1, maxLength: 1200, description: "The card's message. May use {{name}}, {{first_name}} or any recipient field." },
      sender: { type: "object", properties: { name: { type: "string", maxLength: 120 }, title: { type: "string", maxLength: 120 } } },
      cta: {
        type: "object",
        description: "An optional button under the message.",
        properties: { label: { type: "string", minLength: 1, maxLength: 40 }, url: { type: "string", format: "uri", maxLength: 500 } },
        required: ["label", "url"],
      },
      recipients: {
        type: "array",
        minItems: 1,
        maxItems: 500,
        description: "Names only. Don't send email addresses; use ref for your own id.",
        items: {
          type: "object",
          properties: {
            name: { type: "string", minLength: 1, maxLength: 120 },
            ref: { type: "string", maxLength: 120, description: "Your own reference for this person, returned with their link." },
            fields: { type: "object", description: "Extra merge fields, e.g. {\"branch\": \"Ikeja\"}.", properties: {}, additionalProperties: { type: "string", maxLength: 200 } },
          },
          required: ["name"],
        },
      },
      expires_on: { type: "string", format: "date", description: "Links stop working after this date." },
    },
    required: ["brand", "occasion", "headline", "message", "recipients"],
  },
  example: {
    brand: { name: "Acme Bank", colours: [{ hex: "#0b3d91" }, { hex: "#f2a900" }], fonts: { heading: "Sora", body: "Inter" } },
    occasion: "christmas",
    headline: "Merry Christmas, {{first_name}}",
    message: "Thank you for banking with us at {{branch}} this year. We wish you and yours a restful holiday.",
    sender: { name: "Ada Obi", title: "Managing Director" },
    recipients: [{ name: "Chidi Okeke", ref: "cust_001", fields: { branch: "Ikeja" } }, { name: "Bola Ade", ref: "cust_002", fields: { branch: "Marina" } }],
  },
  run: run as Endpoint["run"],
};
