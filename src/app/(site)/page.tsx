import Link from "next/link";
import Image from "next/image";
import { StatusPill } from "@/components/StatusPill";
import { Wordmark } from "@/components/Wordmark";
import { ContactLine } from "@/components/ContactLine";
import { SERVICES } from "@/content/services";
import { visibleWork } from "@/content/work";
import { FAQ, PROMISES, STEPS } from "@/content/site";
import { IMG, SERVICE_IMG, WALL } from "@/content/images";

// Compared on the things buyers worry about. Kept general and fair: no rival is named.
const COMPARE = {
  cols: ["Hiring in-house", "Freelancers", "Agencies", "Nka"],
  rows: [
    { label: "When work starts", cells: ["After recruiting", "When they're free", "After a proposal", "Your first brief this week"] },
    { label: "Who does it", cells: ["One person's skills", "Whoever you find", "Whoever is on the account", "One named designer, plus specialists"] },
    { label: "What it costs", cells: ["Salary, tax, kit, leave", "Per job, varies", "Per project, plus extras", "One monthly price, agreed upfront"] },
    { label: "Getting out", cells: ["Notice and employment law", "Easy", "Minimum terms", "Cancel or pause any month"] },
  ],
};

export default function Home() {
  const clients = visibleWork().map((w) => w.client);
  return (
    <>
      <section className="hero hero-photo">
        <div className="wrap hero-grid">
          <div>
            <p className="eyebrow">Design studio for teams in the UK and Nigeria</p>
            <h1 className="display">Your design team, without the hiring.</h1>
            <p className="lede">
              Send a brief in a sentence. A designer who knows your brand sends back finished work, usually within 2 working
              days. Decks, campaigns, reports, events, motion.
            </p>
            <div className="hero-actions">
              <Link href="/demo" className="btn">
                Book a demo
              </Link>
              <Link href="/work" className="btn btn-line">
                See the work
              </Link>
            </div>
            <p className="hero-note">Your workspace is set up before the call. No card needed.</p>
          </div>
          <div className="hero-collage" aria-hidden="true">
            <Image className="hc-main" src={IMG.desk.src} alt="" width={IMG.desk.w} height={IMG.desk.h} priority sizes="(max-width: 860px) 90vw, 40vw" />
            <Image className="hc-a" src={IMG.social.src} alt="" width={IMG.social.w} height={IMG.social.h} sizes="(max-width: 860px) 40vw, 16vw" />
            <Image className="hc-b" src={IMG.identity.src} alt="" width={IMG.identity.w} height={IMG.identity.h} sizes="(max-width: 860px) 40vw, 14vw" />
            <div className="hc-card">
              <span className="ref">NKA-1043</span>
              <b>Launch carousel, 8 slides</b>
              <StatusPill status="in_review" />
              <span className="hc-ok">First draft on time</span>
            </div>
          </div>
        </div>
      </section>

      {clients.length > 0 && (
        <section className="proof">
          <div className="wrap proof-row">
            <span className="proof-label">Recent clients</span>
            <ul>
              {clients.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <h2 className="h1">Everything you&apos;d give a design team</h2>
            <p className="muted">
              Most teams send a mix: a deck this week, a report next week, an event the month after. One plan covers all of it,
              done by people who already know your brand.
            </p>
          </div>
          <ul className="svc-grid">
            {SERVICES.map((s) => {
              const img = SERVICE_IMG[s.slug];
              return (
                <li key={s.slug}>
                  <Link href={`/services/${s.slug}`} className="svc-card">
                    {img && (
                      <div className="svc-img">
                        <Image src={img.src} alt={img.alt} width={img.w} height={img.h} sizes="(max-width: 700px) 92vw, (max-width: 1100px) 45vw, 23vw" />
                      </div>
                    )}
                    <span className="svc-name">{s.name}</span>
                    <span className="svc-line">{s.line}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="example-note">Images show example pieces for made-up brands, to show the range. Client work is on the Work page.</p>
        </div>
      </section>

      <section className="section on-ink">
        <div className="wrap">
          <div className="section-head">
            <h2 className="h1">How it compares</h2>
            <p className="muted">
              You need design done well and on time, at a cost you can plan for, without being stuck if it doesn&apos;t work out.
            </p>
          </div>
          <div className="table-scroll">
            <table className="compare">
              <thead>
                <tr>
                  <th scope="col">
                    <span className="skip">Question</span>
                  </th>
                  {COMPARE.cols.map((c) => (
                    <th key={c} scope="col" className={c === "Nka" ? "us" : ""}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE.rows.map((r) => (
                  <tr key={r.label}>
                    <th scope="row">{r.label}</th>
                    {r.cells.map((c, i) => (
                      <td key={i} className={i === 3 ? "us" : ""}>
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <h2 className="h1">The range, in one place</h2>
            <p className="muted">Posters, packaging, ads, decks, stages and screens. Brief it once and get every size you need.</p>
          </div>
          <div className="wall">
            {WALL.map((w) => (
              <figure key={w.src}>
                <Image src={w.src} alt={w.alt} width={w.w} height={w.h} sizes="(max-width: 700px) 92vw, (max-width: 1100px) 45vw, 30vw" />
                <figcaption>{w.caption}</figcaption>
              </figure>
            ))}
          </div>
          <p className="example-note">Example pieces for made-up brands. See <Link href="/work">client work</Link>.</p>
        </div>
      </section>

      <section className="section">
        <div className="wrap split split-photo">
          <div>
            <h2 className="h1">How it works</h2>
            <ol className="steps steps-tight">
              {STEPS.map((s, i) => (
                <li key={s.title}>
                  <h3>
                    <span className="step-n">{i + 1}</span> {s.title}
                  </h3>
                  <p className="muted">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
          <div className="photo-stack">
            <Image src={IMG.team.src} alt={IMG.team.alt} width={IMG.team.w} height={IMG.team.h} sizes="(max-width: 860px) 92vw, 45vw" />
            <div className="preview preview-float" aria-label="Example of the Nka workspace">
              <div className="preview-side">
                <Wordmark />
                <span className="on">Projects</span>
                <span>Library</span>
                <span>Brand book</span>
              </div>
              <div className="preview-main">
                {[
                  { ref: "NKA-1042", title: "Annual report layout", status: "in_progress" },
                  { ref: "NKA-1043", title: "Launch carousel", status: "in_review" },
                  { ref: "NKA-1044", title: "Resize: story and banner", status: "in_progress" },
                ].map((r) => (
                  <div className="preview-row" key={r.ref}>
                    <span className="ref">{r.ref}</span>
                    <span>{r.title}</span>
                    <StatusPill status={r.status} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section on-ink">
        <div className="wrap">
          <div className="section-head">
            <h2 className="h1">Promises we put in writing</h2>
            <p className="muted">
              Each one answers something people complain about with design subscriptions. Each one is built into your workspace,
              so you can check it.
            </p>
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
        <div className="wrap split split-photo">
          <div className="photo-single">
            <Image src={IMG.markup.src} alt={IMG.markup.alt} width={IMG.markup.w} height={IMG.markup.h} sizes="(max-width: 860px) 92vw, 45vw" />
          </div>
          <div>
            <p className="eyebrow">Who leads the studio</p>
            <h2 className="h2">Ten years of brand work, from bank rebrands to festival stages.</h2>
            <p>
              Nka is led by Justin Ukaegbu, a brand and communication designer. He started at WPP&apos;s 141 Worldwide in Lagos,
              rolled out Fidelity Bank&apos;s new identity across its branches, and worked on Diamond Bank&apos;s merger into Access
              Bank. He holds an MA in Graphic Design.
            </p>
            <p className="muted">
              Specialists join for motion, illustration and development when a project needs them. Your lead designer stays the
              same.
            </p>
            <p>
              <Link href="/about" className="link-quiet">
                About the studio
              </Link>
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap split">
          <div>
            <h2 className="h1">Questions</h2>
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

      <section className="section cta-photo">
        <Image src={IMG.meeting.src} alt="" width={IMG.meeting.w} height={IMG.meeting.h} sizes="100vw" className="cta-bg" />
        <div className="wrap cta-inner">
          <h2 className="h1">What&apos;s first on your list?</h2>
          <p className="lede">Say what you need and add your website. Your workspace opens in your brand, with that first brief written and ready to make.</p>
          <div className="hero-actions">
            <Link href="/demo" className="btn">
              Book a demo
            </Link>
          </div>
          <ContactLine className="small" />
        </div>
      </section>
    </>
  );
}
