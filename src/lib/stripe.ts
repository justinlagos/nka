import "server-only";
import Stripe from "stripe";
import { serverEnv } from "@/lib/env";
import { CURRENCIES, TOP_UP, lookupKey, planById, priceFor, type Currency, type Interval, type PlanId } from "@/lib/plans";

let stripe: Stripe | null = null;

export function getStripe(): Stripe | null {
  const { stripeSecret } = serverEnv();
  if (!stripeSecret) return null;
  if (!stripe) stripe = new Stripe(stripeSecret);
  return stripe;
}

// Naira, dollars and pounds all have two decimal places in Stripe.
const minor = (n: number) => Math.round(n * 100);

// One Stripe Price per plan and interval, set in dollars with naira and pound options, so every
// buyer sees one fixed figure in their own currency. Made from plans.ts the first time it's needed.
async function findOrCreatePrice(
  s: Stripe,
  key: string,
  productId: string,
  productName: string,
  amounts: Record<Currency, number>,
  recurring: { interval: Interval } | null,
  metadata: Record<string, string>,
): Promise<string | null> {
  const find = async () => (await s.prices.list({ lookup_keys: [key], active: true, limit: 1 })).data[0]?.id ?? null;
  const existing = await find();
  if (existing) return existing;

  try {
    await s.products.retrieve(productId);
  } catch {
    try {
      await s.products.create({ id: productId, name: productName, statement_descriptor: "NKA STUDIO", metadata });
    } catch {
      /* created by a parallel request */
    }
  }
  const options: Stripe.PriceCreateParams.CurrencyOptions = {};
  for (const c of CURRENCIES) if (c !== "usd") (options as Record<string, { unit_amount: number }>)[c] = { unit_amount: minor(amounts[c]) };
  try {
    const price = await s.prices.create({
      product: productId,
      currency: "usd",
      unit_amount: minor(amounts.usd),
      currency_options: options as Record<string, Stripe.PriceCreateParams.CurrencyOptions>,
      ...(recurring ? { recurring } : {}),
      lookup_key: key,
      nickname: productName,
      metadata,
    });
    return price.id;
  } catch {
    // Another request created it first.
    return find();
  }
}

export async function priceForPlan(s: Stripe, planId: PlanId, interval: Interval = "month"): Promise<string | null> {
  const plan = planById(planId);
  if (!plan) return null;
  const amounts = {
    usd: priceFor(plan, "usd", interval),
    ngn: priceFor(plan, "ngn", interval),
    gbp: priceFor(plan, "gbp", interval),
  };
  return findOrCreatePrice(
    s,
    lookupKey(plan.id, interval),
    `nka_${plan.id}_v3`,
    `Nka ${plan.name}`,
    amounts,
    { interval },
    { nka_plan: plan.id, team_hours: String(plan.teamHours), active_limit: String(plan.activeLimit) },
  );
}

export async function priceForTopUp(s: Stripe): Promise<string | null> {
  return findOrCreatePrice(s, TOP_UP.lookupKey, "nka_hours_v3", `Nka: ${TOP_UP.hours} extra team hours`, TOP_UP.price, null, {
    nka_top_up_hours: String(TOP_UP.hours),
  });
}
