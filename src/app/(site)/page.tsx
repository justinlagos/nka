import Link from "next/link";
import Image from "next/image";
import { PromptHero } from "@/components/PromptHero";
import { AudienceTabs } from "@/components/AudienceTabs";
import { HeroColumns } from "@/components/HeroColumns";
import { WorkWall } from "@/components/WorkWall";
import { StageLogo } from "@/components/identity/LivingLogo";
import { ContactLine } from "@/components/ContactLine";
import { FAQ, PROMISES } from "@/content/site";
import { CAPABILITIES, CHIPS, COMPARE, FEATURES, PILLARS, SHOW, STATS, STORIES } from "@/content/landing";

function Pic({ k, sizes, className, priority }: { k: keyof typeof SHOW; sizes: string; className?: string; priority?: boolean }) {
  const p = SHOW[k];
  return <Image src={p.src} alt={p.alt} width={p.w} height={p.h} sizes={sizes} className={className} priority={priority} />;
}

const TICK = (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <path d="M4 12.5l5 5L20 6.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const CROSS = (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export default function Home() {
  return (
    <div className="lp">
      {/* Hero */}
      <section className="hero2">
        <div className="lp-wrap hero2-grid">
          <div className="hero2-copy">
            <h1>
              Hand us the design work. <em>All of it.</em>
            </h1>
            <p className="lp-lede">
              Brand, campaigns, decks, reports, packaging, motion and web, made by senior designers and AI on one monthly plan.
              For agencies, marketing teams and companies that never run out of design work.
            </p>
            <div className="lp-actions">
              <Link href="/demo" className="lp-btn lp-btn-lg">
                Book a demo
              </Link>
              <Link href="#work" className="lp-btn lp-btn-lg lp-btn-ghost">
                See the work
              </Link>
            </div>
            <div className="lp-try">
              <p>Try it now. What do you need designed?</p>
              <PromptHero />
            </div>
            <p className="lp-fine">No contracts. Pause or cancel any month. Teams in the UK and Nigeria.</p>
          </div>
          <HeroColumns />
        </div>
      </section>

      {/* What teams hand us */}
      <section className="chips" aria-label="What teams hand us">
        <ul className="chips-track">
          {[...CHIPS, ...CHIPS].map((c, i) => {
            const p = SHOW[c.img];
            return (
              <li key={i} aria-hidden={i >= CHIPS.length || undefined}>
                <Image src={p.src} alt="" width={p.w} height={p.h} sizes="40px" />
                {c.label}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Numbers that are true today */}
      <section className="lp-section lp-tight">
        <div className="lp-wrap stats2">
          {STATS.map((s) => (
            <div key={s.label}>
              <b>{s.figure}</b>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Partner */}
      <section className="lp-section lp-pt0">
        <div className="lp-wrap split2">
          <div className="split2-img">
            <Pic k="team" sizes="(max-width: 900px) 92vw, 48vw" />
          </div>
          <div className="split2-copy">
            <h2>
              The design team your team <em>has been asking for.</em>
            </h2>
            <p className="lp-lede">
              Plug in senior designers who already know your brand, with AI built into every step. You say what you need; we
              make it, size it and ship it.
            </p>
            <p>No hiring, no onboarding project, no new freelancer every month. One plan, one workspace, one named designer.</p>
            <div className="lp-actions">
              <Link href="/demo" className="lp-btn lp-btn-ink">
                Book a demo
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section className="lp-section lp-night">
        <div className="lp-wrap">
          <h2 className="lp-center">
            Senior talent. Smart systems. <em>Built to keep up with you.</em>
          </h2>
          <ul className="pillars">
            {PILLARS.map((p) => (
              <li key={p.title} className={`tint-${p.tint}`}>
                <div className="pillar-img">
                  <Pic k={p.img} sizes="(max-width: 900px) 92vw, 30vw" />
                </div>
                <div className="pillar-copy">
                  <h3>{p.title}</h3>
                  <p>{p.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* One brand, every touchpoint */}
      <section className="lp-section" id="work">
        <div className="lp-wrap">
          <div className="lp-head">
            <h2>
              One brand, <em>every touchpoint.</em>
            </h2>
            <p>
              A campaign is never one file. We keep the system together from the packaging to the billboard to the feed. Here is the
              kind of range one plan covers.
            </p>
          </div>
          <div className="stories">
            {STORIES.map((s, i) => (
              <article key={s.brand} className={`story ${i % 2 ? "story-flip" : ""}`}>
                <div className="story-big">
                  <Pic k={s.big} sizes="(max-width: 900px) 92vw, 60vw" />
                </div>
                <div className="story-small">
                  <Pic k={s.small} sizes="(max-width: 900px) 92vw, 30vw" />
                </div>
                <div className="story-cap">
                  <h3>{s.brand}</h3>
                  <p>{s.what}</p>
                  <ul>
                    {s.tags.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
          <p className="lp-note">Every brand and piece shown is a made-up example, created to show the range of work.</p>
        </div>
        <WorkWall />
      </section>

      {/* Services */}
      <section className="lp-section lp-mist">
        <div className="lp-wrap">
          <div className="lp-head">
            <h2>
              Every kind of design. <em>One team.</em>
            </h2>
            <p>Send it all to one place, made by people who already know your brand. Each service has its own page.</p>
          </div>
          <ul className="svc2">
            {CAPABILITIES.map((c) => (
              <li key={c.slug}>
                <Link href={`/services/${c.slug}`}>
                  <div className="svc2-img">
                    <Pic k={c.img} sizes="(max-width: 700px) 92vw, (max-width: 1100px) 45vw, 24vw" />
                  </div>
                  <b>{c.name}</b>
                  <span>{c.line}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Two speeds */}
      <section className="lp-section" id="how">
        <div className="lp-wrap">
          <div className="lp-head">
            <h2>
              Two speeds. <em>You pick, every brief.</em>
            </h2>
            <p>Start with AI when you need something now. Go straight to your designer when it has to be perfect. Or both.</p>
          </div>
          <div className="speeds2">
            <article className="speed2 speed2-ai">
              <div className="speed2-top">
                <span className="lp-chip">Instant</span>
                <b className="speed2-fig">1 min</b>
                <p>Three finished options made by AI from your brief, in your colours and type. Keep one, or hand it to your designer to finish.</p>
              </div>
              <Pic k="social" sizes="(max-width: 900px) 92vw, 45vw" />
            </article>
            <article className="speed2 speed2-human">
              <div className="speed2-top">
                <span className="lp-chip">Designer</span>
                <b className="speed2-fig">2 days</b>
                <p>Your named designer makes it. A delivery date the moment you send the brief, revisions until it meets it, every size included.</p>
              </div>
              <Pic k="designer" sizes="(max-width: 900px) 92vw, 45vw" />
            </article>
          </div>
        </div>
      </section>

      {/* The workspace */}
      <section className="lp-section lp-night">
        <div className="lp-wrap">
          <div className="lp-head">
            <h2>
              One workspace, <em>brief to final file.</em>
            </h2>
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
                  <Image src={SHOW.restaurant.src} alt="" width={SHOW.restaurant.w} height={SHOW.restaurant.h} sizes="(max-width: 900px) 80vw, 40vw" />
                  <span className="lp-pin" style={{ left: "24%", top: "62%" }}>
                    1
                  </span>
                  <span className="lp-pin" style={{ left: "70%", top: "70%" }}>
                    2
                  </span>
                </div>
              </div>
              <div className="lp-app-thread">
                <div className="lp-msg">
                  <b>1</b> Can the menu title sit a little higher?
                </div>
                <div className="lp-msg">
                  <b>2</b> Use the darker leaf pattern on the napkins.
                </div>
                <div className="lp-msg lp-msg-us">Done. Version 2 is up for review.</div>
                <div className="lp-app-actions">
                  <span className="lp-btn lp-btn-sm">Approve</span>
                  <span className="lp-btn lp-btn-sm lp-btn-line">Ask for changes</span>
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

      {/* Who it's for */}
      <section className="lp-section">
        <div className="lp-wrap">
          <div className="lp-head">
            <h2>
              Built for teams that <em>never run out</em> of design work.
            </h2>
            <p>Whoever you are, the deal is the same: you say what you need, we make it, you approve it.</p>
          </div>
          <AudienceTabs />
        </div>
      </section>

      {/* Compare */}
      <section className="lp-section lp-night">
        <div className="lp-wrap">
          <h2 className="lp-center">
            Hire, use an agency, or freelance? <em>None of the above.</em>
          </h2>
          <div className="cmp" role="table" aria-label="How nka.studio compares">
            <div className="cmp-row cmp-head" role="row">
              <span role="columnheader" className="cmp-name">
                <span className="skip">Option</span>
              </span>
              {COMPARE.cols.map((c) => (
                <span key={c} role="columnheader">
                  {c}
                </span>
              ))}
            </div>
            {COMPARE.rows.map((r) => (
              <div key={r.name} className={`cmp-row ${r.us ? "cmp-us" : ""}`} role="row">
                <span role="rowheader" className="cmp-name">
                  <b>{r.name}</b>
                  <small>{r.note}</small>
                </span>
                {r.marks.map((m, i) => (
                  <span key={i} role="cell" className={m ? "yes" : "no"} data-col={COMPARE.cols[i]}>
                    {m ? TICK : CROSS}
                    <span className="skip">{m ? "Yes" : "No"}</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Promises */}
      <section className="lp-section">
        <div className="lp-wrap">
          <div className="lp-head">
            <h2>
              Zero lock-in. <em>All upside.</em>
            </h2>
            <p>The things people hate about design subscriptions, fixed. Each one is written into our terms and built into your workspace.</p>
          </div>
          <ul className="promises2">
            {PROMISES.map((p, i) => (
              <li key={p.title} className={`tint-${["peach", "sky", "mint", "lilac", "butter", "peach"][i % 6]}`}>
                <b>{p.title}</b>
                <p>{p.body}</p>
                <span>{p.how}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Banner */}
      <section className="banner2">
        <Pic k="founder" sizes="100vw" />
        <div className="banner2-copy">
          <h2>
            Your whole design pipeline, <em>on one plan.</em>
          </h2>
          <Link href="/demo" className="lp-btn lp-btn-lg">
            Book a demo
          </Link>
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
      <section className="close2">
        <div className="lp-wrap close2-grid">
          <div className="close2-logo">
            <StageLogo initial="signature" arrive="morph" />
            <p className="close2-cue">Tap the logo.</p>
          </div>
          <div>
            <h2>
              Your next twelve months of design, <em>handled.</em>
            </h2>
            <p className="lp-lede">
              Book a demo. Say what you need and add your website, and your workspace opens in your brand with the first brief
              already written.
            </p>
            <div className="lp-actions">
              <Link href="/demo" className="lp-btn lp-btn-lg lp-btn-ink">
                Book a demo
              </Link>
              <Link href="/pricing" className="lp-btn lp-btn-lg lp-btn-line">
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
