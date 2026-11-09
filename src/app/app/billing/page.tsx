import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { openBillingPortal, pausePlan, resumePlan, startCheckout } from "../actions";
import { ContactLine } from "@/components/ContactLine";
import { canAdmin, requireMembership } from "@/lib/session";
import { PLANS, planLabel } from "@/lib/plans";
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
  payout: "Paid back to you",
};

export default async function Billing({ searchParams }: { searchParams: Promise<{ plan?: string; checkout?: string }> }) {
  const { supabase, org, role } = await requireMembership();
  const { plan: wanted, checkout } = await searchParams;
  const admin = canAdmin(role);
  const cardsOn = Boolean(getStripe());
  const onCardPlan =
    ["starter", "growth", "studio"].includes(org.plan) && ["active", "trialing", "past_due", "paused"].includes(org.plan_status);
  const offered = PLANS.find((p) => p.id === wanted);
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
          <p>
            Change plan, update your card, download invoices or cancel. No notice period and no exit fee; a cancellation takes
            effect at the end of the month you&apos;ve paid for.
          </p>
          {admin ? (
            <ActionForm action={openBillingPortal} submit="Open billing" pending="Opening" buttonClass="btn btn-ink" />
          ) : (
            <p className="muted small">Only an owner or admin can manage billing.</p>
          )}
        </section>
      )}

      {onCardPlan && admin && (
        <section className="panel">
          <h2>{org.plan_status === "paused" ? "Your plan is paused" : "Quiet month coming?"}</h2>
          {org.plan_status === "paused" ? (
            <>
              <p>No charges while paused. New briefs wait in your queue and start when you resume.</p>
              <ActionForm action={resumePlan} submit="Resume now" pending="Resuming" buttonClass="btn btn-small" />
            </>
          ) : (
            <>
              <p>
                Pause for up to a month instead of paying for it. Work already started is finished; new briefs wait in your
                queue. It resumes by itself.
              </p>
              <ActionForm
                action={pausePlan}
                submit="Pause for a month"
                pending="Pausing"
                buttonClass="btn btn-small btn-line"
                confirm="Pause your plan for up to a month? You can resume any time."
              />
            </>
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
            Unused budget carries over for {org.rollover_months} months. If you leave, we pay back what&apos;s left. To top up or
            ask for a payback, message the studio from any project.
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
          <h2>Start your plan</h2>
          {offered ? (
            <>
              <p>This is the plan we agreed with you.</p>
              <div className="plans" style={{ marginTop: 12 }}>
                <div className="plan plan-feature">
                  <div className="plan-name">{offered.name}</div>
                  <div className="plan-price">
                    {money(offered.monthlyGbp)} <small>a month</small>
                  </div>
                  <ul>
                    {offered.includes.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                  {admin && cardsOn ? (
                    <ActionForm action={startCheckout} submit={`Start ${offered.name}`} pending="Opening Stripe" buttonClass="btn">
                      <input type="hidden" name="plan" value={offered.id} />
                    </ActionForm>
                  ) : (
                    <p className="muted small">
                      {admin ? "Card payments aren't switched on yet. Message the studio." : "Only an owner or admin can start a plan."}
                    </p>
                  )}
                </div>
              </div>
              <p className="small muted" style={{ marginTop: 18 }}>
                Monthly, by any major card through Stripe. Cancel or pause from this page any month.
              </p>
            </>
          ) : (
            <>
              <p>
                Your plan and monthly price are agreed with you on a short call, then sent in writing. When you&apos;re ready, we
                send a link that opens your plan here. Until then you can send briefs; we&apos;ll quote each one before starting.
              </p>
              <ContactLine lead="Want to talk now?" />
            </>
          )}
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
