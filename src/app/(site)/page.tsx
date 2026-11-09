import Link from "next/link";
import { UliLine } from "@/components/UliLine";
import { Wordmark } from "@/components/Wordmark";
import { StatusPill } from "@/components/StatusPill";
import { SERVICES } from "@/content/services";
import { visibleWork } from "@/content/work";
import { FAQ, SITE, STEPS } from "@/content/site";
import { FLEX, PLANS } from "@/lib/plans";
import { money } from "@/lib/format";

export default function Home() {
  const work = visibleWork().slice(0, 3);
  return (
    <>
      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <h1 className="display">Send a brief. Get finished design back.</h1>
            <p className="lede">
              Nka is the design studio from MotionPlay Labs. One monthly fee covers decks, reports, campaigns, events and
              motion, for teams in the UK and Nigeria.
            </p>
            <div className="hero-actions">
              <Link href="/pricing" className="btn">
                See plans
              </Link>
              <Link href="/book" className="btn btn-line">
                Book a call
              </Link>
            </div>
            <p className="hero-note">{SITE.meaning} Plans from {money(PLANS[0].monthlyGbp)} a month, cancel any month.</p>
          </div>
          <div className="hero-art">
            <UliLine />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <h2 className="h1">What we make</h2>
            <p className="muted">
              Most teams send a mix: a deck this week, a report next week, an event the month after. One plan covers it.
            </p>
          </div>
          <ul className="index">
            {SERVICES.map((s) => (
              <li key={s.slug}>
                <Link href={`/services/${s.slug}`}>
                  <span className="index-name">{s.name}</span>
                  <span className="index-line">{s.line}</span>
                  <span className="index-go">Details</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <h2 className="h1">How it works</h2>
            <p className="muted">Every request moves through the same five steps, and you can see each one.</p>
          </div>
          <ol className="steps">
            {STEPS.map((s) => (
              <li key={s.title}>
                <h3>{s.title}</h3>
                <p className="muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section on-ink">
        <div className="wrap">
          <div className="section-head">
            <h2 className="h1">One workspace for all of it</h2>
            <p className="muted">
              Briefs, estimates, files, feedback and spend in one place. Invite your team; give finance view-only access.
            </p>
          </div>
          <div className="preview" aria-label="Example of the Nka workspace">
            <div className="preview-side">
              <Wordmark />
              <span className="on">Projects</span>
              <span>New brief</span>
              <span>Library</span>
              <span>Brand book</span>
              <span>Billing</span>
              <span>Team</span>
            </div>
            <div className="preview-main">
              {[
                { ref: "NKA-1042", title: "Annual report layout", status: "in_progress" },
                { ref: "NKA-1043", title: "Conference booth, 3 m x 3 m", status: "awaiting_approval" },
                { ref: "NKA-1044", title: "Launch carousel, 8 slides", status: "in_review" },
                { ref: "NKA-1045", title: "Board deck refresh", status: "queued" },
              ].map((r) => (
                <div className="preview-row" key={r.ref}>
                  <span className="ref">{r.ref}</span>
                  <span>{r.title}</span>
                  <StatusPill status={r.status} />
                </div>
              ))}
            </div>
          </div>
          <div className="split" style={{ marginTop: 48 }}>
            <div className="block">
              <h3 className="h3">Brief assistant and brand book</h3>
              <p className="muted">
                Save your colours, typefaces, audiences and tone once. The assistant uses them to turn a rough request into a
                full brief, and lists what it still needs to ask you.
              </p>
            </div>
            <div className="block">
              <h3 className="h3">Review on the file</h3>
              <p className="muted">
                Click anywhere on a design to pin a comment. Every version is kept, so you can see what changed and approve
                with one click.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <h2 className="h1">Plans</h2>
            <p className="muted">
              Pick a plan by how much you need at once. Send as many requests as you like; they queue and start as each one
              finishes.
            </p>
          </div>
          <div className="plans">
            {PLANS.map((p, i) => (
              <div key={p.id} className={`plan ${i === 1 ? "plan-feature" : ""}`}>
                <div className="plan-name">{p.name}</div>
                <div className="plan-price">
                  {money(p.monthlyGbp)} <small>a month</small>
                </div>
                <p className="muted">{p.forWho}</p>
                <ul>
                  {p.includes.slice(0, 3).map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="cta-band" style={{ marginTop: 40 }}>
            <p className="muted" style={{ margin: 0 }}>
              Bigger team? {FLEX.name} gives you a monthly budget from {money(FLEX.fromGbp)} to spend on any service, with
              every project priced before it starts.
            </p>
            <Link href="/pricing" className="btn btn-line">
              Compare plans
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <h2 className="h1">Recent work</h2>
            <p className="muted">Work by the studio team for clients in the UK and Nigeria.</p>
          </div>
          <ul className="work-list">
            {work.map((w) => (
              <li key={w.slug}>
                <div>
                  <div className="work-client">{w.client}</div>
                  <div className="work-project">{w.project}</div>
                </div>
                <div>
                  <p>{w.summary}</p>
                  <ul className="ticks work-made">
                    {w.made.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ul>
          <p style={{ marginTop: 24 }}>
            <Link href="/work" className="link-quiet">
              See all work
            </Link>
          </p>
        </div>
      </section>

      <section className="section">
        <div className="wrap split">
          <div>
            <h2 className="h1">Questions</h2>
          </div>
          <div className="faq">
            {FAQ.slice(0, 5).map((f) => (
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
            <h2 className="h1">Tell us what's on your list this quarter.</h2>
            <p className="muted" style={{ marginTop: 16 }}>
              A 20-minute call. We'll suggest a plan, or a fixed quote if a plan doesn't fit.
            </p>
          </div>
          <div className="hero-actions" style={{ marginTop: 0 }}>
            <Link href="/book" className="btn">
              Book a call
            </Link>
            <Link href="/pricing" className="btn btn-line">
              See plans
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
