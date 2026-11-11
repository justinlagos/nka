// The plans Nka sells (v3 team plans, decided 11 Nov 2026). Prices, hours, limits and promises live
// here and nowhere else: the pricing page, the billing page, Stripe checkout and the webhook all read
// this table. Team hours and Instant caps are mirrored in migration 0014 (plan_hours, instant_limit).

export type PlanId = "instant" | "starter" | "growth" | "studio";
export type OrgPlan = "none" | PlanId | "bespoke";
export type Currency = "usd" | "ngn" | "gbp";
export type Interval = "month" | "year";

export const CURRENCIES: Currency[] = ["usd", "ngn", "gbp"];

export type Plan = {
  id: PlanId;
  name: string;
  price: Record<Currency, number>;
  teamHours: number;
  extraLeadHours: number;
  activeLimit: number;
  instantBriefs: number;
  team: string;
  forWho: string;
  includes: string[];
  feature?: boolean;
};

export const PLANS: Plan[] = [
  {
    id: "instant",
    name: "Instant",
    price: { usd: 19, ngn: 25000, gbp: 14 },
    teamHours: 1,
    extraLeadHours: 0,
    activeLimit: 1,
    instantBriefs: 10,
    team: "A designer or a copywriter",
    forWho: "Small teams that want on-brand posts or copy fast.",
    includes: [
      "10 Instant briefs a month: three options in about a minute",
      "1 team hour to have a person finish an option",
      "Your brand book, brief assistant and file library",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    price: { usd: 149, ngn: 200000, gbp: 110 },
    teamHours: 8,
    extraLeadHours: 0,
    activeLimit: 1,
    instantBriefs: 20,
    team: "Designer and copywriter",
    forWho: "One steady stream of content.",
    includes: [
      "A designer and a copywriter, the same people every time",
      "8 team hours a month, one request at a time",
      "Every piece checked by Nka before you see it",
      "20 Instant briefs a month",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    price: { usd: 399, ngn: 540000, gbp: 299 },
    teamHours: 20,
    extraLeadHours: 0,
    activeLimit: 2,
    instantBriefs: 30,
    team: "Designer, copywriter and creative lead",
    forWho: "Startups running campaigns every month.",
    feature: true,
    includes: [
      "Everything in Starter",
      "A creative lead who sets the look and approves every piece",
      "20 team hours a month, two requests at a time",
      "30 Instant briefs a month",
    ],
  },
  {
    id: "studio",
    name: "Studio",
    price: { usd: 999, ngn: 1350000, gbp: 745 },
    teamHours: 40,
    extraLeadHours: 8,
    activeLimit: 3,
    instantBriefs: 50,
    team: "The Growth team plus a marketing lead and motion",
    forWho: "Founders who want marketing taken off their plate.",
    includes: [
      "Everything in Growth, plus motion and video",
      "A marketing lead for 8 hours a month: plans the month, writes the briefs, reports back",
      "40 team hours a month, three requests at a time",
      "50 Instant briefs a month",
    ],
  },
];

// Extra team hours, bought in one click.
export const TOP_UP = {
  hours: 5,
  price: { usd: 90, ngn: 120000, gbp: 67 } as Record<Currency, number>,
  lookupKey: "nka_hours_5_v3",
};

// Yearly: 12 months for the price of 10.
export const YEARLY_MONTHS = 10;

// What every plan keeps.
export const EVERY_PLAN = [
  "One team, the same people every time",
  "Revisions until the brief is met",
  "Free resizes of approved work",
  "Pause or cancel any month",
];

export const BESPOKE = {
  name: "Bespoke",
  forWho: "Websites, rebrands, launches and tenders.",
  includes: ["Scope, team and dates agreed on a call", "Quoted in writing before work starts"],
};

export function planById(id: string | null | undefined): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

export function lookupKey(planId: PlanId, interval: Interval): string {
  return `nka_${planId}_${interval === "year" ? "yearly" : "monthly"}_v3`;
}

export function planByLookupKey(key: string | null | undefined): Plan | undefined {
  if (!key) return undefined;
  return PLANS.find((p) => key === lookupKey(p.id, "month") || key === lookupKey(p.id, "year"));
}

export function priceFor(plan: Plan, currency: Currency, interval: Interval = "month"): number {
  return plan.price[currency] * (interval === "year" ? YEARLY_MONTHS : 1);
}

export function isCurrency(v: unknown): v is Currency {
  return v === "usd" || v === "ngn" || v === "gbp";
}

// Nigeria pays in naira, the UK in pounds, everyone else in dollars.
export function currencyForCountry(country: string | null | undefined): Currency {
  const c = (country ?? "").trim().toLowerCase();
  if (c === "ng" || c === "nigeria") return "ngn";
  if (c === "gb" || c === "uk" || c === "united kingdom" || c === "great britain") return "gbp";
  return "usd";
}

export function onPlan(plan: string | null | undefined, status: string | null | undefined): boolean {
  return Boolean(plan && planById(plan) && (status === "active" || status === "trialing"));
}

export function hasCardPlan(plan: string | null | undefined, status: string | null | undefined): boolean {
  return Boolean(plan && planById(plan) && ["active", "trialing", "past_due", "paused"].includes(status ?? ""));
}

export function planLabel(plan: OrgPlan | string): string {
  if (plan === "bespoke") return "Bespoke";
  if (plan === "none") return "No plan";
  return planById(plan)?.name ?? plan;
}

// Stripe subscription status to the status Nka stores.
export function planStatusFromStripe(status: string): "active" | "trialing" | "past_due" | "canceled" | "paused" | "inactive" {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "paused":
      return "paused";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    default:
      return "inactive";
  }
}
