import Link from "next/link";
import type { Metadata } from "next";
import { ContactLine } from "@/components/ContactLine";
import { PROMISES, FAQ } from "@/content/site";
import { FLEX, PLANS } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Pricing",
  description: "One monthly price, agreed on a short call and fixed in writing. Cancel or pause any month.",
};

const SHAPES = [
  ...PLANS.map((p) => ({ name: p.name, forWho: p.forWho, points: p.includes.slice(0, 3) })),
  { name: FLEX.name, forWho: FLEX.summary, points: FLEX.includes.slice(0, 4) },
  {
    name: "Bespoke",
    forWho: "Large programmes, tenders and procurement rules.",
    points: ["Quoted to the format you need", "Invoiced from our UK or Nigerian company", "Named team for the length of the work"],
  },
];

export default function Pricing() {
  const costFaq = FAQ.filter((f) => /cost|pause|Nigeria|count/i.test(f.q));
  return (
    <>
      <section className="hero">
        <div className="wrap">
          <p className="eyebrow">Pricing</p>
          <h1 className="h1" style={{ maxWidth: 900 }}>
            One monthly price, agreed with you and fixed in writing.
          </h1>
          <p className="lede" style={{ maxWidth: 760 }}>
            What you pay depends on how much design you need running at the same time. We work that out with you on a 20-minute
            call, then send the price in writing. It doesn&apos;t change unless you agree to change it.
          </p>
          <div className="hero-actions">
            <Link href="/demo" className="btn">
              Book a demo
            </Link>
          </div>
          <ContactLine />
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <h2 className="h1">Ways to work with us</h2>
            <p className="muted">Plans differ by how many requests run at once. Every plan includes your named designer, revisions and free resizes.</p>
          </div>
          <ul className="shape-list">
            {SHAPES.map((s) => (
              <li key={s.name}>
                <h3>{s.name}</h3>
                <p className="for">{s.forWho}</p>
                <ul className="ticks">
                  {s.points.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
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
            <h2 className="h1">Get your price in writing.</h2>
            <p className="muted" style={{ marginTop: 16 }}>
              Two quick steps, a workspace in your brand, and a 20-minute call. No card needed.
            </p>
          </div>
          <div className="hero-actions" style={{ marginTop: 0 }}>
            <Link href="/demo" className="btn">
              Book a demo
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
