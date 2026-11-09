import Link from "next/link";
import type { Metadata } from "next";
import { FLEX, PLANS } from "@/lib/plans";
import { money } from "@/lib/format";
import { FAQ } from "@/content/site";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Monthly design plans from £1,500, a Flex budget for larger teams, and bespoke quotes.",
};

export default function Pricing() {
  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <h1 className="h1">Pricing</h1>
          <p className="lede">
            Three ways to work with us. Plans are billed monthly by card, in pounds; Stripe accepts any major card worldwide.
          </p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 24 }}>
        <div className="wrap">
          <h2 className="h2" style={{ marginBottom: 8 }}>
            Plans
          </h2>
          <p className="muted" style={{ marginBottom: 28 }}>
            A fixed monthly fee. Plans differ by how many requests are in progress at once. Send as many as you like; the rest
            wait in your queue.
          </p>
          <div className="plans">
            {PLANS.map((p, i) => (
              <div key={p.id} className={`plan ${i === 1 ? "plan-feature" : ""}`}>
                <div className="plan-name">{p.name}</div>
                <div className="plan-price">
                  {money(p.monthlyGbp)} <small>a month</small>
                </div>
                <p className="muted" style={{ margin: 0 }}>
                  {p.forWho}
                </p>
                <p className="small" style={{ margin: 0 }}>
                  {p.firstDraft}.
                </p>
                <ul>
                  {p.includes.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
                <Link href={`/app/billing?plan=${p.id}`} className={`btn ${i === 1 ? "" : "btn-line"}`}>
                  Choose {p.name}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap split">
          <div className="block">
            <h2 className="h2" style={{ marginBottom: 6 }}>
              {FLEX.name}
            </h2>
            <p className="plan-price" style={{ margin: "10px 0 14px" }}>
              From {money(FLEX.fromGbp)} <small>a month</small>
            </p>
            <p>{FLEX.summary}</p>
            <ul className="ticks" style={{ marginBottom: 24 }}>
              {FLEX.includes.map((x) => (
                <li key={x}>{x}</li>
              ))}
              <li>{FLEX.minimumMonths}-month minimum, then monthly</li>
            </ul>
            <Link href="/book?interest=flex" className="btn">
              Book a call about Flex
            </Link>
          </div>
          <div className="block">
            <h2 className="h2" style={{ marginBottom: 6 }}>
              Bespoke
            </h2>
            <p className="plan-price" style={{ margin: "10px 0 14px" }}>
              Quoted
            </p>
            <p>For one-off projects, retainers with a dedicated team, and tenders with their own procurement rules.</p>
            <ul className="ticks" style={{ marginBottom: 24 }}>
              <li>Fixed-price projects with a dated plan</li>
              <li>Dedicated designers for your account</li>
              <li>Quotes in the format your procurement team needs</li>
              <li>Invoicing from our UK or Nigerian company</li>
            </ul>
            <Link href="/book?interest=bespoke" className="btn btn-line">
              Book a call
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <h2 className="h1">Compared with the alternatives</h2>
            <p className="muted">Each has its place. This is where a plan fits.</p>
          </div>
          <div className="table-scroll">
            <table className="compare">
              <thead>
                <tr>
                  <th scope="col"></th>
                  <th scope="col" className="us">
                    Nka plan
                  </th>
                  <th scope="col">Hiring a designer</th>
                  <th scope="col">Agency</th>
                  <th scope="col">Freelancers</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Cost</th>
                  <td className="us">One monthly fee</td>
                  <td>Salary, employer costs, software and kit</td>
                  <td>Quoted per project, often with retainers</td>
                  <td>Day or project rates, each time</td>
                </tr>
                <tr>
                  <th scope="row">Time to start</th>
                  <td className="us">Days</td>
                  <td>Weeks to months to hire</td>
                  <td>Weeks, after scoping</td>
                  <td>Depends who's free</td>
                </tr>
                <tr>
                  <th scope="row">Range of skills</th>
                  <td className="us">Brand, documents, events, motion, web</td>
                  <td>One person's strengths</td>
                  <td>Wide</td>
                  <td>One specialism each</td>
                </tr>
                <tr>
                  <th scope="row">Holidays and sick days</th>
                  <td className="us">Covered by the studio</td>
                  <td>Work stops</td>
                  <td>Covered</td>
                  <td>Work stops</td>
                </tr>
                <tr>
                  <th scope="row">Commitment</th>
                  <td className="us">Month to month</td>
                  <td>Employment contract</td>
                  <td>Project or retainer contract</td>
                  <td>Per job</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap split">
          <h2 className="h1">Billing questions</h2>
          <div className="faq">
            {FAQ.filter((f) => /cancel|pay|request|own|procurement/i.test(f.q)).map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
