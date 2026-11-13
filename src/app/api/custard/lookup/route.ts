import { NextResponse, type NextRequest } from "next/server";
import { serverEnv, env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { bearerMatches, periodRange, projectNumber, readIdentity, type Period } from "@/lib/custard-sign";
import { describeProject, describeWorkspace, monthlyAtListPrices, type Lookup } from "@/lib/support-view";

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

// Custard AI calls this during a conversation:
//   lookup   Abigail checks a client's workspace or one project. Read only.
//   action   a change the client said yes to. Nka doesn't make changes through chat yet, so always no.
//   metrics  the owner asks John for numbers ("how many clients do we have?"). Read only.
// Custard proves it's Custard with the lookup secret. A lookup only answers for an id Nka signed
// (see signIdentity), and the database checks the person is still in that organisation.
export async function POST(request: NextRequest) {
  const { custardLookupSecret, custardIdentitySecret } = serverEnv();
  if (!custardLookupSecret || !custardIdentitySecret) return json({ error: "not_configured" }, 503);
  if (!bearerMatches(request.headers.get("authorization"), request.headers.get("x-custard-secret"), custardLookupSecret)) {
    return json({ error: "unauthorized" }, 401);
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return json({ error: "bad_request" }, 400);
  const site = env.siteUrl || new URL(request.url).origin;

  try {
    if (body.event === "action") {
      return json({ ok: false, message: "Nka can't make changes through chat yet. The client can do it in their workspace, or the studio can help." });
    }
    if (body.event === "metrics") return await metrics(body);
    if (body.event === "lookup") return await lookup(body, custardIdentitySecret, site);
    return json({ error: "unsupported_event" }, 400);
  } catch (err) {
    console.error("Custard lookup failed", err);
    return json({ error: "lookup_failed" }, 500);
  }
}

async function lookup(body: Record<string, unknown>, secret: string, site: string) {
  const meta = (body.metadata ?? {}) as Record<string, unknown>;
  const user = (body.user ?? {}) as Record<string, unknown>;
  const who = readIdentity(body.user_id ?? body.userId ?? meta.userId ?? user.userId, secret);
  if (!who) return json({ found: false, summary: "This person isn't signed in to an Nka workspace, so there's nothing to look up." });

  const hasRef = body.reference !== undefined && body.reference !== null && body.reference !== "";
  const number = hasRef ? projectNumber(body.reference) : null;
  if (hasRef && number === null) return json({ found: false, summary: "Nka project references are numbers, like 1042." });

  const { data, error } = await supabaseAdmin().rpc("support_lookup", { p_user: who.userId, p_org: who.orgId, p_project: number });
  if (error) throw new Error(error.message);
  if (!data) return json({ found: false, summary: "This person no longer has access to that workspace." });

  const view = number === null ? describeWorkspace(data as Lookup, site) : describeProject(data as Lookup, number, site);
  return json(view);
}

async function metrics(body: Record<string, unknown>) {
  // Business numbers are for the owner talking to John, never for a client talking to Abigail.
  if (body.requested_by !== "owner" && body.requested_by !== "manager") return json({ error: "not_allowed" }, 403);
  const metric = String(body.metric ?? "");
  const period = String(body.period ?? "this_month") as Period;
  const range = periodRange(period);
  if (!range) return json({ error: "unsupported_metric_or_period" }, 400);
  const db = supabaseAdmin();
  const span = { p_from: range.from.toISOString(), p_to: range.to.toISOString() };

  if (metric === "customers" || metric === "projects") {
    const { data, error } = await db.rpc("support_metrics", { p_metric: metric, ...span });
    if (error) throw new Error(error.message);
    return json({ metric, period, ...(data as object) });
  }

  if (metric === "mrr" || metric === "plans" || metric === "subscriptions") {
    const { data, error } = await db.rpc("support_metrics", { p_metric: "plans", ...span });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as { plan: string; currency: string; count: number }[];
    return json({ metric, period, note: "Monthly plan income at list prices, before VAT and Stripe fees.", plans: rows, ...monthlyAtListPrices(rows) });
  }

  if (metric === "revenue" || metric === "transactions" || metric === "payouts") {
    const stripe = getStripe();
    if (!stripe || metric === "payouts") return json({ error: "unsupported_metric_or_period" }, 400);
    // Card payments in the period, less refunds. At most 300, to answer within Custard's time limit.
    const byCurrency: Record<string, number> = {};
    let count = 0;
    let more = false;
    const created = { gte: Math.floor(range.from.getTime() / 1000), lt: Math.ceil(range.to.getTime() / 1000) };
    for await (const charge of stripe.charges.list({ created, limit: 100 })) {
      if (count >= 300) {
        more = true;
        break;
      }
      if (charge.status !== "succeeded" || !charge.paid) continue;
      count += 1;
      byCurrency[charge.currency] = (byCurrency[charge.currency] ?? 0) + (charge.amount - charge.amount_refunded) / 100;
    }
    const currencies = Object.keys(byCurrency);
    return json({
      metric,
      period,
      count,
      revenue: currencies.length === 1 ? byCurrency[currencies[0]] : null,
      currency: currencies.length === 1 ? currencies[0].toUpperCase() : null,
      by_currency: byCurrency,
      note: more ? "Only the first 300 payments were counted." : "Card payments through Stripe, less refunds, before fees.",
    });
  }

  return json({ error: "unsupported_metric_or_period" }, 400);
}
