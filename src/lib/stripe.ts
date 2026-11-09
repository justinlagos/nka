import "server-only";
import Stripe from "stripe";
import { serverEnv } from "@/lib/env";
import { planById, type PlanId } from "@/lib/plans";

let stripe: Stripe | null = null;

export function getStripe(): Stripe | null {
  const { stripeSecret } = serverEnv();
  if (!stripeSecret) return null;
  if (!stripe) stripe = new Stripe(stripeSecret);
  return stripe;
}

// Finds the plan's monthly price by its lookup key. The first time a plan is bought, the
// product and price are created from the plan table, so prices only ever live in plans.ts.
export async function priceForPlan(s: Stripe, planId: PlanId): Promise<string | null> {
  const plan = planById(planId);
  if (!plan) return null;
  const find = async () => (await s.prices.list({ lookup_keys: [plan.lookupKey], active: true, limit: 1 })).data[0]?.id ?? null;

  const existing = await find();
  if (existing) return existing;

  const productId = `nka_${plan.id}`;
  try {
    await s.products.retrieve(productId);
  } catch {
    try {
      await s.products.create({
        id: productId,
        name: `Nka ${plan.name}`,
        statement_descriptor: "NKA STUDIO",
        metadata: { nka_plan: plan.id, active_limit: String(plan.activeLimit) },
      });
    } catch {
      /* created by a parallel request */
    }
  }
  try {
    const price = await s.prices.create({
      product: productId,
      currency: "gbp",
      unit_amount: plan.monthlyGbp * 100,
      recurring: { interval: "month" },
      lookup_key: plan.lookupKey,
      nickname: `Nka ${plan.name} monthly`,
      metadata: { nka_plan: plan.id },
    });
    return price.id;
  } catch {
    // Another request created it first.
    return find();
  }
}
