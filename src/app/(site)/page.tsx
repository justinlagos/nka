import Link from "next/link";
import Image from "next/image";
import { AudienceTabs } from "@/components/AudienceTabs";
import { SkyHero } from "@/components/sky/SkyHero";
import { WorkWall } from "@/components/WorkWall";
import { ProjectReel } from "@/components/ProjectReel";
import { RolesFlow } from "@/components/RolesFlow";
import { ProjectViewHost } from "@/components/ProjectView";
import { FilmPlayer } from "@/components/FilmPlayer";
import { PromptHero } from "@/components/PromptHero";
import { StageLogo } from "@/components/identity/LivingLogo";
import { ContactLine } from "@/components/ContactLine";
import { FAQ, PROMISES } from "@/content/site";
import { CAPABILITIES, COMPARE, FEATURES, PAINS, PEOPLE, PRICE_STEPS, SHOW, STATS } from "@/content/landing";

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

// Small pieces of the real product that answer each problem.
function Proof({ kind }: { kind: "date" | "designer" | "price" | "instant" }) {
  if (kind === "date")
    return (
      <div className="proof">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="5" width="16" height="15" rx="3" />
          <path d="M4 10h16M9 3v4M15 3v4" />
        </svg>
        <span>
          <small>Brief sent Monday</small>
          <b>First draft Thursday</b>
        </span>
        <i>On time</i>
      </div>
    );
  if (kind === "designer")
    return (
      <div className="proof">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="8" r="4" />
          <path d="M4.5 20c1.4-3.6 4.2-5.4 7.5-5.4s6.1 1.8 7.5 5.4" />
        </svg>
        <span>
          <small>Your lead designer</small>
          <b>The same person, every brief</b>
        </span>
      </div>
    );
  if (kind === "price")
    return (
      <div className="proof proof-row">
        <span className="proof-tick">Revisions included</span>
        <span className="proof-tick">Resizes free</span>
        <span className="proof-tick">Price fixed in writing</span>
      </div>
    );
  return (
    <div className="proof">
      <span className="proof-thumbs" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/gallery/stills/boba-key.webp" alt="" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/gallery/stills/runa-key.webp" alt="" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/gallery/stills/halden-palette.webp" alt="" />
      </span>
      <span>
        <small>Instant</small>
        <b>Three options in about a minute</b>
      </span>
    </div>
  );
}

export default function Home() {
  return (
    <div className="lp">
      <SkyHero />

      {/* The problem, and what changes */}
      <section className="lp-section pains">
        <div className="lp-wrap">
          <div className="lp-head">
            <h2>
              Design shouldn&apos;t be <em>the bottleneck.</em>
            </h2>
            <p>
              The launch is ready, the design isn&apos;t. These are the four things we hear most, and what happens instead when
              the brief comes to Nka.
            </p>
          </div>
          <ul className="pains2">
            {PAINS.map((p) => (
              <li key={p.who} className={`tint-${p.tint}`}>
                <div className="pain-ask">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.img} alt="" width={48} height={48} loading="lazy" />
                  <p>
                    {p.ask}
                    <small>{p.who}</small>
                  </p>
                </div>
                <p className="pain-usual">
                  <span>Usually</span>
                  <s>{p.usual}</s>
                </p>
                <div className="pain-fix">
                  <b>{p.fix}</b>
                  <Proof kind={p.proof} />
                </div>
              </li>
            ))}
          </ul>
        </div>
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

      {/* Who asks, and what comes back */}
      <section className="lp-section lp-pt0">
        <div className="lp-wrap">
          <div className="lp-head">
            <h2>
              Whoever&apos;s asking, <em>it comes back finished.</em>
            </h2>
            <p>
              Marketing needs ads by Friday. The founder needs a deck. Events needs badges. Everyone sends it to one place, and
              every request gets a designer and a date.
            </p>
          </div>
          <RolesFlow />
        </div>
      </section>

      {/* Who does the work */}
      <section className="lp-section lp-pt0">
        <div className="lp-wrap">
          <div className="lp-head">
            <h2>
              Real designers. <em>AI where it saves time.</em>
            </h2>
            <p>
              One senior designer leads your account and learns your brand. Specialists join when a brief needs motion,
              illustration or print. AI makes quick first options and keeps the admin out of their way.
            </p>
          </div>
          <ul className="people">
            {PEOPLE.map((x) => (
              <li key={x.title}>
                <div className="people-img">
                  <Image src={x.src} alt={x.alt} width={x.w} height={x.h} sizes="(max-width: 900px) 92vw, 30vw" />
                </div>
                <h3>{x.title}</h3>
                <p>{x.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Projects as systems */}
      <section className="lp-section" id="work">
        <div className="lp-wrap">
          <div className="lp-head">
            <h2>
              One brief, <em>a whole system.</em>
            </h2>
            <p>
              A project is never one file. Open one to watch the film, see every piece it covers and start a brief like it.
            </p>
          </div>
          <ProjectReel />
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
              <Pic k="boba" sizes="(max-width: 900px) 92vw, 45vw" />
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
          <figure className="lp-film">
            <FilmPlayer
              src="/films/film-workflow.mp4"
              poster="/films/film-workflow.jpg"
              label="Film: a brief for social ads going from a sentence to six finished sizes in the Nka workspace"
            />
            <figcaption>Product demonstration: a brief for social ads, from one sentence to six finished sizes.</figcaption>
          </figure>
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

      {/* How pricing works */}
      <section className="lp-section lp-mist" id="pricing">
        <div className="lp-wrap">
          <div className="lp-head">
            <h2>
              How pricing <em>works.</em>
            </h2>
            <p>
              One monthly price, agreed with you and fixed in writing. Every plan includes your named designer, revisions and
              free resizes.
            </p>
          </div>
          <ol className="steps3">
            {PRICE_STEPS.map((x, i) => (
              <li key={x.title}>
                <span className="steps3-n">{i + 1}</span>
                <b>{x.title}</b>
                <p>{x.body}</p>
              </li>
            ))}
          </ol>
          <div className="lp-actions">
            <Link href="/demo" className="lp-btn lp-btn-lg">
              Start a project
            </Link>
            <Link href="/pricing" className="lp-btn lp-btn-lg lp-btn-ghost">
              See plans
            </Link>
          </div>
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
              Seen what we can do? <em>Tell us what you need.</em>
            </h2>
            <p className="lp-lede">One line is enough. It becomes your first brief, and your workspace opens in your brand.</p>
            <div className="close2-ask">
              <PromptHero id="need-close" />
            </div>
            <ol className="close2-next">
              <li>
                <b>Now</b> Say what you need, add your website and confirm your email.
              </li>
              <li>
                <b>Half a minute later</b> Your workspace opens with your brand and the brief written.
              </li>
              <li>
                <b>Within a working day</b> Your designer calls. You get a monthly price in writing. No card until you say yes.
              </li>
            </ol>
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
      <ProjectViewHost />
    </div>
  );
}
