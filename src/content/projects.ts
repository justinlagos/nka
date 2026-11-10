// The portfolio as projects: each one is a small system of pieces, not a single picture.
// Every brand here is invented. The work is made by the studio to show its range (studio concepts),
// the workspace film shows the real product, and the people photos are illustrations.

export type Media =
  | { kind: "image"; src: string; sky: string; w: number; h: number; alt: string; derived?: boolean }
  | { kind: "film"; src: string; preview: string; poster: string; sky: string; w: number; h: number; alt: string; length: string };

export type ProjectKind = "concept" | "demo" | "photo";

export type Project = {
  id: string;
  brand: string;
  category: string;
  kind: ProjectKind;
  summary: string;
  made: string[];
  ask: string;
  need: string;
  media: Media[];
};

export const KIND_LABEL: Record<ProjectKind, string> = {
  concept: "Studio concept",
  demo: "Product demonstration",
  photo: "Illustrative photography",
};

const img = (name: string, w: number, h: number, alt: string): Media => ({
  kind: "image",
  src: `/gallery/${name}.webp`,
  sky: `/gallery/sky/${name}.webp`,
  w,
  h,
  alt,
});
const still = (name: string, alt: string): Media => ({
  kind: "image",
  src: `/gallery/stills/${name}.webp`,
  sky: `/gallery/stills/${name}.webp`,
  w: 1800,
  h: 1013,
  alt,
  derived: true, // a frame from the project's film: shown in the project, not floated in the sky
});
const film = (name: string, length: string, alt: string): Media => ({
  kind: "film",
  src: `/films/film-${name}.mp4`,
  preview: `/films/film-${name}-preview.mp4`,
  poster: `/films/film-${name}.jpg`,
  sky: `/films/film-${name}-sky.webp`,
  w: 1600,
  h: 900,
  alt,
  length,
});
const tall = (name: string, alt: string) => img(name, 1200, 1490, alt);
const wide = (name: string, alt: string) => img(name, 1800, 1208, alt);
const sq = (name: string, alt: string) => img(name, 1200, 1500, alt);
const photo = (name: string, alt: string) => img(name, 1800, 1200, alt);

export const PROJECTS: Project[] = [
  {
    id: "halden",
    brand: "Halden & Co",
    category: "Brand identity",
    kind: "concept",
    summary:
      "An identity for an architecture practice. The monogram is built like a doorway: two columns and a lintel. Forest green and blush carry it from the business card to the lobby wall.",
    made: ["Logo and monogram", "Colour and type", "Stationery", "Brand guidelines", "Signage and wayfinding"],
    ask: "Need an identity like this for your brand?",
    need: "A brand identity for our business: logo, stationery, guidelines and signage",
    media: [
      film("halden", "0:14", "Film: the Halden & Co identity, from the monogram to the guidelines and signage"),
      wide("identity", "Halden & Co stationery: letterpress cards, letterhead, notebook and stamp"),
      still("halden-tablet", "Halden & Co brand guidelines open on a tablet"),
      wide("signage", "Halden & Co wayfinding signs and a large painted floor number in the lobby"),
      still("halden-palette", "The Halden & Co palette and typefaces"),
    ],
  },
  {
    id: "runa",
    brand: "Runa",
    category: "Campaign",
    kind: "concept",
    summary:
      "A city campaign for a running brand. One kinetic key visual, made to work on a digital billboard, station screens, street posters and three social formats.",
    made: ["Key visual", "Digital billboard", "Station screens", "Street posters", "Social formats"],
    ask: "Need a campaign that works everywhere it runs?",
    need: "A launch campaign for billboards, posters, screens and social",
    media: [
      film("runa", "0:14", "Film: the Runa campaign in motion, on a London billboard, station screens and social"),
      still("runa-billboard", "The Runa key visual on a digital billboard on a wet London street"),
      wide("runa", "Runa posters pasted on an east London wall, a runner passing"),
      wide("motion", "The Runa motion ad on a tall screen in a London railway station"),
      still("runa-social", "Runa social posts in story, square and portrait sizes"),
    ],
  },
  {
    id: "northlight",
    brand: "Northlight Summit",
    category: "Event identity and presentation",
    kind: "concept",
    summary:
      "An identity for a conference, presented first as a proposal deck, then carried onto the main stage, the badges, the programme and the tote. One arc ties it together.",
    made: ["Proposal deck", "Stage screens", "Badges and lanyards", "Programme", "Tote bag"],
    ask: "Planning an event? We can brand all of it.",
    need: "Branding for our conference: stage screens, badges, programme and a presentation",
    media: [
      film("northlight", "0:13", "Film: the Northlight Summit identity presented to the organisers, then on stage"),
      still("northlight-room", "The Northlight Summit proposal on a meeting room screen"),
      wide("stage", "The Northlight Summit identity on the main stage screen, the audience taking photos"),
      tall("badges", "Northlight Summit badges, lanyards, programme and tote on the registration table"),
      still("northlight-deck", "The title slide of the Northlight Summit proposal"),
    ],
  },
  {
    id: "haulo",
    brand: "Haulo",
    category: "Website and app",
    kind: "concept",
    summary:
      "A website and tracking app for a same-day delivery service in Lagos. Book a pickup in a minute, follow the rider on the map, and get proof at the door.",
    made: ["Website", "Booking flow", "Tracking app", "Interface system"],
    ask: "Need a website or app designed?",
    need: "A website and app screens for our service",
    media: [
      film("haulo", "0:13", "Film: the Haulo website and tracking app in use"),
      still("haulo-laptop", "The Haulo website on a laptop at a sunny desk"),
      wide("website", "Over the shoulder of a man booking a delivery on the Haulo website"),
      still("haulo-phone", "The Haulo tracking app in a rider's hand"),
      still("haulo-app", "The Haulo tracking screen with the route, rider and arrival time"),
    ],
  },
  {
    id: "boba",
    brand: "Boba Bay",
    category: "Motion and social",
    kind: "concept",
    summary:
      "Animated launch posts for a bubble tea brand. One idea, built to move, then made in story, square, portrait and banner sizes.",
    made: ["Motion posts", "Stories", "Feed posts", "Banners"],
    ask: "Need social posts that move?",
    need: "Animated social posts for our new product, in every size",
    media: [
      film("boba", "0:12", "Film: Boba Bay launch posts in motion, in every size"),
      still("boba-stories", "Three Boba Bay stories: new flavour, buy one get one, open late"),
      sq("boba", "Three phones showing Boba Bay stories on a pastel stand"),
      still("boba-sizes", "The Boba Bay post in story, square, portrait and banner sizes"),
      wide("social", "Over the shoulder of a woman in a café looking at a Boba Bay post on her phone"),
    ],
  },
  {
    id: "workspace",
    brand: "The nka.studio workspace",
    category: "From brief to finished files",
    kind: "demo",
    summary:
      "How a brief moves through Nka. You say what you need, it becomes a brief with a delivery date, your designer makes it, you comment on the file, and every size lands in your library.",
    made: ["Brief by chat", "Delivery date on send", "Review on the file", "Every size in your library"],
    ask: "Try it with your own brief.",
    need: "",
    media: [film("workflow", "0:17", "Film: a brief for social ads going from a sentence to six finished sizes in the Nka workspace")],
  },
  {
    id: "kofi",
    brand: "Kofi Lab",
    category: "Café identity",
    kind: "concept",
    summary: "An identity for a coffee roaster: a stamp-like mark on bags, cups, loyalty cards and the takeaway cup people carry down the street.",
    made: ["Logo", "Coffee bags", "Cups", "Stamp and loyalty cards"],
    ask: "Opening something? Start with the brand.",
    need: "A brand identity for our café: logo, packaging and cups",
    media: [
      img("kofi-street", 1450, 1800, "A Kofi Lab takeaway cup held up on a London street"),
      tall("coffee", "Kofi Lab coffee bags, stacked cups, a stamp and loyalty cards on the counter"),
    ],
  },
  {
    id: "ewa",
    brand: "Ewa",
    category: "Restaurant identity",
    kind: "concept",
    summary: "A restaurant identity for Lagos: a hand-painted sign in the window, menus, coasters and matchboxes in the same deep green.",
    made: ["Shopfront sign", "Menus", "Coasters", "Matchboxes"],
    ask: "Need a restaurant brand like this?",
    need: "Branding for our restaurant: signage, menus and print",
    media: [
      img("ewa-front", 1800, 1208, "The Ewa restaurant front at dusk on a Lagos street, the window glowing"),
      tall("restaurant", "Ewa menus, coasters and a matchbox on a wooden table"),
    ],
  },
  {
    id: "pocketa",
    brand: "Pocketa",
    category: "App launch campaign",
    kind: "concept",
    summary: "A launch campaign for a savings app: a paid social ad that lands in the feed and a billboard over one of Lagos's busiest roads.",
    made: ["Paid social", "Billboard"],
    ask: "Launching an app? We'll make the campaign.",
    need: "A launch campaign for our app: social ads and a billboard",
    media: [
      sq("pocketa", "A Pocketa savings ad on a phone, on lime green"),
      wide("billboard", "A Pocketa billboard over a busy Lagos road at sunset"),
    ],
  },
  {
    id: "bright",
    brand: "Bright Futures Fund",
    category: "Annual report",
    kind: "concept",
    summary: "An annual report for an education charity, with the numbers set large enough to remember and photography that does the explaining.",
    made: ["Cover", "Data spreads", "Print and screen versions"],
    ask: "Got a report due?",
    need: "Our annual report, for print and screen",
    media: [
      sq("impact", "The Bright Futures Fund annual report held open on bright blue"),
      wide("report", "An open spread of the report with a classroom photo and a large figure"),
    ],
  },
  {
    id: "ozo",
    brand: "Ozo Club",
    category: "Merchandise",
    kind: "concept",
    summary: "A bubbly wordmark and a smiling sun, made for embroidery and screen print, then worn at the label's London pop-up.",
    made: ["Hoodie", "Cap", "Tote", "Pop-up signs"],
    ask: "Need merch people actually wear?",
    need: "Merchandise for our brand: t-shirts, hoodies and totes",
    media: [
      sq("ozo", "Ozo Club hoodie, cap and tote bag on purple"),
      tall("merch", "A shopper at the Ozo Club pop-up wearing the t-shirt and tote"),
    ],
  },
  {
    id: "vela",
    brand: "Vela",
    category: "App design",
    kind: "concept",
    summary: "Screens for a health app: habits, steps and meal plans, with one warm colour doing the work.",
    made: ["Onboarding", "Activity", "Meal plans"],
    ask: "Need app screens designed?",
    need: "Screens for our app",
    media: [sq("vela", "Three phones showing Vela health app screens, on mint")],
  },
  {
    id: "koko",
    brand: "Koko Bloc",
    category: "Packaging",
    kind: "concept",
    summary: "Wrappers for a Nigerian chocolate maker: a printed pattern per flavour, held together by one plain band.",
    made: ["Wrapper patterns", "Flavour bands"],
    ask: "Need packaging for your range?",
    need: "Packaging for our product range",
    media: [tall("choco", "Koko Bloc chocolate bars in patterned wrappers on linen")],
  },
  {
    id: "shelf",
    brand: "Chocolate range",
    category: "Packaging in the shop",
    kind: "concept",
    summary: "A geometric wrapper system that still reads from across a crowded shop.",
    made: ["Wrapper system"],
    ask: "Need packaging that stands out on the shelf?",
    need: "Packaging for our product range",
    media: [img("packaging-shelf", 1350, 1800, "Patterned chocolate bars on a shop shelf, a hand reaching for one")],
  },
  {
    id: "ori",
    brand: "Ori",
    category: "Packaging",
    kind: "concept",
    summary: "A quiet skincare range: bottle, jar and carton in one soft green.",
    made: ["Bottle", "Jar", "Carton"],
    ask: "Need packaging for your range?",
    need: "Packaging for our skincare range",
    media: [tall("skincare", "Ori skincare bottle, jar and carton on a stone ledge")],
  },
  {
    id: "fernline",
    brand: "Fernline",
    category: "Pitch deck",
    kind: "concept",
    summary: "A Series A deck that gets to the point by slide three.",
    made: ["Pitch deck"],
    ask: "Raising? Let's make the deck.",
    need: "A pitch deck for our funding round",
    media: [wide("pitch", "A founder presenting the Fernline Series A slide to investors")],
  },
  {
    id: "editorial",
    brand: "Built in Lagos",
    category: "Editorial",
    kind: "concept",
    summary: "A magazine feature on a new generation of Lagos founders: a big portrait, a confident serif and room to read.",
    made: ["Feature layout"],
    ask: "Need a magazine or report laid out?",
    need: "A magazine feature layout",
    media: [tall("magazine", "A magazine held open on a feature about a Lagos founder")],
  },
  {
    id: "books",
    brand: "Book series",
    category: "Covers",
    kind: "concept",
    summary: "Four covers for one publisher's series, each in its own colour, all clearly from the same shelf.",
    made: ["Cover series"],
    ask: "Need covers for a series?",
    need: "A series of book covers",
    media: [tall("books", "Four paperback covers in bold flat colours on a shelf")],
  },
  {
    id: "apparel",
    brand: "Apparel",
    category: "Clothing and bags",
    kind: "concept",
    summary: "A small emblem that works stitched on a sweatshirt and printed on a tote.",
    made: ["Sweatshirt", "Tote"],
    ask: "Need clothing designed for your brand?",
    need: "Branded clothing and bags",
    media: [img("apparel-street", 1200, 1800, "A woman laughing on the street in a moss sweatshirt with a small emblem, a tote on her shoulder")],
  },
  {
    id: "shoot",
    brand: "Campaign shoot",
    category: "Photography-led campaign",
    kind: "concept",
    summary: "A fashion campaign shot outdoors in Lagos against a painted wall, with the art direction worked out before anyone picked up a camera.",
    made: ["Art direction", "Campaign images"],
    ask: "Planning a campaign shoot?",
    need: "Art direction for a campaign shoot",
    media: [photo("campaign-shoot", "A fashion shoot against a painted wall in Lagos, the photographer crouching")],
  },
  {
    id: "studio",
    brand: "In the studio",
    category: "How the work gets made",
    kind: "photo",
    summary:
      "Proofs on the table, boards on the wall, timelines and print checks. Your brief goes to a senior designer who leads your account. AI makes quick first options and keeps the admin out of their way.",
    made: ["Art direction", "Presentation", "Motion", "Illustration", "Print checks"],
    ask: "Want a team like this on your work?",
    need: "",
    media: [
      photo("studio-proofs", "A creative director smiling at a long table of printed proofs"),
      photo("studio-motion", "A motion designer at work on an animation timeline"),
      photo("studio-boards", "Designers presenting printed brand boards to a client"),
      photo("studio-floor", "A team reviewing posters laid out on the studio floor"),
      photo("studio-wall", "A team reviewing slides pinned to the wall"),
      img("studio-illustration", 1800, 1350, "An illustrator's hands drawing on a tablet"),
      photo("studio-press", "A designer and a printer checking a press sheet"),
      photo("studio-swatches", "Two designers laughing over swatch books"),
      photo("studio-sketch", "A designer sketching monogram ideas in a café"),
      photo("studio-shoot", "Behind the scenes on a product photo shoot"),
      wide("team", "Two designers laughing at a wall of printed poster proofs"),
      wide("designer", "A designer smiling at her laptop in front of a wall of poster proofs"),
    ],
  },
];

export const PROJECT_BY_ID: Record<string, Project> = Object.fromEntries(PROJECTS.map((p) => [p.id, p]));

// Films first: these are the projects the guided tour and the case studies lead with.
export const FILM_PROJECTS = PROJECTS.filter((p) => p.media[0].kind === "film");
export const TOUR = ["halden", "runa", "haulo", "northlight"];
