// What Nka makes. Timings are typical first-draft times for plan clients; the estimate
// on each project gives the real date.

export type Service = {
  slug: string;
  name: string;
  line: string;
  deliverables: string[];
  asks: string[];
  plans: string;
  firstDraft: string;
};

export const SERVICES: Service[] = [
  {
    slug: "brand-identity",
    name: "Brand identity",
    line: "Logos, colour, type and the guideline that keeps them consistent.",
    deliverables: [
      "Logo suite in every format and colourway",
      "Colour and type system with print and screen values",
      "Brand guideline as a PDF or a hosted web page",
      "Templates for letterheads, decks and social",
    ],
    asks: ["A new identity for a foundation", "An anniversary mark", "Tidying a logo that's drifted over the years"],
    plans: "Studio, or Bespoke for big projects",
    firstDraft: "Routes to review in about a week; full identity in 3 to 6 weeks",
  },
  {
    slug: "event-branding",
    name: "Event branding",
    line: "One look across the invitation, the venue and the feed.",
    deliverables: [
      "Key visual and event mark",
      "Booths, backdrops, roll-ups and signage built to the organiser's specs",
      "Badges, lanyards, tickets and wayfinding",
      "Invitations, RSVP pages and the social kit",
    ],
    asks: ["A conference booth", "A summit with a dozen sponsors", "An invite-only roundtable"],
    plans: "Studio, or Bespoke for big projects",
    firstDraft: "Key visual in 3 to 5 working days; production files on approval",
  },
  {
    slug: "reports-documents",
    name: "Reports and documents",
    line: "Annual reports, policy briefs and documents people actually finish reading.",
    deliverables: [
      "Report and booklet layout, print and accessible web PDF",
      "Policy briefs, technical briefs and briefing notes",
      "Charts and infographics drawn from your data",
      "Letterheads, forms and editable Word templates",
    ],
    asks: ["A 40-page annual report", "A two-page briefing note for a ministry", "A field trial report"],
    plans: "All plans",
    firstDraft: "Layout sample in 2 working days; full document by agreed date",
  },
  {
    slug: "presentations",
    name: "Presentations and pitch decks",
    line: "Decks that make the case on the first read.",
    deliverables: [
      "Pitch, proposal and conference decks",
      "Editable PowerPoint, Keynote or Google Slides",
      "Master templates your team can reuse",
      "Speaker notes and print handouts",
    ],
    asks: ["An investor deck", "A proposal to a government ministry", "A six-slide charter for a forum"],
    plans: "All plans",
    firstDraft: "First draft in 2 working days for most decks",
  },
  {
    slug: "social-ads",
    name: "Social and ad creative",
    line: "Campaign visuals made once and sized for every placement.",
    deliverables: [
      "Campaign key visual and copy lines",
      "Carousels, stories and feed posts",
      "Paid ad sets for Meta, LinkedIn and Google",
      "Email headers and website heroes to match",
    ],
    asks: ["A holiday offer across every channel", "A weekly quote carousel", "A LinkedIn campaign for a B2B launch"],
    plans: "All plans; paid ad sets from Growth",
    firstDraft: "First set in 2 working days",
  },
  {
    slug: "motion-video",
    name: "Motion and video",
    line: "Logo reveals, explainers and loops for screens and feeds.",
    deliverables: [
      "Logo reveals and animated marks",
      "Explainers and product walk-throughs",
      "Reels and cut-downs in every aspect ratio",
      "Looping screen content for booths and stages",
    ],
    asks: ["A logo reveal for Instagram", "A loop for booth screens", "A 60-second explainer"],
    plans: "Growth and Studio",
    firstDraft: "Storyboard or style frames in 3 working days",
  },
  {
    slug: "web-product",
    name: "Web and product design",
    line: "Landing pages, websites and app screens, designed and ready to build.",
    deliverables: [
      "Landing pages and full websites",
      "App and dashboard screens",
      "Design systems and component libraries",
      "Build handover in Figma, or built with our developers",
    ],
    asks: ["A landing page redesign", "A booking app's screens", "A company site"],
    plans: "Landing pages from Growth; full sites and apps as Bespoke",
    firstDraft: "First direction in 3 to 5 working days",
  },
  {
    slug: "print-merch",
    name: "Print, packaging and merch",
    line: "Files a printer can use first time, and merch people want to wear.",
    deliverables: [
      "Print-ready files with colour checks for CMYK",
      "T-shirts, stickers, tote bags and swag",
      "Packaging and labels",
      "Liaising with your printer on proofs",
    ],
    asks: ["Campaign t-shirts and stickers", "A product label", "Calendars and diaries"],
    plans: "All plans",
    firstDraft: "First draft in 2 working days",
  },
];

export function serviceBySlug(slug: string) {
  return SERVICES.find((s) => s.slug === slug);
}
