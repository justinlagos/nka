import { ActionForm } from "@/components/ActionForm";
import { buyHours, openBillingPortal, pausePlan, resumePlan, startCheckout } from "../actions";
import { ContactLine } from "@/components/ContactLine";
import { PlanGrid, PlanSwitch } from "@/components/PlanGrid";
import { canAdmin, requireMembership } from "@/lib/session";
import { EVERY_PLAN, TOP_UP, currencyForCountry, hasCardPlan, isCurrency, planById, planLabel, type Currency } from "@/lib/plans";
import { date, money } from "@/lib/format";
import { getStripe } from "@/lib/stripe";

const KIND: Record<string, string> = {
  allowance: "Monthly hours",
  use: "Brief",
  return: "Hours back",
  top_up: "Extra hours",
  adjustment: "Adjustment",
};

type Balance = { allowance: number; top_ups: number; carried: number; granted: number; used: number; left: number };

export default async function Billing({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; checkout?: string; hours?: string; cur?: string; interval?: string }>;
}) {
  const { supabase, org, role } = await requireMembership();
  const q = await searchParams;
  const admin = canAdmin(role);
  const cardsOn = Boolean(getStripe());
  const onCardPlan = hasCardPlan(org.plan, org.plan_status);
  const plan = planById(org.plan);
  // A paying client keeps the currency they chose; anyone else sees their country's currency.
  const currency: Currency = isCurrency(q.cur) ? q.cur : onCardPlan && isCurrency(org.currency) ? org.currency : currencyForCountry(org.country);
  const interval = q.interval === "year" ? "year" : "month";

  const [{ data: bal }, { data: ledger }] = plan
    ? await Promise.all([
        supabase.rpc("hours_balance", { p_org: org.id }),
        supabase.from("hours_ledger").select("id, month, kind, hours, note, created_at").eq("org_id", org.id).order("created_at", { ascending: false }).limit(40),
      ])
    : [{ data: null }, { data: [] as { id: number; month: string; kind: string; hours: number; note: string; created_at: string }[] }];
  const balance = (bal ?? null) as Balance | null;
  const total = balance ? Number(balance.carried) + Number(balance.granted) : 0;

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

      {q.checkout === "done" && (
        <div className="callout">
          <p>Payment received. Your plan and team hours switch on within a minute; refresh if it still shows the old plan.</p>
        </div>
      )}
      {q.hours === "done" && (
        <div className="callout">
          <p>Payment received. {TOP_UP.hours} hours are added within a minute, and any brief that was waiting starts by itself.</p>
        </div>
      )}
      {q.checkout === "cancelled" && (
        <div className="callout callout-warn">
          <p>Checkout was cancelled. Nothing was charged.</p>
        </div>
      )}
      {org.plan_status === "past_due" && (
        <div className="callout callout-warn">
          <p>Your last payment didn&apos;t go through. Update your card below to keep work moving.</p>
        </div>
      )}

      {plan && balance && (
        <section className="panel">
          <h2>Team hours this month</h2>
          <div className="stats" style={{ marginBottom: 12 }}>
            <div className="stat">
              <b>{Number(balance.left)}</b>
              <span>Hours left</span>
            </div>
            <div className="stat">
              <b>{Number(balance.used)}</b>
              <span>Used</span>
            </div>
            <div className="stat">
              <b>{Number(balance.carried)}</b>
              <span>Carried from last month</span>
            </div>
          </div>
          <div className={`meter ${Number(balance.left) <= 0 ? "warn" : ""}`} aria-hidden="true">
            <span style={{ width: `${total > 0 ? Math.min(100, Math.max(0, (Number(balance.used) / total) * 100)) : 0}%` }} />
          </div>
          <p className="small muted">
            {plan.name} gives your team {plan.teamHours} hours a month{plan.extraLeadHours ? `, plus ${plan.extraLeadHours} marketing lead hours` : ""}.
            Each brief uses the hours shown when it starts, and that number is fixed. Unused hours carry into next month only. A late
            first draft gives its hours back.
          </p>
          {admin && onCardPlan && cardsOn && (
            <ActionForm action={buyHours} submit={`Add ${TOP_UP.hours} hours for ${money(TOP_UP.price[currency], currency)}`} pending="Opening Stripe" buttonClass="btn btn-small">
              <input type="hidden" name="currency" value={currency} />
            </ActionForm>
          )}
          {(ledger ?? []).length > 0 && (
            <div className="table-scroll" style={{ marginTop: 16 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>What</th>
                    <th>Note</th>
                    <th className="num">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {(ledger ?? []).map((l) => (
                    <tr key={l.id}>
                      <td>{date(l.created_at)}</td>
                      <td>{KIND[l.kind] ?? l.kind}</td>
                      <td>{l.note}</td>
                      <td className="num">{Number(l.hours) > 0 ? `+${Number(l.hours)}` : Number(l.hours)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {onCardPlan && (
        <section className="panel">
          <h2>Manage your plan</h2>
          <p>
            Change plan, update your card, download invoices or cancel. No notice period and no exit fee; a cancellation takes
            effect at the end of the period you&apos;ve paid for.
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

      {!onCardPlan && org.plan !== "bespoke" && (
        <section className="panel">
          <h2>Choose your plan</h2>
          <p>
            Every plan gives you a team and a monthly pool of team hours. Prices are fixed and the same everywhere, in dollars,
            naira or pounds. Pay by card through Stripe; pause or cancel any month.
          </p>
          <PlanSwitch base="/app/billing" currency={currency} interval={interval} extra={q.plan ? { plan: q.plan } : {}} />
          <PlanGrid
            currency={currency}
            interval={interval}
            highlight={q.plan}
            cta={(p) =>
              admin && cardsOn ? (
                <ActionForm action={startCheckout} submit={`Start ${p.name}`} pending="Opening Stripe" buttonClass={p.feature ? "btn" : "btn btn-line"}>
                  <input type="hidden" name="plan" value={p.id} />
                  <input type="hidden" name="interval" value={interval} />
                  <input type="hidden" name="currency" value={currency} />
                </ActionForm>
              ) : (
                <p className="muted small">{admin ? "Card payments aren't switched on yet. Message the studio." : "Only an owner or admin can start a plan."}</p>
              )
            }
          />
          <p className="small muted" style={{ marginTop: 18 }}>
            Every plan: {EVERY_PLAN.join(", ").toLowerCase()}. Extra hours: {TOP_UP.hours} for {money(TOP_UP.price[currency], currency)}. Prices exclude VAT where it applies.
          </p>
          <p className="small muted">
            Need a website, a rebrand or a launch? That&apos;s Bespoke, quoted after a call.
          </p>
          <ContactLine lead="Questions first?" />
        </section>
      )}

      {org.plan === "bespoke" && (
        <section className="panel">
          <h2>Bespoke</h2>
          <p>Your account is quoted and invoiced directly. For invoices or changes, message the studio from any project.</p>
        </section>
      )}
    </>
  );
}
