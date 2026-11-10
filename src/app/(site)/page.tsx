import Link from "next/link";
import Image from "next/image";
import { PromptHero } from "@/components/PromptHero";
import { AudienceTabs } from "@/components/AudienceTabs";
import { LogoLoop } from "@/components/LogoLoop";
import { WorkWall } from "@/components/WorkWall";
import { ContactLine } from "@/components/ContactLine";
import { FAQ, PROMISES } from "@/content/site";
import { CAPABILITIES, FEATURES, LP_IMG, STATS } from "@/content/landing";

const COMPARE = {
  cols: ["Hiring in-house", "Freelancers", "Agencies", "nka.studio"],
  rows: [
    { label: "Ready to start", cells: ["After months of recruiting", "When they're free", "After a proposal", "This week"] },
    { label: "Range of skills", cells: ["One person's", "Whoever you find", "Whoever is on the account", "Every discipline, one named lead"] },
    { label: "Speed", cells: ["One person's capacity", "Varies", "Weeks per project", "AI options in a minute, drafts in 2 days"] },
    { label: "Cost", cells: ["Salary, tax, kit, leave", "Per job, varies", "Per project, plus extras", "One monthly price, agreed upfront"] },
    { label: "Getting out", cells: ["Notice and employment law", "Easy", "Minimum terms", "Cancel or pause any month"] },
  ],
};

export default function Home() {
  return (
    <div className="lp">
      {/* Hero */}
      <section className="lp-hero">
        <div className="lp-wrap lp-hero-grid">
          <div className="lp-hero-copy">
            <h1>Hand us the design work. All of it.</h1>
            <p className="lp-lede">
              nka.studio is the design team agencies, marketing teams and growing companies plug in. Senior designers and AI,
              one monthly plan, one workspace. Brand, campaigns, decks, reports, motion and web.
            </p>
            <div className="lp-actions">
              <Link href="/demo" className="lp-btn lp-btn-lg">
                Book a demo
              </Link>
              <Link href="#how" className="lp-btn lp-btn-ghost lp-btn-lg">
                See how it works
              </Link>
            </div>
            <div className="lp-try">
              <p>Try it now. What do you need designed?</p>
              <PromptHero />
            </div>
            <p className="lp-fine">No contracts. Cancel or pause any month. Teams in the UK and Nigeria.</p>
          </div>
          <div className="lp-hero-media" aria-hidden="true">
            <div className="hm-photo">
              <Image src={LP_IMG.director.src} alt="" width={LP_IMG.director.w} height={LP_IMG.director.h} priority sizes="(max-width: 900px) 80vw, 34vw" />
            </div>
            <div className="hm-card hm-brief">
              <span className="hm-label">New brief</span>
              <p>&ldquo;Three poster ideas for our coffee launch, by Friday&rdquo;</p>
            </div>
            <div className="hm-card hm-instant">
              <span className="hm-label">Instant</span>
              <div className="hm-thumb">
                <Image src={LP_IMG.options.src} alt="" width={LP_IMG.options.w} height={LP_IMG.options.h} sizes="220px" />
              </div>
              <b>3 options ready</b>
            </div>
            <div className="hm-card hm-date">
              <span className="hm-label">Designer</span>
              <b>First draft Thursday</b>
              <span className="hm-ok">On time</span>
            </div>
          </div>
        </div>
      </section>

      {/* What teams hand us */}
      <WorkWall />

      {/* Numbers that are true today */}
      <section className="lp-stats">
        <div className="lp-wrap lp-stats-grid">
          {STATS.map((s) => (
            <div key={s.label}>
              <b>{s.figure}</b>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Who it's for */}
      <section className="lp-section">
        <div className="lp-wrap">
          <div className="lp-head">
            <h2>Built for the teams that never run out of design work.</h2>
            <p>Whoever you are, the deal is the same: you say what you need, we make it, you approve it. Here&apos;s what that looks like for you.</p>
          </div>
          <AudienceTabs />
        </div>
      </section>

      {/* Capabilities */}
      <section className="lp-section lp-soft">
        <div className="lp-wrap">
          <div className="lp-head">
            <h2>Every kind of design. One team.</h2>
            <p>No more finding a different freelancer for each job. Send it all to one place, made by people who already know your brand.</p>
          </div>
          <ul className="lp-svc">
            {CAPABILITIES.map((c) => {
              const img = LP_IMG[c.img];
              return (
                <li key={c.slug}>
                  <Link href={`/services/${c.slug}`} className="lp-svc-row">
                    <span className="lp-svc-name">{c.name}</span>
                    <span className="lp-svc-line">{c.line}</span>
                    <span className="lp-svc-img" aria-hidden="true">
                      <Image src={img.src} alt="" width={img.w} height={img.h} sizes="200px" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="lp-note">Images are illustrations of the kinds of work we make.</p>
        </div>
      </section>

      {/* Two speeds */}
      <section className="lp-section" id="how">
        <div className="lp-wrap">
          <div className="lp-head">
            <h2>Two speeds. You pick, every brief.</h2>
            <p>Start with AI when you need something now. Go straight to your designer when it has to be perfect. Or both.</p>
          </div>
          <div className="lp-speeds">
            <article className="lp-speed lp-speed-ink">
              <div className="lp-speed-top">
                <span className="lp-chip">Instant</span>
                <b className="lp-speed-fig">1 min</b>
                <p>Three finished options made by AI from your brief, in your colours and type. Keep one, or hand it to your designer to finish.</p>
              </div>
              <Image src={LP_IMG.options.src} alt={LP_IMG.options.alt} width={LP_IMG.options.w} height={LP_IMG.options.h} sizes="(max-width: 900px) 92vw, 45vw" />
            </article>
            <article className="lp-speed">
              <div className="lp-speed-top">
                <span className="lp-chip">Designer</span>
                <b className="lp-speed-fig">2 days</b>
                <p>Your named designer makes it. A delivery date the moment you send the brief, revisions until it meets it, every size included.</p>
              </div>
              <Image src={LP_IMG.designer.src} alt={LP_IMG.designer.alt} width={LP_IMG.designer.w} height={LP_IMG.designer.h} sizes="(max-width: 900px) 92vw, 45vw" />
            </article>
          </div>
        </div>
      </section>

      {/* The workspace */}
      <section className="lp-section lp-ink">
        <div className="lp-wrap">
          <div className="lp-head">
            <h2>One workspace from brief to final file.</h2>
            <p>No email chains, no lost versions, no chasing. Everything your team and ours needs, in one place.</p>
          </div>
          <div className="lp-app" aria-label="The nka.studio workspace">
            <div className="lp-app-bar">
              <span />
              <span />
              <span />
              <em>nka.studio/app</em>
            </div>
            <div className="lp-app-body">
              <aside className="lp-app-side">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/signature-white.png" alt="" width={677} height={630} />
                <span className="on">Projects</span>
                <span>Library</span>
                <span>Brand book</span>
                <span>Team</span>
              </aside>
              <div className="lp-app-main">
                <div className="lp-app-title">
                  <div>
                    <small>NKA-1043</small>
                    <b>Restaurant launch, print set</b>
                  </div>
                  <span className="lp-pill">Ready for review</span>
                </div>
                <div className="lp-app-review">
                  <Image src={LP_IMG.menu.src} alt="" width={LP_IMG.menu.w} height={LP_IMG.menu.h} sizes="(max-width: 900px) 80vw, 40vw" />
                  <span className="lp-pin" style={{ left: "30%", top: "52%" }}>
                    1
                  </span>
                  <span className="lp-pin" style={{ left: "60%", top: "74%" }}>
                    2
                  </span>
                </div>
              </div>
              <div className="lp-app-thread">
                <div className="lp-msg">
                  <b>1</b> Can the menu title sit a little higher?
                </div>
                <div className="lp-msg">
                  <b>2</b> Use the darker leaf pattern on the coasters.
                </div>
                <div className="lp-msg lp-msg-us">Done. Version 2 is up for review.</div>
                <div className="lp-app-actions">
                  <span className="lp-btn lp-btn-sm">Approve</span>
                  <span className="lp-btn lp-btn-sm lp-btn-ghost">Ask for changes</span>
                </div>
              </div>
            </div>
          </div>
          <ul className="lp-features">
            {FEATURES.map((f) => (
              <li key={f.title}>
                <b>{f.title}</b>
                <span>{f.body}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* How it starts */}
      <section className="lp-section">
        <div className="lp-wrap">
          <div className="lp-head">
            <h2>Up and running before the call ends.</h2>
            <p>No onboarding project. No kickoff deck. Your first piece of work can be on screen today.</p>
          </div>
          <ol className="lp-steps">
            <li>
              <b>1</b>
              <h3>Tell us what you need</h3>
              <p>One sentence and your website. We read your brand and write the brief.</p>
            </li>
            <li>
              <b>2</b>
              <h3>Pick a speed</h3>
              <p>Instant options in a minute, or your designer with a date on it.</p>
            </li>
            <li>
              <b>3</b>
              <h3>Approve and use it</h3>
              <p>Comment on the file, approve, download. Every size you need, included.</p>
            </li>
          </ol>
        </div>
      </section>

      {/* Billboard moment */}
      <section className="lp-banner">
        <Image src={LP_IMG.billboard.src} alt={LP_IMG.billboard.alt} width={LP_IMG.billboard.w} height={LP_IMG.billboard.h} sizes="100vw" />
        <div className="lp-banner-copy">
          <h2>Your whole design pipeline, on one monthly plan.</h2>
          <Link href="/demo" className="lp-btn lp-btn-lg lp-btn-light">
            Book a demo
          </Link>
        </div>
      </section>

      {/* Compare */}
      <section className="lp-section">
        <div className="lp-wrap">
          <div className="lp-head">
            <h2>Why teams switch.</h2>
            <p>The speed of a freelancer, the range of an agency, the commitment of your own team. Without the downsides of any of them.</p>
          </div>
          <div className="table-scroll lp-compare-d">
            <table className="lp-compare">
              <thead>
                <tr>
                  <th scope="col">
                    <span className="skip">Question</span>
                  </th>
                  {COMPARE.cols.map((c, i) => (
                    <th key={c} scope="col" className={i === 3 ? "us" : ""}>
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
          <ul className="lp-compare-m">
            {COMPARE.rows.map((r) => (
              <li key={r.label}>
                <span className="cm-q">{r.label}</span>
                <b>{r.cells[3]}</b>
                <span className="cm-else">
                  In-house: {r.cells[0]}. Freelancers: {r.cells[1]}. Agencies: {r.cells[2]}.
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Promises */}
      <section className="lp-section lp-soft">
        <div className="lp-wrap">
          <div className="lp-head">
            <h2>Zero lock-in. All upside.</h2>
            <p>The things people hate about design subscriptions, fixed. Each one is written into our terms and built into your workspace.</p>
          </div>
          <ul className="lp-promises">
            {PROMISES.map((p) => (
              <li key={p.title}>
                <b>{p.title}</b>
                <p>{p.body}</p>
                <span>{p.how}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section className="lp-section">
        <div className="lp-wrap lp-faq">
          <h2>Questions.</h2>
          <div className="faq">
            {FAQ.slice(0, 7).map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Close */}
      <section className="lp-close">
        <div className="lp-wrap lp-close-grid">
          <LogoLoop tone="dark" className="lp-close-logo" />
          <div>
            <h2>Your next twelve months of design, handled.</h2>
            <p className="lp-lede">
              Book a demo. Say what you need and add your website, and your workspace opens in your brand with the first brief
              already written.
            </p>
            <div className="lp-actions">
              <Link href="/demo" className="lp-btn lp-btn-lg lp-btn-light">
                Book a demo
              </Link>
              <Link href="/pricing" className="lp-btn lp-btn-lg lp-btn-ghost-light">
                How pricing works
              </Link>
            </div>
            <ContactLine lead="Rather talk now?" className="small" />
          </div>
        </div>
      </section>
    </div>
  );
}
