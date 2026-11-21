// Shared shapes for the API. Endpoints are plain functions that take cleaned input and a few
// injected helpers (model, file fetch, site scan), so they run the same in a route and in a test.
import type { Schema } from "./schema.ts";
import { normaliseBrand, normaliseHex, type BrandKit, type OutFile } from "./brand.ts";

export class ApiError extends Error {
  status: number;
  code: string;
  details: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export type ModelPart = { type: "text"; text: string } | { type: "image"; media_type: string; data: string };
export type Fetched = { body: Uint8Array; type: string; url: string };
export type SiteScan = { company: string; about: string; voice: string; palette: string[]; fonts: string[]; logoUrl: string | null };

export type Deps = {
  // null when no model key is set. Returns the reply text, or null if the call failed.
  model: ((system: string, parts: ModelPart[], maxTokens?: number) => Promise<string | null>) | null;
  // Fetches a public file with private addresses blocked. null if it can't be fetched or is too big.
  fetchFile: (url: string, accept: string, maxBytes: number) => Promise<Fetched | null>;
  scanSite: (url: string) => Promise<SiteScan | null>;
  // Whether a domain name has DNS records. null when the lookup itself failed.
  hasDns: (domain: string) => Promise<boolean | null>;
  // The site's own address, for links inside results.
  origin: string;
  // Stores a card and its recipients; returns the card id.
  saveCard: (spec: Record<string, unknown>, recipients: { token: string; name: string; ref: string; fields: Record<string, string> }[], expiresAt: string | null) => Promise<string>;
};

// The five families of work the API covers.
export const GROUPS = ["Brand and identity", "Documents and decks", "Social and campaign", "Motion", "Events"] as const;
export type Group = (typeof GROUPS)[number];

export type EndpointResult = { result: Record<string, unknown>; files: OutFile[] };

export type Endpoint = {
  id: string; // also the MCP tool name
  path: string; // under /api/v1
  group: Group;
  title: string;
  summary: string;
  // What comes back, in a sentence, for the catalogue and the docs.
  returns: string;
  units: number;
  // True when the endpoint can't run at all without a model key.
  input: Schema;
  example: Record<string, unknown>;
  run: (input: never, deps: Deps) => Promise<EndpointResult>;
};

// Fills gaps in a brand kit from its website, then checks there's enough to work with.
export async function resolveBrand(raw: unknown, deps: Deps, need: { colours?: boolean } = {}): Promise<BrandKit> {
  const brand = normaliseBrand(raw);
  const thin = !brand.name || brand.colours.length === 0 || !brand.fonts.body || !brand.logo_url || !brand.about;
  if (brand.website && thin) {
    const scan = await deps.scanSite(brand.website);
    if (scan) {
      if (!brand.name) brand.name = scan.company.slice(0, 120);
      if (!brand.about) brand.about = scan.about.slice(0, 2000);
      if (!brand.voice) brand.voice = scan.voice.slice(0, 2000);
      if (brand.colours.length === 0) {
        for (const c of scan.palette) {
          const hex = normaliseHex(c);
          if (hex) brand.colours.push({ hex, name: "", role: "" });
        }
      }
      if (!brand.fonts.body && scan.fonts.length) {
        const f = normaliseBrand({ fonts: { heading: scan.fonts[0], body: scan.fonts[1] ?? scan.fonts[0] } }).fonts;
        brand.fonts = f;
      }
      if (!brand.logo_url && scan.logoUrl) brand.logo_url = scan.logoUrl.slice(0, 500);
    }
  }
  if (!brand.name) {
    throw new ApiError(422, "invalid_request", "brand.name is required, or a brand.website we can read it from.", [{ path: "brand.name", message: "is required" }]);
  }
  if (need.colours && brand.colours.length === 0) {
    throw new ApiError(422, "invalid_request", "brand.colours is required, or a brand.website we can read colours from.", [{ path: "brand.colours", message: "needs at least 1 item" }]);
  }
  return brand;
}

// Pulls the first JSON object out of a model reply.
export function jsonFrom<T>(text: string | null): T | null {
  if (!text) return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

// A brand's logo as a data URI, so files we hand back don't depend on someone else's server.
// null when there's no logo, it can't be fetched, or it's over the size limit.
export async function logoData(brand: BrandKit, deps: Deps, maxBytes = 600_000): Promise<{ uri: string; mime: string; base64: string } | null> {
  if (!brand.logo_url) return null;
  const file = await deps.fetchFile(brand.logo_url, "image/*", maxBytes);
  if (!file) return null;
  const mime = file.type.split(";")[0].trim().toLowerCase();
  if (![...IMAGE_TYPES, "image/svg+xml"].includes(mime)) return null;
  const base64 = Buffer.from(file.body).toString("base64");
  return { uri: `data:${mime};base64,${base64}`, mime, base64 };
}

export const isRasterImage = (mime: string) => IMAGE_TYPES.includes(mime);
