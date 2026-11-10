// The plans Nka sells. Prices, limits and promises live here and nowhere else:
// the pricing page, the billing page, Stripe checkout and the webhook all read this table.

export type PlanId = "starter" | "growth" | "studio";
export type OrgPlan = "none" | PlanId | "flex" | "bespoke";

export type Plan = {
  id: PlanId;
  name: string;
  monthlyGbp: number;
  activeLimit: number;
  lookupKey: string;
  forWho: string;
  firstDraft: string;
  includes: string[];
};

export const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    monthlyGbp: 1500,
    activeLimit: 1,
    lookupKey: "nka_starter_monthly_gbp",
    forWho: "One steady stream of design for a small team.",
    firstDraft: "First draft in 2 working days for most requests",
    includes: [
      "One request in progress at a time, unlimited in the queue",
      "Social posts, presentations, reports, print, documents",
      "Revisions until the brief is met",
      "Brand book, brief assistant, review and file library",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    monthlyGbp: 3000,
    activeLimit: 2,
    lookupKey: "nka_growth_monthly_gbp",
    forWho: "For teams running campaigns every month.",
    firstDraft: "First draft in 2 working days for most requests",
    includes: [
      "Two requests in progress at a time",
      "Everything in Starter",
      "Motion graphics and ad creative in every size",
      "Landing page and email design",
    ],
  },
  {
    id: "studio",
    name: "Studio",
    monthlyGbp: 6000,
    activeLimit: 4,
    lookupKey: "nka_studio_monthly_gbp",
    forWho: "A full design team without the hiring.",
    firstDraft: "First draft in 1 to 2 working days, priority queue",
    includes: [
      "Four requests in progress at a time",
      "Everything in Growth",
      "Brand identity, event branding, web and product design",
      "A creative director and kickoff calls on request",
    ],
  },
];

export const FLEX = {
  name: "Flex",
  fromGbp: 5000,
  rolloverMonths: 12,
  summary: "A monthly budget you spend on any service. Every project is priced before work starts, and the price is fixed.",
  includes: [
    "Any service, any mix, including identity, video and web",
    "Each project priced and approved before work starts",
    "Unused budget carries over for 12 months",
    "If you leave, we pay back what's left",
    "Top up any month for big launches",
    "Budget and spend shown live in your workspace",
  ],
};

export function planById(id: string | null | undefined): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

export function planByLookupKey(key: string | null | undefined): Plan | undefined {
  return PLANS.find((p) => p.lookupKey === key);
}

export function planLabel(plan: OrgPlan | string): string {
  if (plan === "flex") return "Flex";
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
