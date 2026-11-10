// Homepage content. Every claim here is something the product does today.
// All pieces and photos are AI-made illustrations (Higgsfield) for invented brands. None is client work.

export type Pic = { src: string; alt: string; w: number; h: number };
const tall = (name: string, alt: string): Pic => ({ src: `/show/${name}.webp`, w: 1200, h: 1500, alt });
const wide = (name: string, alt: string): Pic => ({ src: `/show/${name}.webp`, w: 1800, h: 1195, alt });

export const SHOW = {
  report: tall("report", "Annual report for a children's education charity, held open on blue"),
  choco: tall("choco", "Chocolate bar packaging with bold geometric patterns, on orange"),
  fintech: tall("fintech", "A savings app advert on a phone, on lime green"),
  skincare: tall("skincare", "Skincare bottles, jar and tube with coral labels, on sky blue"),
  coffee: tall("coffee", "Coffee cups, bag, loyalty card and stickers for a roaster, on teal"),
  summit: tall("summit", "Conference lanyards, programme and tote bag, on yellow"),
  ebook: tall("ebook", "An illustrated ebook cover on a tablet"),
  shoebox: tall("shoebox", "A pink running-shoe box with tissue and swing tag"),
  merch: tall("merch", "Hoodie, cap and tote bag with a bubbly wordmark, on purple"),
  appscreens: tall("appscreens", "Three phones showing screens from a health app, on mint"),
  magazine: tall("magazine", "An open magazine spread about a Lagos founder, on red"),
  social: tall("social", "Three phones showing bubble tea social adverts on a pastel stand"),
  team: wide("team", "A marketing team reviewing colourful printed proofs on a wall"),
  designer: wide("designer", "A designer working on a bright poster at a large monitor"),
  billboard: wide("billboard", "A running-brand billboard on a sunny London street"),
  stage: wide("stage", "A conference stage with a large branded screen and audience"),
  pitch: wide("pitch", "Founders presenting a Series A deck in a bright meeting room"),
  identity: wide("identity", "A full brand identity flat lay: cards, letterhead, notebook and tote"),
  website: wide("website", "A delivery company's website and app on a laptop and phone"),
  launch: wide("launch", "A 3D motion graphics frame reading Launch Week"),
  shelter: wide("shelter", "A chocolate advert in a Lagos bus shelter, people walking past"),
  restaurant: wide("restaurant", "A Lagos restaurant identity: menus, coasters, bag and napkins"),
  founder: wide("founder", "Two founders in a Lagos co-working space looking at an app design"),
};
export type ShowKey = keyof typeof SHOW;

// Hero: three columns drifting at different speeds.
export const HERO_COLS: { img: ShowKey; label: string }[][] = [
  [
    { img: "choco", label: "Packaging" },
    { img: "report", label: "Annual report" },
    { img: "merch", label: "Merchandise" },
    { img: "appscreens", label: "App design" },
  ],
  [
    { img: "fintech", label: "Paid social" },
    { img: "summit", label: "Event branding" },
    { img: "ebook", label: "Ebook" },
    { img: "shoebox", label: "Packaging" },
  ],
  [
    { img: "coffee", label: "Brand identity" },
    { img: "social", label: "Social campaign" },
    { img: "skincare", label: "Packaging" },
    { img: "magazine", label: "Editorial" },
  ],
];

export const CHIPS: { label: string; img: ShowKey }[] = [
  { label: "Ad creative", img: "fintech" },
  { label: "Social campaigns", img: "social" },
  { label: "Pitch decks", img: "pitch" },
  { label: "Brand identity", img: "identity" },
  { label: "Packaging", img: "choco" },
  { label: "Annual reports", img: "report" },
  { label: "Event branding", img: "summit" },
  { label: "Out of home", img: "billboard" },
  { label: "Websites", img: "website" },
  { label: "App screens", img: "appscreens" },
  { label: "Motion", img: "launch" },
  { label: "Editorial", img: "magazine" },
  { label: "Merchandise", img: "merch" },
  { label: "Ebooks", img: "ebook" },
];

export const STATS = [
  { figure: "1 min", label: "Three on-brand options from Instant, made by AI" },
  { figure: "2 days", label: "Typical first draft from your named designer" },
  { figure: "1", label: "Workspace for every brief, file, comment and invoice" },
  { figure: "0", label: "Hiring, notice periods or exit fees" },
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
    img: "appscreens",
    tint: "mint",
  },
];

// One brand, every touchpoint: shows a system held together across formats.
export const STORIES: { brand: string; what: string; tags: string[]; big: ShowKey; small: ShowKey }[] = [
  { brand: "Runa", what: "A running brand's launch, from the box to the billboard.", tags: ["Campaign", "Out of home", "Packaging"], big: "billboard", small: "shoebox" },
  { brand: "Koko Bloc", what: "A Nigerian chocolate range, on the shelf and on the street.", tags: ["Packaging", "Out of home", "Brand identity"], big: "shelter", small: "choco" },
  { brand: "Northlight Summit", what: "One look across badges, print, merch and the main stage.", tags: ["Event branding", "Print", "Merchandise"], big: "stage", small: "summit" },
];

export const WALL: { img: ShowKey; label: string }[][] = [
  [
    { img: "identity", label: "Brand identity" },
    { img: "magazine", label: "Editorial" },
    { img: "website", label: "Website" },
    { img: "coffee", label: "Brand identity" },
    { img: "restaurant", label: "Restaurant identity" },
    { img: "merch", label: "Merchandise" },
    { img: "launch", label: "Motion" },
  ],
  [
    { img: "report", label: "Annual report" },
    { img: "pitch", label: "Pitch deck" },
    { img: "skincare", label: "Packaging" },
    { img: "billboard", label: "Out of home" },
    { img: "social", label: "Social campaign" },
    { img: "stage", label: "Event branding" },
    { img: "ebook", label: "Ebook" },
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
    img: "billboard",
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
    img: "founder",
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
    img: "pitch",
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
  { slug: "social-ads", name: "Paid social and ads", line: "Campaigns made once and sized for every placement.", img: "social" },
  { slug: "presentations", name: "Pitch and sales decks", line: "Decks that make the case on the first read.", img: "pitch" },
  { slug: "print-merch", name: "Packaging and print", line: "Files a printer can use first time.", img: "choco" },
  { slug: "reports-documents", name: "Reports and documents", line: "Annual reports and briefs people finish reading.", img: "report" },
  { slug: "event-branding", name: "Event branding", line: "One look across the invite, the venue and the feed.", img: "stage" },
  { slug: "web-product", name: "Web and product", line: "Landing pages, websites and app screens, ready to build.", img: "website" },
  { slug: "motion-video", name: "Motion and video", line: "Logo reveals, explainers and loops for screens and feeds.", img: "launch" },
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
