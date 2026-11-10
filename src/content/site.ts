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
    title: "One designer who knows your brand",
    body: "Not whoever is free this week. One lead designer works on your account and on every brief.",
    how: "The same designer every time. If that ever changes, you get a written handover first.",
  },
  {
    title: "Prices that don't creep",
    body: "Anything priced is priced before work starts. If it takes us longer than we said, that's our cost.",
    how: "The approved price is locked in your workspace. It can't change without your sign-off.",
  },
  {
    title: "Resizes are free",
    body: "Need the same design as a story, a banner and a print PDF? That's included, every time.",
    how: "Ask from your library. It goes straight to your designer and doesn't use a request slot.",
  },
  {
    title: "Dates you can check",
    body: "Every project gets a delivery date. We show you whether we hit it.",
    how: "Each project shows the agreed date and the day files arrived. Your on-time record is on your home page.",
  },
  {
    title: "Leave when you like",
    body: "Monthly. No notice period, no exit fee, no chasing. You keep everything we made for you.",
    how: "Cancel or pause from Billing in your workspace. Pausing stops charges for up to a month.",
  },
  {
    title: "Unused budget is yours",
    body: "On Flex, budget you don't use carries over. If you leave, we pay back what's left.",
    how: "Budget, spend and what's left are shown live, with every entry listed.",
  },
];

export const FAQ: { q: string; a: string }[] = [
  {
    q: "How much does it cost?",
    a: "It depends on how much design you need running at once, so we agree it on a short call. You'll get a monthly figure in writing before you pay anything, and it won't change without your agreement.",
  },
  {
    q: "What counts as one request?",
    a: "One clear piece of work: a deck, a report layout, a set of social posts for one campaign. Big jobs like a full identity are split into stages. Other sizes and formats of finished work don't count.",
  },
  {
    q: "How fast is it?",
    a: "Most requests get a first draft in about 2 working days. Larger work gets a dated plan before anything starts, and you can see if we're on time.",
  },
  {
    q: "What if we don't like the first draft?",
    a: "Comment on the file itself and we revise until it meets the brief. If a draft misses the brief, tell us; your designer redoes it and it doesn't count against you.",
  },
  {
    q: "Who does the work?",
    a: "One lead designer works on your account. The studio is led by Justin Ukaegbu, a brand and communication designer with more than ten years in agencies and in-house. Specialists join for motion, illustration or development when a project needs them, under your lead designer.",
  },
  {
    q: "Can we pause or cancel?",
    a: "Yes, any month, from Billing in your workspace. No notice period and no exit fee. Pausing stops charges for up to a month; work already started is finished.",
  },
  {
    q: "We're in Nigeria. Can we pay?",
    a: "Yes. We take any major debit or credit card through Stripe. If you'd rather be invoiced, or pay in naira, say so on the demo call.",
  },
  {
    q: "Do you use AI?",
    a: "Where it helps and you allow it: drafting briefs, early concepts, resizing. Every file is designed and checked by a person. You can turn AI off for any project.",
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
