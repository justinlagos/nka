// Homepage content. Every claim here is something the product does today.
// Images are AI-made illustrations (Higgsfield); none of them is client work.

export type Pic = { src: string; alt: string; w: number; h: number };
const pic = (name: string, w: number, h: number, alt: string): Pic => ({ src: `/lp/${name}.webp`, w, h, alt });

export const LP_IMG = {
  director: pic("director", 1440, 1800, "A creative director studying a wall of printed campaign posters"),
  agency: pic("agency", 1800, 1195, "An agency team reviewing a client presentation late in the evening"),
  founders: pic("founders", 1800, 1195, "Two founders reviewing a pitch deck in a Lagos co-working space"),
  marketing: pic("marketing", 1800, 1195, "A marketing manager checking a social advert on her phone"),
  identity: pic("identity", 1800, 1343, "A brand identity system: letterhead, cards, notebook and signage"),
  billboard: pic("billboard", 1799, 1017, "A typographic billboard campaign on a city street at dusk"),
  phones: pic("phones", 1800, 1800, "Three phones showing a set of social adverts"),
  boardroom: pic("boardroom", 1799, 1017, "A pitch deck presented on a boardroom screen"),
  report: pic("report", 1800, 1195, "An open annual report with charts and photography"),
  stage: pic("stage", 1799, 1017, "A conference stage with a large branded backdrop"),
  packaging: pic("packaging", 1440, 1800, "Product packaging: bottles, boxes and a tote bag"),
  web: pic("web", 1799, 1017, "A website and app shown on a laptop and phone"),
  motion: pic("motion", 1799, 1017, "A still from a motion graphics advert"),
  designer: pic("designer", 1800, 1195, "A designer refining a poster layout on a large monitor"),
  options: pic("options", 1800, 1195, "Three poster options for a coffee brand pinned side by side"),
  nightshift: pic("nightshift", 1440, 1800, "A festival poster lit up in a bus shelter at night"),
  editorial: pic("editorial", 1800, 1195, "An open magazine spread with a portrait and a bold headline"),
  merch: pic("merch", 1440, 1800, "Branded merchandise: hoodie, cap, tote bag, pin and stickers"),
  menu: pic("menu", 1800, 1195, "A restaurant identity: menus, coasters, takeaway bag and window lettering"),
  infographic: pic("infographic", 1440, 1440, "A large printed infographic about clean water access"),
  wayfinding: pic("wayfinding", 1800, 1195, "Wayfinding signage in a modern office lobby"),
};

export const WALL: { img: keyof typeof LP_IMG; label: string }[][] = [
  [
    { img: "identity", label: "Brand identity" },
    { img: "nightshift", label: "Out of home" },
    { img: "boardroom", label: "Pitch deck" },
    { img: "menu", label: "Restaurant identity" },
    { img: "phones", label: "Paid social" },
    { img: "infographic", label: "Information design" },
    { img: "web", label: "Website" },
    { img: "packaging", label: "Packaging" },
  ],
  [
    { img: "editorial", label: "Editorial" },
    { img: "motion", label: "Motion" },
    { img: "merch", label: "Merchandise" },
    { img: "report", label: "Annual report" },
    { img: "billboard", label: "Campaign" },
    { img: "wayfinding", label: "Signage" },
    { img: "stage", label: "Event branding" },
    { img: "options", label: "Instant options" },
  ],
];

export const MARQUEE = [
  "Pitch decks",
  "Brand identities",
  "Paid social",
  "Annual reports",
  "Event branding",
  "Packaging",
  "Motion graphics",
  "Websites",
  "Sales decks",
  "Email design",
  "Billboards",
  "Product screens",
];

export const STATS = [
  { figure: "1 min", label: "Instant options, made by AI in your brand" },
  { figure: "2 days", label: "Typical first draft from your designer" },
  { figure: "1", label: "Named designer who knows your brand" },
  { figure: "0", label: "Hiring, notice periods or exit fees" },
];

export const AUDIENCES: { id: string; tab: string; title: string; points: string[]; img: keyof typeof LP_IMG }[] = [
  {
    id: "agencies",
    tab: "Agencies",
    title: "Take on more work without hiring.",
    points: [
      "Send overflow or whole projects. Files come back ready to present as your own, with no Nka branding.",
      "One workspace per client, each with its own brand book, queue and library.",
      "Invite your account managers. Give clients view access without edit rights.",
    ],
    img: "agency",
  },
  {
    id: "marketing",
    tab: "Marketing teams",
    title: "Every campaign out on time, on brand.",
    points: [
      "Brief once, get every size. Resizes and new formats are free and don't use a request slot.",
      "Your brand book is read from your website and applied to every brief.",
      "Pin comments on the file, approve in a click, keep every version.",
    ],
    img: "marketing",
  },
  {
    id: "startups",
    tab: "Startups",
    title: "Look like the company you're becoming.",
    points: [
      "Investor decks, launch campaigns, product screens and a brand that holds together.",
      "Need it today? Instant gives you three on-brand options in about a minute.",
      "Pause in a quiet month instead of paying for it.",
    ],
    img: "founders",
  },
  {
    id: "enterprise",
    tab: "Enterprise",
    title: "A design department on a budget you control.",
    points: [
      "Flex: a monthly budget you spend on any service, with every project priced before it starts.",
      "Fixed prices, live spend, and unused budget that carries over for 12 months.",
      "Invoiced from our UK or Nigerian company, to the procurement rules you work under.",
    ],
    img: "boardroom",
  },
  {
    id: "nonprofits",
    tab: "Non-profits",
    title: "Reports and campaigns funders take seriously.",
    points: [
      "Annual reports, policy briefs, donor decks and event branding.",
      "Quotes in the format a tender asks for, including UN agency and NGO procurement.",
      "Documents built for print and screen, ready to share the day they're approved.",
    ],
    img: "report",
  },
];

export const CAPABILITIES: { slug: string; name: string; line: string; img: keyof typeof LP_IMG }[] = [
  { slug: "brand-identity", name: "Brand identity", line: "Logos, type, colour and the guideline that keeps them consistent.", img: "identity" },
  { slug: "social-ads", name: "Paid social and ads", line: "Campaigns made once and sized for every placement.", img: "phones" },
  { slug: "presentations", name: "Pitch and sales decks", line: "Decks that make the case on the first read.", img: "boardroom" },
  { slug: "print-merch", name: "Packaging and print", line: "Files a printer can use first time.", img: "packaging" },
  { slug: "reports-documents", name: "Reports and documents", line: "Annual reports and briefs people finish reading.", img: "report" },
  { slug: "event-branding", name: "Event branding", line: "One look across the invite, the venue and the feed.", img: "stage" },
  { slug: "web-product", name: "Web and product", line: "Landing pages, websites and app screens, ready to build.", img: "web" },
  { slug: "motion-video", name: "Motion and video", line: "Logo reveals, explainers and loops for screens and feeds.", img: "motion" },
];

export const FEATURES = [
  { title: "Brief by talking", body: "Type or say what you need. Nka asks two quick questions at most, then writes the brief." },
  { title: "Instant or Designer", body: "Three AI options in about a minute, or your named designer with a date shown on send." },
  { title: "Review on the file", body: "Click anywhere to pin a comment. Every version kept. Approve in one click." },
  { title: "Brand book from your website", body: "Logo, colours, fonts and tone read from your site and used in every brief." },
  { title: "Dates and spend, live", body: "Agreed dates, on-time record, and budget left, always in view." },
  { title: "Library and free resizes", body: "Every approved file in one place. Tap the sizes you need; your designer makes them." },
];
