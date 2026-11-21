import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { askClaude, jsonFrom } from "@/lib/ai";
import { fetchPublic } from "@/lib/api/fetch";
import { normaliseUrl, parseHtml, pickFonts, pickLogo, pickPalette, type BrandScan } from "@/lib/brand-scan";

// Every hop is checked against private addresses, by name and by what the name resolves to.
async function safeFetch(raw: string, accept: string, maxBytes: number): Promise<{ url: string; body: Uint8Array; type: string } | null> {
  const url = normaliseUrl(raw);
  return url ? fetchPublic(url, accept, maxBytes) : null;
}

const BRAND_PROMPT = `You read a company's website text and describe its brand for a design studio's brand book.
Reply with one JSON object only:
{"company":"","about":"","audiences":"","voice":""}
- company: the company's name as it presents itself.
- about: 2 to 3 plain sentences: what they do, where, for whom.
- audiences: 1 to 3 short lines on who they sell to.
- voice: 1 to 2 sentences on their tone of voice, based on how the site is written.
Use only what the text supports. Leave a field empty rather than guess. British English. No marketing language.`;

export async function scanWebsite(raw: string): Promise<BrandScan | null> {
  const page = await safeFetch(raw, "text/html,application/xhtml+xml", 2_000_000);
  if (!page || !/html/i.test(page.type)) return null;
  const html = new TextDecoder().decode(page.body);
  const facts = parseHtml(html, page.url);

  // Pull a few stylesheets for colours and fonts.
  const sheets = (html.match(/<link\b[^>]*rel\s*=\s*["']?stylesheet[^>]*>/gi) ?? [])
    .map((l) => l.match(/href\s*=\s*["']([^"']+)["']/i)?.[1] ?? "")
    .filter((h) => h && !/fonts\.googleapis|typekit/i.test(h))
    .slice(0, 4)
    .map((h) => {
      try {
        return new URL(h, page.url).toString();
      } catch {
        return "";
      }
    })
    .filter(Boolean);
  const cssParts = await Promise.all(sheets.map((s) => safeFetch(s, "text/css", 600_000)));
  const css = facts.css + "\n" + cssParts.map((c) => (c ? new TextDecoder().decode(c.body) : "")).join("\n");

  const summary = jsonFrom<{ company?: string; about?: string; audiences?: string; voice?: string }>(
    await askClaude(
      BRAND_PROMPT,
      [
        `Website: ${facts.url}`,
        `Title: ${facts.title}`,
        facts.siteName && `Site name: ${facts.siteName}`,
        facts.description && `Description: ${facts.description}`,
        facts.headings.length ? `Headings: ${facts.headings.join(" | ")}` : "",
        `Text: ${facts.text.slice(0, 5000)}`,
      ]
        .filter(Boolean)
        .join("\n"),
      700,
      25_000,
    ),
  );

  const fallbackName = (facts.siteName || facts.title.split(/[|\-–:]/)[0] || new URL(facts.url).hostname.replace(/^www\./, "")).trim();
  return {
    website: facts.url,
    company: (summary?.company || fallbackName).slice(0, 160),
    about: (summary?.about || facts.description).slice(0, 4000),
    audiences: (summary?.audiences ?? "").slice(0, 4000),
    voice: (summary?.voice ?? "").slice(0, 4000),
    palette: pickPalette(css, facts.themeColor),
    fonts: pickFonts(css, facts.fontLinks),
    logoUrl: pickLogo(facts.logoCandidates),
  };
}

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
  "image/webp": "webp",
  "image/gif": "gif",
};

// Saves what the scan found into the brand book. Fields the client already wrote are kept.
export async function applyBrandScan(supabase: SupabaseClient, orgId: string, userId: string, scan: BrandScan) {
  let logoPath: string | null = null;
  if (scan.logoUrl) {
    const img = await safeFetch(scan.logoUrl, "image/*", 2_000_000);
    const type = img?.type.split(";")[0].trim() ?? "";
    if (img && EXT[type]) {
      const path = `${orgId}/brand/logo-${Date.now()}.${EXT[type]}`;
      const { error } = await supabase.storage.from("files").upload(path, img.body, { contentType: type, upsert: false });
      if (!error) {
        logoPath = path;
        await supabase.from("attachments").insert({
          org_id: orgId,
          kind: "brand",
          storage_path: path,
          file_name: `logo.${EXT[type]}`,
          mime: type,
          size: img.body.byteLength,
          uploaded_by: userId,
        });
      }
    }
  }

  const { data: book } = await supabase.from("brand_books").select("about, audiences, voice, colours, typefaces").eq("org_id", orgId).maybeSingle();
  const keep = (current: string | undefined, next: string) => (current && current.trim() ? current : next);
  await supabase
    .from("brand_books")
    .update({
      website: scan.website.slice(0, 300),
      about: keep(book?.about, scan.about),
      audiences: keep(book?.audiences, scan.audiences),
      voice: keep(book?.voice, scan.voice),
      colours: keep(book?.colours, scan.palette.join(", ")),
      typefaces: keep(book?.typefaces, scan.fonts.join(", ")),
      palette: scan.palette,
      fonts: scan.fonts,
      ...(logoPath ? { logo_path: logoPath } : {}),
      scanned_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq("org_id", orgId);
  return { logoPath };
}
