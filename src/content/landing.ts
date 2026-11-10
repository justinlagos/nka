// Homepage content. Every claim here is something the product does today.
// All pieces and photos are AI-made illustrations (Higgsfield) for invented brands. None is client work.

export type Pic = { src: string; alt: string; w: number; h: number };
const tall = (name: string, alt: string): Pic => ({ src: `/gallery/${name}.webp`, w: 1200, h: 1490, alt });
const wide = (name: string, alt: string): Pic => ({ src: `/gallery/${name}.webp`, w: 1800, h: 1208, alt });

export const SHOW = {
  choco: tall("choco", "Screen-printed chocolate wrappers for a Nigerian cocoa brand, on an oak table"),
  report: wide("report", "An open annual report for an education charity, with a classroom photo and a large figure"),
  coffee: tall("coffee", "Coffee bags, stacked cups, a stamp and loyalty cards on a café counter"),
  skincare: tall("skincare", "Skincare bottle, jar and carton on a stone ledge"),
  runa: wide("runa", "A running-brand poster campaign pasted on an east London wall, a runner passing"),
  social: wide("social", "Over the shoulder of a woman in a café looking at a bubble tea post on her phone"),
  website: wide("website", "Over the shoulder of a man using a delivery company's website on his laptop"),
  identity: wide("identity", "An architecture practice's stationery: letterpress cards, letterhead, notebook and stamp"),
  stage: wide("stage", "A conference stage with the event identity on screen, the audience taking photos"),
  magazine: tall("magazine", "A magazine held open on a feature about a Lagos founder"),
  team: wide("team", "Two designers laughing at a wall of printed poster proofs in a bright studio"),
  designer: wide("designer", "A designer smiling at her laptop in front of a wall of poster proofs"),
  pitch: wide("pitch", "A founder presenting a Series A slide to investors in a bright meeting room"),
  restaurant: tall("restaurant", "A Lagos restaurant's menu, coasters and matchbox on a wooden table"),
  books: tall("books", "A series of four paperback covers in bold flat colours on a shelf"),
  billboard: wide("billboard", "A savings-app billboard over a busy Lagos road at sunset"),
  merch: tall("merch", "A shopper at a streetwear pop-up wearing the label's t-shirt and tote"),
  signage: wide("signage", "Wayfinding signs and a large painted floor number in an office lobby"),
  motion: wide("motion", "A motion ad playing on a tall screen in a London railway station"),
  badges: tall("badges", "Conference badges, lanyards, programme and tote on a registration table"),
  // Colour studio shots
  vela: { src: "/gallery/vela.webp", w: 1200, h: 1500, alt: "Three phones showing screens from a health app, on mint" },
  pocketa: { src: "/gallery/pocketa.webp", w: 1200, h: 1500, alt: "A savings-app advert on a phone, on lime green" },
  boba: { src: "/gallery/boba.webp", w: 1200, h: 1500, alt: "Three phones showing bubble tea social adverts on a pastel stand" },
  ozo: { src: "/gallery/ozo.webp", w: 1200, h: 1500, alt: "Hoodie, cap and tote bag with a bubbly wordmark, on purple" },
  impact: { src: "/gallery/impact.webp", w: 1200, h: 1500, alt: "An annual report held open on bright blue" },
};
export type ShowKey = keyof typeof SHOW;

// The 3D hero. The first nine take the hand-placed opening slots, in order:
// top-left big, small, left small, bottom-left big, top-right small, top-right big, right small,
// centre-right small, bottom-right big.
export const SKY: { img: ShowKey; label: string; need: string }[] = [
  { img: "runa", label: "Campaign", need: "A poster and social campaign for our launch" },
  { img: "pocketa", label: "Paid social", need: "Social ads for our app launch" },
  { img: "books", label: "Book covers", need: "A series of book covers" },
  { img: "impact", label: "Annual report", need: "Our annual report" },
  { img: "vela", label: "App design", need: "Screens for our app" },
  { img: "stage", label: "Event branding", need: "Branding for our conference: stage, badges and social" },
  { img: "skincare", label: "Packaging", need: "Packaging for our skincare range" },
  { img: "boba", label: "Social campaign", need: "A set of social posts for a new product" },
  { img: "billboard", label: "Out of home", need: "A billboard campaign" },
  { img: "coffee", label: "Brand identity", need: "A brand identity for our café: logo, packaging and cups" },
  { img: "ozo", label: "Merchandise", need: "Merchandise for our brand" },
  { img: "website", label: "Website", need: "A new website for our company" },
  { img: "magazine", label: "Editorial", need: "A magazine feature layout" },
  { img: "choco", label: "Packaging", need: "Packaging for our chocolate range" },
  { img: "badges", label: "Event print", need: "Badges, programme and merch for our event" },
  { img: "identity", label: "Stationery", need: "Stationery and a brand guide" },
  { img: "pitch", label: "Pitch deck", need: "A pitch deck for our Series A" },
  { img: "restaurant", label: "Restaurant identity", need: "Menus and branding for our restaurant" },
  { img: "report", label: "Annual report", need: "Our annual report" },
  { img: "merch", label: "Merchandise", need: "Merchandise for our brand" },
  { img: "signage", label: "Signage", need: "Signage and wayfinding for our office" },
  { img: "social", label: "Social", need: "Social posts for a new product" },
  { img: "motion", label: "Motion", need: "A short motion ad for screens" },
];

export const STATS = [
  { figure: "1 min", label: "Three on-brand options from Instant, made by AI" },
  { figure: "2 days", label: "Typical first draft from your named designer" },
  { figure: "1", label: "Workspace for every brief, file, comment and invoice" },
  { figure: "0", label: "Hiring, notice periods or exit fees" },
];

// The problem, in the words people use, and what changes.
export const PAINS: { pain: string; fix: string }[] = [
  { pain: "Hiring takes months, and one designer can't do everything.", fix: "Start this week with a senior team that covers every discipline." },
  { pain: "Freelancers disappear, and quality changes from job to job.", fix: "One named designer leads your account, learns your brand and stays." },
  { pain: "Agencies quote for weeks and bill for every change.", fix: "One monthly price. Revisions included. Resizes free." },
  { pain: "AI tools give you a start, not a finished file.", fix: "Instant options in a minute, finished by a designer when it matters." },
];

export const PILLARS: { title: string; body: string; img: ShowKey; tint: string }[] = [
  {
    title: "One monthly plan",
    body: "Send as much as your plan runs at once. Pause in a quiet month, cancel any month.",
    img: "pitch",
    tint: "peach",
  },
  {
    title: "A named senior designer",
    body: "The same person leads your account and learns your brand. No new freelancer every month.",
    img: "designer",
    tint: "sky",
  },
  {
    title: "AI when it can't wait",
    body: "Instant makes three on-brand options in about a minute. Keep one or hand it to your designer.",
    img: "vela",
    tint: "mint",
  },
];

// One brand across every touchpoint: shows a system held together across formats.
export const STORIES: { brand: string; what: string; tags: string[]; big: ShowKey; small: ShowKey }[] = [
  { brand: "Runa", what: "A running brand's city campaign, from the street wall to the station screen.", tags: ["Campaign", "Out of home", "Motion"], big: "runa", small: "motion" },
  { brand: "Northlight Summit", what: "One identity across the main stage, the badges, the programme and the tote.", tags: ["Event branding", "Print", "Merchandise"], big: "stage", small: "badges" },
];

export const WALL: { img: ShowKey; label: string }[][] = [
  [
    { img: "identity", label: "Stationery" },
    { img: "magazine", label: "Editorial" },
    { img: "website", label: "Website" },
    { img: "coffee", label: "Brand identity" },
    { img: "vela", label: "App design" },
    { img: "impact", label: "Annual report" },
    { img: "billboard", label: "Out of home" },
    { img: "ozo", label: "Merchandise" },
    { img: "signage", label: "Signage" },
  ],
  [
    { img: "report", label: "Annual report" },
    { img: "books", label: "Book covers" },
    { img: "pitch", label: "Pitch deck" },
    { img: "skincare", label: "Packaging" },
    { img: "restaurant", label: "Restaurant identity" },
    { img: "pocketa", label: "Paid social" },
    { img: "choco", label: "Packaging" },
  ],
];

export const AUDIENCES: { id: string; tab: string; title: string; points: string[]; img: ShowKey; tint: string }[] = [
  {
    id: "agencies",
    tab: "Agencies",
    title: "Take on more work without hiring.",
    points: [
      "Send overflow or whole projects. Files come back ready to present as your own, with no Nka branding.",
      "One workspace per client, each with its own brand book, queue and library.",
      "Invite your account managers. Give clients view access without edit rights.",
    ],
    img: "team",
    tint: "lilac",
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
    img: "runa",
    tint: "peach",
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
    img: "pitch",
    tint: "mint",
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
    img: "signage",
    tint: "sky",
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
    tint: "butter",
  },
];

export const CAPABILITIES: { slug: string; name: string; line: string; img: ShowKey }[] = [
  { slug: "brand-identity", name: "Brand identity", line: "Logos, type, colour and the guideline that keeps them consistent.", img: "identity" },
  { slug: "social-ads", name: "Paid social and ads", line: "Campaigns made once and sized for every placement.", img: "billboard" },
  { slug: "presentations", name: "Pitch and sales decks", line: "Decks that make the case on the first read.", img: "pitch" },
  { slug: "print-merch", name: "Packaging and print", line: "Files a printer can use first time.", img: "choco" },
  { slug: "reports-documents", name: "Reports and documents", line: "Annual reports and briefs people finish reading.", img: "report" },
  { slug: "event-branding", name: "Event branding", line: "One look across the invite, the venue and the feed.", img: "badges" },
  { slug: "web-product", name: "Web and product", line: "Landing pages, websites and app screens, ready to build.", img: "website" },
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

// Ticks are what each option gives you as standard.
export const COMPARE = {
  cols: ["Start this week", "Every discipline", "Same designer", "AI options in a minute", "Fixed monthly price", "Cancel any month"],
  rows: [
    { name: "nka.studio", note: "Senior designers and AI on one plan, in one workspace.", marks: [1, 1, 1, 1, 1, 1], us: true },
    { name: "Hiring in-house", note: "Months to recruit, one person's skills and capacity.", marks: [0, 0, 1, 0, 1, 0] },
    { name: "Agencies", note: "Broad skills, but proposals, minimum terms and changing teams.", marks: [0, 1, 0, 0, 0, 0] },
    { name: "Freelancers", note: "Flexible, but availability and quality vary job to job.", marks: [0, 0, 0, 0, 0, 1] },
    { name: "AI tools alone", note: "Fast, but no designer to judge the work or finish it.", marks: [1, 0, 0, 1, 1, 1] },
  ],
};
