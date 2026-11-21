// What the API offers. Five services run end to end. The rest of the studio's work is listed as
// "on request": a caller can ask for it through the API and it arrives in Nka as a brief for the team.
import type { Endpoint } from "./types.ts";
import { brandCheck } from "./endpoints/brand-check.ts";
import { brandGuidelines } from "./endpoints/brand-guidelines.ts";
import { documents } from "./endpoints/documents.ts";
import { ecards } from "./endpoints/ecards.ts";
import { socialTemplates } from "./endpoints/social-templates.ts";

export const API_VERSION = "1.0.0";

export const ENDPOINTS: Endpoint[] = [brandCheck, brandGuidelines, documents, ecards, socialTemplates];

export function endpointByPath(path: string): Endpoint | undefined {
  return ENDPOINTS.find((e) => e.path === path);
}
export function endpointById(id: string): Endpoint | undefined {
  return ENDPOINTS.find((e) => e.id === id);
}

// `service` is the Nka service the brief is filed under (see SERVICE_OPTIONS in lib/brief.ts).
export type OnRequest = { id: string; title: string; group: string; service: string };

export const ON_REQUEST: OnRequest[] = [
  { id: "brand_audit", title: "Brand audit across site and social", group: "Brand and identity", service: "brand-identity" },
  { id: "colour_type_system", title: "Colour and type system", group: "Brand and identity", service: "brand-identity" },
  { id: "logo_file_pack", title: "Logo lockups and file pack", group: "Brand and identity", service: "brand-identity" },
  { id: "naming", title: "Naming and tagline options", group: "Brand and identity", service: "brand-identity" },
  { id: "logo_design", title: "Logo design", group: "Brand and identity", service: "brand-identity" },
  { id: "document_suite", title: "Document suite: letterhead, invoice, forms", group: "Documents and decks", service: "reports-documents" },
  { id: "document_reformat", title: "Reformat an existing file to brand", group: "Documents and decks", service: "reports-documents" },
  { id: "annual_report", title: "Annual and impact reports", group: "Documents and decks", service: "reports-documents" },
  { id: "content_calendar", title: "Monthly content calendar with designed posts", group: "Social and campaign", service: "social-ads" },
  { id: "campaign_kit", title: "Campaign kit across social, web, email and outdoor", group: "Social and campaign", service: "social-ads" },
  { id: "ad_variants", title: "Ad variants for testing", group: "Social and campaign", service: "social-ads" },
  { id: "logo_animation", title: "Logo animation", group: "Motion", service: "motion-video" },
  { id: "social_motion", title: "Short social motion cuts", group: "Motion", service: "motion-video" },
  { id: "animated_email", title: "Animated email headers and GIFs", group: "Motion", service: "motion-video" },
  { id: "feature_spot", title: "Product feature spots", group: "Motion", service: "motion-video" },
  { id: "event_kit", title: "Event branding kit: backdrop, badges, signage", group: "Events", service: "event-branding" },
  { id: "invite_rsvp", title: "Invitation and RSVP page", group: "Events", service: "event-branding" },
  { id: "booth_design", title: "Exhibition booth design", group: "Events", service: "event-branding" },
  { id: "landing_page", title: "Landing page", group: "Web", service: "web-product" },
  { id: "website_audit", title: "Website design audit", group: "Web", service: "web-product" },
  { id: "email_templates", title: "Email templates", group: "Web", service: "web-product" },
  { id: "print_preflight", title: "Print-ready checks and fixes", group: "Print", service: "print-merch" },
  { id: "print_templates", title: "Calendars, flyers and posters", group: "Print", service: "print-merch" },
  { id: "merch", title: "Merch mockups and tech packs", group: "Print", service: "print-merch" },
  { id: "design_critique", title: "Design critique", group: "Review", service: "" },
  { id: "accessibility_review", title: "Accessibility review", group: "Review", service: "web-product" },
];

export function catalogue(origin: string) {
  return {
    name: "Nka API",
    version: API_VERSION,
    docs: `${origin}/developers`,
    openapi: `${origin}/api/v1/openapi.json`,
    mcp: `${origin}/api/mcp`,
    live: ENDPOINTS.map((e) => ({
      id: e.id,
      title: e.title,
      summary: e.summary,
      returns: e.returns,
      method: "POST",
      url: `${origin}/api/v1/${e.path}`,
      credits: e.units,
    })),
    on_request: {
      how: `POST ${origin}/api/v1/requests with a service id and a brief. It arrives in your Nka workspace as a draft brief for the studio team; a person on your team sends it.`,
      services: ON_REQUEST.map((s) => ({ id: s.id, title: s.title, group: s.group })),
    },
  };
}
