import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { openBillingPortal, startCheckout } from "../actions";
import { canAdmin, requireMembership } from "@/lib/session";
import { FLEX, PLANS, planLabel } from "@/lib/plans";
import { summariseBudget, type LedgerEntry } from "@/lib/budget";
import { date, money } from "@/lib/format";
import { getStripe } from "@/lib/stripe";

const KIND: Record<string, string> = {
  allocation: "Monthly budget",
  top_up: "Top-up",
  spend: "Project",
  refund: "Refund",
  expiry: "Expired",
  adjustment: "Adjustment",
};

export default async function Billing({ searchParams }: { searchParams: Promise<{ plan?: string; checkout?: string }> }) {
  const { supabase, org, role } = await requireMembership();
  const { plan: wanted, checkout } = await searchParams;
  const admin = canAdmin(role);
  const cardsOn = Boolean(getStripe());
  const onCardPlan = ["starter", "growth", "studio"].includes(org.plan) && ["active", "trialing", "past_due"].includes(org.plan_status);
  const today = new Date().toISOString().slice(0, 10);

  const { data: ledger } =
    org.plan === "flex"
      ? await supabase.from("budget_ledger").select("id, kind, amount, effective_on, note").eq("org_id", org.id).order("effective_on", { ascending: false })
      : { data: [] as (LedgerEntry & { id: string; note: string })[] };
  const budget = org.plan === "flex" ? summariseBudget((ledger ?? []) as LedgerEntry[], org.rollover_months, today) : null;

  return (
    <>
      <div className="app-head">
        <div>
          <h1>Billing</h1>
          <p className="muted">
            Current plan: <b>{planLabel(org.plan)}</b>
            {org.plan !== "none" ? `, ${org.plan_status.replace("_", " ")}` : ""}
          </p>
        </div>
      </div>

      {checkout === "done" && (
        <div className="callout">
          <p>Payment received. Your plan switches on within a minute; refresh if it still shows the old plan.</p>
        </div>
      )}
      {checkout === "cancelled" && (
        <div className="callout callout-warn">
          <p>Checkout was cancelled. Nothing was charged.</p>
        </div>
      )}
      {org.plan_status === "past_due" && (
        <div className="callout callout-warn">
          <p>Your last payment didn&apos;t go through. Update your card below to keep work moving.</p>
        </div>
      )}

      {onCardPlan && (
        <section className="panel">
          <h2>Manage your plan</h2>
          <p>Change plan, update your card, download invoices or cancel. Changes apply from your next billing date.</p>
          {admin ? (
            <ActionForm action={openBillingPortal} submit="Open billing" pending="Opening" buttonClass="btn btn-ink" />
          ) : (
            <p className="muted small">Only an owner or admin can manage billing.</p>
          )}
        </section>
      )}

      {budget && (
        <section className="panel">
          <h2>Flex budget</h2>
          <div className="stats" style={{ marginBottom: 12 }}>
            <div className="stat">
              <b>{money(budget.balance, org.currency)}</b>
              <span>Left to spend</span>
            </div>
            <div className="stat">
              <b>{money(budget.spent, org.currency)}</b>
              <span>Spent so far</span>
            </div>
            <div className="stat">
              <b>{money(budget.expiringSoon, org.currency)}</b>
              <span>Expiring in 30 days</span>
            </div>
          </div>
          <div className={`meter ${budget.balance < 0 ? "warn" : ""}`} aria-hidden="true">
            <span style={{ width: `${budget.credited > 0 ? Math.min(100, Math.max(0, (budget.spent / budget.credited) * 100)) : 0}%` }} />
          </div>
          <p className="small muted">
            Unused monthly budget rolls over for {org.rollover_months} months. To top up, message the studio from any project or{" "}
            <Link href="/book?interest=flex">book a call</Link>.
          </p>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>What</th>
                  <th>Note</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(ledger ?? []).map((l) => (
                  <tr key={l.id}>
                    <td>{date(l.effective_on)}</td>
                    <td>{KIND[l.kind] ?? l.kind}</td>
                    <td>{l.note}</td>
                    <td className="num">{money(l.amount, org.currency, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!onCardPlan && org.plan !== "flex" && org.plan !== "bespoke" && (
        <section className="panel">
          <h2>Choose a plan</h2>
          {!cardsOn && (
            <div className="callout callout-warn">
              <p>
                Card payments aren&apos;t switched on yet. <Link href="/book?interest=plan">Book a call</Link> and we&apos;ll set
                your plan up.
              </p>
            </div>
          )}
          {!admin && <p className="muted">Only an owner or admin can choose a plan.</p>}
          <div className="plans" style={{ marginTop: 12 }}>
            {PLANS.map((p) => (
              <div key={p.id} className={`plan ${wanted === p.id ? "plan-feature" : ""}`}>
                <div className="plan-name">{p.name}</div>
                <div className="plan-price">
                  {money(p.monthlyGbp)} <small>a month</small>
                </div>
                <ul>
                  {p.includes.slice(0, 3).map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
                {admin && cardsOn && (
                  <ActionForm action={startCheckout} submit={`Choose ${p.name}`} pending="Opening Stripe" buttonClass={`btn ${wanted === p.id ? "" : "btn-line"}`}>
                    <input type="hidden" name="plan" value={p.id} />
                  </ActionForm>
                )}
              </div>
            ))}
          </div>
          <p className="small muted" style={{ marginTop: 18 }}>
            Monthly, billed in pounds by Stripe. Any major card. Need {FLEX.name}, invoicing or naira?{" "}
            <Link href="/book?interest=flex">Book a call</Link>.
          </p>
        </section>
      )}

      {org.plan === "bespoke" && (
        <section className="panel">
          <h2>Bespoke</h2>
          <p>Your account is invoiced directly. For invoices or changes, message the studio from any project.</p>
        </section>
      )}
    </>
  );
}
