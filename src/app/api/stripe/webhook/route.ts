import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { serverEnv } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { planByLookupKey, planStatusFromStripe } from "@/lib/plans";

// Keeps each organisation's plan in step with its Stripe subscription.
export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const { stripeWebhookSecret } = serverEnv();
  if (!stripe || !stripeWebhookSecret) {
    return NextResponse.json({ error: "Billing is not configured" }, { status: 503 });
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, stripeWebhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const orgId = session.client_reference_id ?? session.metadata?.org_id;
      const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
      if (orgId && subId) {
        const sub = await stripe.subscriptions.retrieve(subId);
        await applySubscription(orgId, sub);
      }
    } else if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object as Stripe.Subscription;
      const orgId = sub.metadata?.org_id ?? (await orgForCustomer(customerId(sub)));
      if (orgId) await applySubscription(orgId, sub);
    }
  } catch (err) {
    console.error("Stripe webhook handling failed", event.type, err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}

function customerId(sub: Stripe.Subscription): string {
  return typeof sub.customer === "string" ? sub.customer : sub.customer.id;
}

async function orgForCustomer(customer: string): Promise<string | null> {
  const { data } = await supabaseAdmin().from("orgs").select("id").eq("stripe_customer_id", customer).maybeSingle();
  return data?.id ?? null;
}

async function applySubscription(orgId: string, sub: Stripe.Subscription) {
  const lookup = sub.items.data[0]?.price?.lookup_key;
  const plan = planByLookupKey(lookup);
  // A pause set from Nka's billing page keeps the subscription "active" in Stripe but stops collection.
  const status = sub.pause_collection && sub.status === "active" ? "paused" : planStatusFromStripe(sub.status);
  const ended = status === "canceled";
  const update: Record<string, unknown> = {
    stripe_customer_id: customerId(sub),
    stripe_subscription_id: ended ? null : sub.id,
    plan_status: ended ? "inactive" : status,
  };
  if (ended) {
    update.plan = "none";
    update.active_limit = null;
  } else if (plan) {
    update.plan = plan.id;
    update.active_limit = plan.activeLimit;
  }
  const { error } = await supabaseAdmin().from("orgs").update(update).eq("id", orgId);
  if (error) throw new Error(error.message);
}
