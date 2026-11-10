// Site imagery. Photos set the scene; design pieces are examples made for invented brands to
// show the range of work, and are always captioned as examples. Swap in real client work
// (with the client's permission) by replacing a file in /public/img and its entry here.

export type Img = { src: string; alt: string; w: number; h: number };

const img = (name: string, w: number, h: number, alt: string): Img => ({ src: `/img/${name}.webp`, w, h, alt });

export const IMG = {
  desk: img("studio-desk", 1800, 1195, "A designer's desk with printed poster proofs, colour swatches and a laptop"),
  team: img("team-lagos", 1800, 1195, "Three colleagues in a Lagos office discussing printed campaign posters on a wall"),
  markup: img("markup", 1800, 1343, "Hands marking up a printed report with a red pencil"),
  meeting: img("meeting-london", 1800, 1195, "Two people in a London meeting room reviewing slides on a screen"),
  identity: img("identity-ebube", 1440, 1800, "Example brand identity for a coffee roaster: logo, cards, coffee bag and colour palette"),
  event: img("event-stage", 1799, 1017, "Example event branding: a conference stage with a large patterned backdrop"),
  report: img("report-lightpath", 1800, 1195, "Example annual report spread with photography and charts"),
  deck: img("deck-sundial", 1799, 1017, "Example pitch deck slides for a solar company, with charts and a map"),
  social: img("social-kora", 1800, 1800, "Example set of six social ads for a payments app"),
  motion: img("motion-launch", 1799, 1017, "Example still from a motion graphics advert reading Launch Week"),
  web: img("web-movi", 1799, 1017, "Example website and app screens for a delivery company"),
  packaging: img("packaging-ori", 1440, 1800, "Example skincare packaging: bottles, boxes and a tote bag"),
  poster: img("poster-uzo", 1195, 1800, "Example festival poster with large type and flowing line art on ochre"),
  billboard: img("billboard-harbour", 1799, 1017, "Example billboard advert for a bank on a busy Lagos street"),
  merch: img("merch-buildlagos", 1800, 1800, "Example conference merchandise: t-shirt, lanyard, tote bag and notebook"),
  brochure: img("brochure-amara", 1440, 1800, "Example brochure and flyers for a health clinic"),
};

const show = (name: string, w: number, h: number, alt: string): Img => ({ src: `/gallery/${name}.webp`, w, h, alt });

export const SERVICE_IMG: Record<string, Img> = {
  "brand-identity": show("identity", 1800, 1208, "Example stationery for an architecture practice: letterpress cards, letterhead and notebook"),
  "event-branding": show("stage", 1800, 1208, "Example event identity on a conference stage screen"),
  "reports-documents": show("report", 1800, 1208, "Example annual report for an education charity"),
  presentations: show("pitch", 1800, 1208, "Example Series A slide presented in a meeting room"),
  "social-ads": show("billboard", 1800, 1208, "Example savings-app billboard over a Lagos road"),
  "motion-video": show("motion", 1800, 1208, "Example motion ad on a station screen"),
  "web-product": show("website", 1800, 1208, "Example delivery company website on a laptop"),
  "print-merch": show("choco", 1200, 1490, "Example screen-printed chocolate wrappers"),
};

export const WALL: (Img & { caption: string })[] = [
  { ...IMG.poster, caption: "Festival poster" },
  { ...IMG.social, caption: "Social ad set" },
  { ...IMG.billboard, caption: "Outdoor advert" },
  { ...IMG.identity, caption: "Brand identity" },
  { ...IMG.deck, caption: "Pitch deck" },
  { ...IMG.merch, caption: "Event merchandise" },
  { ...IMG.brochure, caption: "Brochure and flyers" },
  { ...IMG.web, caption: "Website and app" },
  { ...IMG.packaging, caption: "Packaging" },
];
