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
  website: wide("website", "Over the shoulder of a man using a delivery company's website on his laptop"),
  identity: wide("identity", "An architecture practice's stationery: letterpress cards, letterhead, notebook and stamp"),
  stage: wide("stage", "A conference stage with the event identity on screen, the audience taking photos"),
  magazine: tall("magazine", "A magazine held open on a feature about a Lagos founder"),
  team: wide("team", "Two designers laughing at a wall of printed poster proofs in a bright studio"),
  designer: wide("designer", "A designer smiling at her laptop in front of a wall of poster proofs"),
  pitch: wide("pitch", "A founder presenting a Series A slide to investors in a bright meeting room"),
  restaurant: tall("restaurant", "A Lagos restaurant's menu, coasters and matchbox on a wooden table"),
  books: tall("books", "A series of four paperback covers in bold flat colours on a shelf"),
  billboard: wide("billboard-lagos", "A savings-app billboard over a Lagos road at sunset"),
  merch: tall("merch", "A shopper at a streetwear pop-up wearing the label's t-shirt and tote"),
  signage: wide("signage", "Wayfinding signs and a large painted floor number in an office lobby"),
  motion: wide("runa-station", "A motion ad playing on a tall screen in a London railway station"),
  badges: tall("badges", "Conference badges, lanyards, programme and tote on a registration table"),
  // Colour studio shots
  vela: { src: "/gallery/vela.webp", w: 1200, h: 1500, alt: "Three phones showing screens from a health app, on mint" },
  pocketa: { src: "/gallery/pocketa.webp", w: 1200, h: 1500, alt: "A savings-app advert on a phone, on lime green" },
  boba: { src: "/gallery/boba.webp", w: 1200, h: 1500, alt: "Three phones showing bubble tea social adverts on a pastel stand" },
  ozo: { src: "/gallery/ozo.webp", w: 1200, h: 1500, alt: "Hoodie, cap and tote bag with a bubbly wordmark, on purple" },
  impact: { src: "/gallery/impact.webp", w: 1200, h: 1500, alt: "An annual report held open on bright blue" },
};
export type ShowKey = keyof typeof SHOW;

export const STATS = [
  { figure: "1 min", label: "Three on-brand options from Instant, made by AI" },
  { figure: "2 days", label: "Typical first draft from your team" },
  { figure: "1", label: "Workspace for every brief, file, comment and invoice" },
  { figure: "0", label: "Hiring, notice periods or exit fees" },
];

// The problem, in the words people use, and what changes. Each one shows the proof inside the product.
export const PAINS: {
  who: string;
  img: string;
  ask: string;
  usual: string;
  fix: string;
  proof: "date" | "designer" | "price" | "instant";
  tint: string;
}[] = [
  {
    who: "Marketing lead",
    img: "/gallery/people/marketing.webp",
    ask: "We need the launch ads in six sizes by Friday.",
    usual: "Wait for a freelancer to reply.",
    fix: "A delivery date the moment you send the brief.",
    proof: "date",
    tint: "peach",
  },
  {
    who: "Agency producer",
    img: "/gallery/people/agency.webp",
    ask: "Our last freelancer went quiet halfway through.",
    usual: "Brief someone new from scratch.",
    fix: "One team works on your account and stays: the same people every time.",
    proof: "designer",
    tint: "sky",
  },
  {
    who: "Founder",
    img: "/gallery/people/founder.webp",
    ask: "The agency quoted three weeks and charged for every change.",
    usual: "Pay again for each round.",
    fix: "One monthly price. Revisions included. Resizes free.",
    proof: "price",
    tint: "mint",
  },
  {
    who: "Social media manager",
    img: "/gallery/people/social.webp",
    ask: "AI gave us a start, not something we could post.",
    usual: "Fix it yourself at midnight.",
    fix: "Three options in about a minute, finished by a designer when it matters.",
    proof: "instant",
    tint: "lilac",
  },
];

// Who sends briefs, and the finished work that comes back. Ids are projects in projects.ts.
export const ROLES: { id: string; role: string; asks: string; need: string; img: string; get: string[] }[] = [
  { id: "marketing", role: "Marketing lead", asks: "Ads for every channel by Friday", need: "Launch ads for every channel, in all sizes", img: "/gallery/people/marketing.webp", get: ["boba", "runa"] },
  { id: "founder", role: "Founder", asks: "A deck and a site before the raise", need: "A pitch deck and a website for our raise", img: "/gallery/people/founder.webp", get: ["fernline", "haulo", "halden"] },
  { id: "agency", role: "Agency producer", asks: "Overflow work, under our name", need: "Overflow design work for our clients, white label", img: "/gallery/people/agency.webp", get: ["runa", "halden", "boba"] },
  { id: "events", role: "Events lead", asks: "Branding for the whole event", need: "Branding for our event: stage, badges and programme", img: "/gallery/people/events.webp", get: ["northlight"] },
  { id: "social", role: "Social media manager", asks: "Posts that move, in every size", need: "Animated social posts in every size", img: "/gallery/people/social.webp", get: ["boba", "runa"] },
  { id: "nonprofit", role: "Programme director", asks: "A report funders actually read", need: "Our annual report, for print and screen", img: "/gallery/people/nonprofit.webp", get: ["bright", "northlight"] },
  { id: "brand", role: "Brand manager", asks: "Packaging for the new range", need: "Packaging for our new product range", img: "/gallery/people/brand.webp", get: ["koko", "halden"] },
  { id: "owner", role: "Restaurant owner", asks: "A brand for opening night", need: "A brand for our restaurant: sign, menus and print", img: "/gallery/people/owner.webp", get: ["ewa", "koko"] },
];

export const OUTCOMES: { id: string; brand: string; title: string; img: string }[] = [
  { id: "boba", brand: "Boba Bay", title: "Launch posts in every size", img: "/gallery/stills/boba-key.webp" },
  { id: "runa", brand: "Runa", title: "A city campaign", img: "/gallery/stills/runa-billboard.webp" },
  { id: "fernline", brand: "Fernline", title: "A Series A deck", img: "/gallery/pitch.webp" },
  { id: "haulo", brand: "Haulo", title: "Website and app", img: "/gallery/stills/haulo-laptop.webp" },
  { id: "halden", brand: "Halden & Co", title: "A full identity", img: "/gallery/identity.webp" },
  { id: "northlight", brand: "Northlight Summit", title: "Stage, badges, programme", img: "/gallery/stage.webp" },
  { id: "bright", brand: "Bright Futures Fund", title: "An annual report", img: "/gallery/impact.webp" },
  { id: "koko", brand: "Koko Bloc", title: "Packaging for a range", img: "/gallery/choco.webp" },
  { id: "ewa", brand: "Ewa", title: "A restaurant brand", img: "/gallery/ewa-window.webp" },
];

// Who does the work. The photos are illustrations, said so on the page.
export const PEOPLE: { title: string; body: string; src: string; w: number; h: number; alt: string }[] = [
  {
    title: "One team, the same people every time",
    body: "A designer and a copywriter who learn your brand, with a creative lead on Growth and Studio. No new freelancer every month.",
    src: "/gallery/studio-present.webp",
    w: 1800,
    h: 1200,
    alt: "A designer presenting a colourful brand identity to a mixed team in a bright meeting room",
  },
  {
    title: "Every discipline on one plan",
    body: "Brand, print, digital, motion and presentations. Specialists join a brief when it needs them.",
    src: "/gallery/studio-desk.webp",
    w: 1800,
    h: 1200,
    alt: "A motion designer smiling at his desk, an animation open on his screen",
  },
  {
    title: "Reviewed in one place",
    body: "Comment on the file, approve in a click, and every approved size lands in your library.",
    src: "/gallery/studio-team.webp",
    w: 1800,
    h: 1200,
    alt: "A mixed team laughing around a table of laptops, prints and sticky notes",
  },
];

// What happens before anyone pays.
export const PRICE_STEPS: { title: string; body: string }[] = [
  {
    title: "Tell us what you need",
    body: "Start a project or book a demo. Add your website and your workspace opens in your brand, with the first brief written.",
  },
  {
    title: "Pick a plan",
    body: "Instant $19, Starter $149, Growth $399 or Studio $999 a month, or the same in naira or pounds. Each plan is a team and a monthly pool of team hours.",
  },
  {
    title: "Pay by card, then send briefs",
    body: "Checkout takes a minute. Try Instant free first; pause in a quiet month, cancel any month.",
  },
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
      "Studio: a full team with a marketing lead, on one fixed monthly price.",
      "Websites, rebrands and launches quoted as Bespoke, in writing, before work starts.",
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
  { title: "Instant or your team", body: "Three AI options in about a minute, or your team with the hours and a date shown on send." },
  { title: "Review on the file", body: "Click anywhere to pin a comment. Every version kept. Approve in one click." },
  { title: "Brand book from your website", body: "Logo, colours, fonts and tone read from your site and used in every brief." },
  { title: "Dates and hours, live", body: "Delivery dates, your on-time record and team hours left, always in view." },
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
