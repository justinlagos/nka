import Link from "next/link";
import type { Metadata } from "next";
import { ContactLine } from "@/components/ContactLine";
import { PlanGrid, PlanSwitch } from "@/components/PlanGrid";
import { PROMISES, FAQ } from "@/content/site";
import { BESPOKE, EVERY_PLAN, TOP_UP } from "@/lib/plans";
import { visitorCurrency } from "@/lib/geo";
import { money } from "@/lib/format";

export const metadata: Metadata = {
  title: "Pricing",
  description: "A team on a monthly plan: Instant $19, Starter $149, Growth $399, Studio $999, or the same in naira or pounds. Pause or cancel any month.",
};

export default async function Pricing({ searchParams }: { searchParams: Promise<{ cur?: string; interval?: string }> }) {
  const q = await searchParams;
  const currency = await visitorCurrency(q.cur);
  const interval = q.interval === "year" ? "year" : "month";
  const costFaq = FAQ.filter((f) => /cost|team hours|team\?|pause|Nigeria|fast/i.test(f.q));
  return (
    <>
      <section className="hero">
        <div className="wrap">
          <p className="eyebrow">Pricing</p>
          <h1 className="h1" style={{ maxWidth: 900 }}>
            A design and copy team, on one monthly price.
          </h1>
          <p className="lede" style={{ maxWidth: 760 }}>
            Every plan gives you a team and a monthly pool of team hours. The same prices everywhere, in dollars, naira or pounds.
            Start in two steps, pay by card, pause or cancel any month.
          </p>
          <ContactLine />
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <PlanSwitch base="/pricing" currency={currency} interval={interval} />
          <PlanGrid
            currency={currency}
            interval={interval}
            cta={(p) => (
              <Link href={`/demo?plan=${p.id}&cur=${currency}&interval=${interval}`} className={p.feature ? "btn" : "btn btn-line"}>
                Start with {p.name}
              </Link>
            )}
          />
          <p className="small muted" style={{ marginTop: 18 }}>
            Every plan: {EVERY_PLAN.join(", ").toLowerCase()}. Extra hours: {TOP_UP.hours} for {money(TOP_UP.price[currency], currency)}.
            Prices exclude VAT where it applies.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="wrap split">
          <div>
            <h2 className="h1">{BESPOKE.name}</h2>
            <p className="muted">{BESPOKE.forWho}</p>
          </div>
          <div>
            <ul className="ticks">
              {BESPOKE.includes.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <div className="hero-actions">
              <Link href="/demo" className="btn btn-line">
                Book a call
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section on-ink">
        <div className="wrap">
          <div className="section-head">
            <h2 className="h1">What doesn&apos;t change, whatever you pay</h2>
            <p className="muted">These are in our terms and built into your workspace.</p>
          </div>
          <ul className="promises promises-ink">
            {PROMISES.map((p) => (
              <li key={p.title}>
                <h3>{p.title}</h3>
                <p>{p.body}</p>
                <span className="how">{p.how}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section">
        <div className="wrap split">
          <div>
            <h2 className="h1">About cost</h2>
          </div>
          <div className="faq">
            {costFaq.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="section on-ink">
        <div className="wrap cta-band">
          <div>
            <h2 className="h1">Try it before you pay.</h2>
            <p className="muted" style={{ marginTop: 16 }}>
              Two quick steps and a workspace in your brand, with free Instant briefs. Pick a plan when you want your team.
            </p>
          </div>
          <div className="hero-actions" style={{ marginTop: 0 }}>
            <Link href="/demo" className="btn">
              Start a project
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
