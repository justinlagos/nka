// What the API offers, in five groups. A service is "live" once its pipeline is built and tested:
// it runs end to end with nobody involved. Until then it is "on request": a caller can ask for it
// through the API and it arrives in Nka as a brief for the team. The aim is for every service
// here to move to live, one tested pipeline at a time.
import type { Endpoint } from "./types.ts";
import { brandCheck } from "./endpoints/brand-check.ts";
import { brandGuidelines } from "./endpoints/brand-guidelines.ts";
import { documents } from "./endpoints/documents.ts";
import { ecards } from "./endpoints/ecards.ts";
import { socialTemplates } from "./endpoints/social-templates.ts";
import { brandAudit } from "./endpoints/brand-audit.ts";
import { colourTypeSystem } from "./endpoints/colour-type-system.ts";
import { logoPack } from "./endpoints/logo-pack.ts";
import { naming } from "./endpoints/naming.ts";
import { logoDesign } from "./endpoints/logo-design.ts";
import { GROUPS, type Group } from "./types.ts";

export const API_VERSION = "1.0.0";

export const ENDPOINTS: Endpoint[] = [
  brandGuidelines, brandAudit, colourTypeSystem, logoPack, naming, logoDesign, brandCheck,
  documents,
  socialTemplates,
  ecards,
];

export function endpointByPath(path: string): Endpoint | undefined {
  return ENDPOINTS.find((e) => e.path === path);
}
export function endpointById(id: string): Endpoint | undefined {
  return ENDPOINTS.find((e) => e.id === id);
}

// `service` is the Nka service the brief is filed under (see SERVICE_OPTIONS in lib/brief.ts).
export type OnRequest = { id: string; title: string; group: Group; service: string };

export const ON_REQUEST: OnRequest[] = [
  { id: "document_suite", title: "Document suite: letterhead, invoice, forms, templates", group: "Documents and decks", service: "reports-documents" },
  { id: "document_reformat", title: "Reformat an off-brand file to brand", group: "Documents and decks", service: "reports-documents" },
  { id: "annual_report", title: "Annual and impact reports", group: "Documents and decks", service: "reports-documents" },
  { id: "content_calendar", title: "Monthly content calendar with designed posts", group: "Social and campaign", service: "social-ads" },
  { id: "campaign_kit", title: "Campaign kit across social, web, email and outdoor", group: "Social and campaign", service: "social-ads" },
  { id: "ad_variants", title: "Ad variants for testing", group: "Social and campaign", service: "social-ads" },
  { id: "logo_animation", title: "Logo animation", group: "Motion", service: "motion-video" },
  { id: "social_motion", title: "Short social motion cuts from supplied assets", group: "Motion", service: "motion-video" },
  { id: "animated_email", title: "Animated email headers and GIFs", group: "Motion", service: "motion-video" },
  { id: "feature_spot", title: "Product feature spots from screen captures", group: "Motion", service: "motion-video" },
  { id: "event_kit", title: "Event branding kit: backdrop, badges, signage, lanyards", group: "Events", service: "event-branding" },
  { id: "invite_rsvp", title: "Invitation and RSVP page", group: "Events", service: "event-branding" },
  { id: "booth_design", title: "Exhibition booth design", group: "Events", service: "event-branding" },
];

export function catalogue(origin: string) {
  return {
    name: "Nka API",
    version: API_VERSION,
    docs: `${origin}/developers`,
    openapi: `${origin}/api/v1/openapi.json`,
    mcp: `${origin}/api/mcp`,
    groups: GROUPS,
    live: ENDPOINTS.map((e) => ({
      id: e.id,
      group: e.group,
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
