import Link from "next/link";
import Image from "next/image";
import { PromptHero } from "@/components/PromptHero";
import { ContactLine } from "@/components/ContactLine";
import { SERVICES } from "@/content/services";
import { visibleWork } from "@/content/work";
import { FAQ, PROMISES, STEPS } from "@/content/site";
import { IMG } from "@/content/images";

export default function Home() {
  const work = visibleWork();
  return (
    <>
      <section className="prompt-hero">
        <div className="wrap">
          <h1 className="display">What do you need designed?</h1>
          <PromptHero />
          <div className="prompt-meta">
            <p>
              nka.studio is a design team you hire by the month, for companies in the UK and Nigeria. Type it above and your
              workspace is ready, with the brief written, before we speak.
            </p>
            <Link href="/how-it-works">How it works</Link>
          </div>
        </div>
      </section>

      {work.length > 0 && (
        <section className="names" aria-label="Recent clients">
          <div className="wrap">
            <ul>
              {work.map((w) => (
                <li key={w.slug}>{w.client}</li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <h2 className="h1">Everything you&apos;d give a design team.</h2>
            <p className="muted">
              A deck this week, a report next week, an event the month after. One monthly plan, one designer who knows your
              brand.
            </p>
          </div>
          <ul className="rows">
            {SERVICES.map((s) => (
              <li key={s.slug}>
                <Link href={`/services/${s.slug}`} className="row">
                  <span className="row-name">{s.name}</span>
                  <span className="row-text">{s.line}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section on-ink">
        <div className="wrap">
          <div className="section-head">
            <h2 className="h1">Two ways to get it made.</h2>
            <p className="muted">You choose for each brief. Start with AI, finish with a person, or go straight to your designer.</p>
          </div>
          <div className="lanes-big">
            <div>
              <h3 className="h3">Instant</h3>
              <span className="lane-figure">1 min</span>
              <p>Three options made by AI from your brief, in your colours and type. Keep one, or hand it to your designer to finish.</p>
            </div>
            <div>
              <h3 className="h3">Designer</h3>
              <span className="lane-figure">2 days</span>
              <p>Your named designer makes it. First draft in about 2 working days, with the date shown the moment you send the brief.</p>
            </div>
          </div>
          <ol className="seq" aria-label="How a brief moves">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <b>{i + 1}</b>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {work.length > 0 && (
        <section className="section">
          <div className="wrap">
            <div className="section-head">
              <h2 className="h1">Recent work.</h2>
              <p className="muted">For clients in the UK and Nigeria, by the studio team.</p>
            </div>
            <ul className="rows">
              {work.map((w) => (
                <li key={w.slug}>
                  <Link href={`/work#${w.slug}`} className="row">
                    <span className="row-name">{w.client}</span>
                    <span className="row-text">
                      <b>{w.project}.</b> {w.summary}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="section on-ink">
        <div className="wrap">
          <div className="section-head">
            <h2 className="h1">In writing.</h2>
            <p className="muted">What people complain about with design subscriptions, and what we do instead. Each one is built into your workspace.</p>
          </div>
          <ul className="written">
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
        <div className="wrap split split-photo">
          <div className="mono-photo">
            <Image src={IMG.markup.src} alt={IMG.markup.alt} width={IMG.markup.w} height={IMG.markup.h} sizes="(max-width: 860px) 92vw, 45vw" />
          </div>
          <div>
            <h2 className="h2">Ten years of brand work, from bank rebrands to festival stages.</h2>
            <p style={{ marginTop: 20 }}>
              The studio is led by Justin Ukaegbu, a brand and communication designer. He started at WPP&apos;s 141 Worldwide in
              Lagos, rolled out Fidelity Bank&apos;s new identity across its branches, and worked on Diamond Bank&apos;s merger into
              Access Bank. He holds an MA in Graphic Design.
            </p>
            <p className="muted">Specialists join for motion, illustration and development when a project needs them. Your lead designer stays the same.</p>
            <p>
              <Link href="/about">About the studio</Link>
            </p>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap split">
          <div>
            <h2 className="h1">Questions.</h2>
          </div>
          <div className="faq">
            {FAQ.slice(0, 6).map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="closing">
        <div className="wrap">
          <p className="lede" style={{ color: "#fff", marginBottom: 24 }}>
            Start with one thing you need. Your workspace is set up in your brand before the call.
          </p>
          <Link href="/demo" className="closing-link">
            Book a demo
          </Link>
          <div className="closing-foot">
            <ContactLine lead="Or talk to us:" className="small" />
            <Link href="/pricing">How pricing works</Link>
          </div>
        </div>
      </section>
    </>
  );
}
