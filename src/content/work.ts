// Selected work by the MotionPlay Labs studio team.
// Before going live: confirm each client is happy to be named, and add images in /public/work.
// Set `show: false` to hide an entry without deleting it.

export type WorkItem = {
  slug: string;
  client: string;
  project: string;
  services: string[];
  summary: string;
  made: string[];
  show: boolean;
};

export const WORK: WorkItem[] = [
  {
    slug: "syntech-biofuel",
    client: "Syntech Biofuel",
    project: "Reports, briefing notes and a fleet campaign",
    services: ["reports-documents", "presentations", "social-ads"],
    summary:
      "Ongoing design for a UK biofuel maker: field trial reports, a briefing note for the Department for Transport, a leadership charter deck and a LinkedIn campaign for contractors.",
    made: ["1 Million Litres report, PDF and PowerPoint", "Department for Transport briefing note", "Six-slide leadership charter", "Campaign hero, 8-slide carousel and 3 ads"],
    show: true,
  },
  {
    slug: "solina-15",
    client: "Solina Group",
    project: "Solina @15 anniversary identity",
    services: ["brand-identity", "event-branding"],
    summary: "An identity system for the group's fifteenth anniversary, built to run across events and communications.",
    made: ["Anniversary mark", "Identity system and applications"],
    show: true,
  },
  {
    slug: "cirquu-moonshot",
    client: "Cirquu",
    project: "Moonshot 2026 booth and campaign",
    services: ["event-branding", "motion-video", "print-merch", "web-product"],
    summary:
      "Booth branding for TechCabal's Moonshot conference, built to the organiser's shell-scheme spec, plus merch, a logo reveal, a looping screen video and a landing page redesign.",
    made: ["3 m x 3 m booth, every surface", "T-shirts and stickers", "Logo reveal and booth loop", "Landing page redesign"],
    show: true,
  },
  {
    slug: "route-to-zero",
    client: "Route to Zero",
    project: "Brand guideline and roundtable invitation",
    services: ["brand-identity", "event-branding"],
    summary:
      "A hosted brand guideline, then the email invitation and RSVP page for a private procurement roundtable in Inverness.",
    made: ["Web brand guideline", "Email invitation", "RSVP event page"],
    show: true,
  },
  {
    slug: "jme-foundation",
    client: "JaneMichael Ekanem Foundation",
    project: "Identity, documents and a weekly social series",
    services: ["brand-identity", "reports-documents", "social-ads"],
    summary:
      "The logo and brand book for a Lagos scholarship foundation, its formal document suite for partner schools, and a weekly Instagram quote carousel.",
    made: ["Logo and web brand book", "Profile, handbook, proposal and letters", "Weekly 5-slide carousels"],
    show: true,
  },
  {
    slug: "black-diamond",
    client: "Black Diamond Hotel",
    project: "The Beauty of Freedom",
    services: ["social-ads"],
    summary: "An Independence Day offer for the hotel and its spa, produced for every channel from one key visual.",
    made: ["Instagram feed and stories", "Facebook", "Website hero", "Email newsletter"],
    show: true,
  },
];

export const visibleWork = () => WORK.filter((w) => w.show);
