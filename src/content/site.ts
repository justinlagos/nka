import { env } from "@/lib/env";

export const SITE = {
  name: "Nka",
  meaning: "Nka is Igbo for art, craft and skill.",
  tagline: "Your design team, on a monthly plan",
  description:
    "Nka is the design studio from MotionPlay Labs. Send a brief, get finished design back from a designer who knows your brand. For teams in the UK and Nigeria.",
  company: "MotionPlay Labs Ltd",
  companyNumber: "17304660",
  registered: "Registered in England and Wales",
};

// Set NEXT_PUBLIC_CONTACT_EMAIL and NEXT_PUBLIC_CONTACT_PHONE in the host; blank values are hidden.
export const CONTACT = {
  email: env.contactEmail,
  phone: env.contactPhone,
  phoneHref: env.contactPhone ? `tel:${env.contactPhone.replace(/[^\d+]/g, "")}` : "",
};

export const NAV = [
  { href: "/services", label: "Services" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
];

export const STEPS = [
  { title: "Brief", body: "Describe what you need in your own words. The brief assistant lays it out using your brand book." },
  { title: "Plan", body: "Your designer confirms scope and a delivery date. Any price is fixed before work starts." },
  { title: "Make", body: "The same designer works on your account every time. You see where every project stands." },
  { title: "Review", body: "Click on the file to comment exactly where a change goes. We revise until it meets the brief." },
  { title: "Keep", body: "Approved files land in your library. Other sizes and formats of them are free." },
];

// Each promise answers a common complaint about design subscriptions, and each is built into
// the workspace so a client can check it, not just read it.
export const PROMISES: { title: string; body: string; how: string }[] = [
  {
    title: "One team that knows your brand",
    body: "Not whoever is free this week. One team, the same people every time, on every brief.",
    how: "If someone ever changes, you get a written handover first.",
  },
  {
    title: "A price list, not a quote",
    body: "Fixed monthly prices, the same everywhere, in dollars, naira or pounds. No per-brief pricing.",
    how: "Each brief shows the team hours it uses before it starts. If it takes us longer, that's our cost.",
  },
  {
    title: "Checked before you see it",
    body: "Every version is checked by Nka before it reaches you. Generic or unedited AI work is sent back.",
    how: "Drafts appear in your workspace only after they pass.",
  },
  {
    title: "Dates you can check",
    body: "Every brief gets a delivery date. Miss the first draft date and that brief's hours come back to you.",
    how: "Each project shows the date and the day files arrived. Your on-time record is on your home page.",
  },
  {
    title: "Resizes are free",
    body: "Need the same design as a story, a banner and a print PDF? That's included.",
    how: "Ask from your library. It doesn't use team hours or a request slot.",
  },
  {
    title: "Leave when you like",
    body: "No notice period, no exit fee, no chasing. You keep everything we made for you.",
    how: "Cancel or pause from Billing in your workspace. Pausing stops charges for up to a month.",
  },
];

export const FAQ: { q: string; a: string }[] = [
  {
    q: "How much does it cost?",
    a: "Instant is $19 a month, Starter $149, Growth $399 and Studio $999, or the same value in naira or pounds. Yearly is 12 months for the price of 10. Websites, rebrands and launches are Bespoke, quoted after a call.",
  },
  {
    q: "What are team hours?",
    a: "Each plan has a monthly pool of hours that anyone on your team can use: 1 on Instant, 8 on Starter, 20 on Growth, 40 on Studio. When you send a brief you see the hours it uses, and that number is fixed. Unused hours carry into next month. Need more? Add 5 hours in one click.",
  },
  {
    q: "Who is on my team?",
    a: "Starter gives you a designer and a copywriter. Growth adds a creative lead who sets the look and approves every piece. Studio adds a marketing lead who plans the month with you, and motion. The same people every time.",
  },
  {
    q: "How fast is it?",
    a: "Small briefs get a first draft in 2 working days, medium ones in 3, and large ones by the date shown when you send them. If a first draft is late, that brief's hours come back to you.",
  },
  {
    q: "What if we don't like the first draft?",
    a: "Comment on the file itself and we revise until it meets the brief. Revisions don't use extra hours.",
  },
  {
    q: "Who does the work?",
    a: "Designers, copywriters and leads working for Nka through partner studios, matched to your market. The studio is led by Justin Ukaegbu, a brand and communication designer with more than ten years in agencies and in-house. Your contract is with Nka, and Nka checks every version before you see it.",
  },
  {
    q: "Can we pause or cancel?",
    a: "Yes, any month, from Billing in your workspace. No notice period and no exit fee. Pausing stops charges for up to a month; work already started is finished.",
  },
  {
    q: "We're in Nigeria. Can we pay?",
    a: "Yes. Plans are priced in naira and charged in naira by any major card through Stripe, so you see one fixed figure. Kenya, Ghana and the rest of Africa pay in dollars.",
  },
  {
    q: "Do you use AI?",
    a: "For Instant briefs and early directions, and to help write briefs. Work from your team is made by people and checked by Nka; no unedited AI output is delivered as finished work. You can turn AI off for any project.",
  },
  {
    q: "Who owns the work?",
    a: "You do. Approved files and their source files are yours once the month they were made in is paid.",
  },
  {
    q: "Can you work to procurement rules?",
    a: "Yes. We quote to the format a tender asks for, including UN agency and NGO procurement, and invoice from our UK or Nigerian company.",
  },
];
