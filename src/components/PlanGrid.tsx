import Link from "next/link";
import type { ReactNode } from "react";
import { PLANS, YEARLY_MONTHS, priceFor, type Currency, type Interval, type Plan } from "@/lib/plans";
import { money } from "@/lib/format";

const CURRENCY_LABEL: Record<Currency, string> = { usd: "Dollars", ngn: "Naira", gbp: "Pounds" };

// The plan list in one currency, monthly or yearly. The caller supplies each plan's button.
export function PlanGrid({
  currency,
  interval,
  highlight,
  cta,
}: {
  currency: Currency;
  interval: Interval;
  highlight?: string;
  cta: (plan: Plan) => ReactNode;
}) {
  return (
    <div className="plans plans-4">
      {PLANS.map((p) => {
        const featured = highlight ? highlight === p.id : p.feature;
        return (
          <div key={p.id} className={`plan ${featured ? "plan-feature" : ""}`}>
            <div className="plan-name">{p.name}</div>
            <div className="plan-price">
              {money(priceFor(p, currency, interval), currency)} <small>{interval === "year" ? "a year" : "a month"}</small>
            </div>
            {interval === "year" && (
              <p className="small muted">
                {money(priceFor(p, currency, "month") * 12, currency)} paid monthly. Yearly is 12 months for the price of {YEARLY_MONTHS}.
              </p>
            )}
            <p className="plan-team">{p.team}</p>
            <p className="muted small">{p.forWho}</p>
            <ul>
              {p.includes.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            {cta(p)}
          </div>
        );
      })}
    </div>
  );
}

// Currency and monthly or yearly, as links so the page works without JavaScript.
export function PlanSwitch({ base, currency, interval, extra = {} }: { base: string; currency: Currency; interval: Interval; extra?: Record<string, string> }) {
  const href = (c: Currency, i: Interval) => {
    const q = new URLSearchParams({ ...extra, cur: c, interval: i });
    return `${base}?${q.toString()}`;
  };
  return (
    <div className="plan-switch" role="group" aria-label="Currency and billing period">
      <div className="seg">
        {(["usd", "ngn", "gbp"] as Currency[]).map((c) => (
          <Link key={c} href={href(c, interval)} className={c === currency ? "on" : ""} aria-current={c === currency ? "true" : undefined} scroll={false}>
            {CURRENCY_LABEL[c]}
          </Link>
        ))}
      </div>
      <div className="seg">
        <Link href={href(currency, "month")} className={interval === "month" ? "on" : ""} scroll={false}>
          Monthly
        </Link>
        <Link href={href(currency, "year")} className={interval === "year" ? "on" : ""} scroll={false}>
          Yearly, 2 months free
        </Link>
      </div>
    </div>
  );
}
