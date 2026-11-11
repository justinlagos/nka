import Link from "next/link";
import type { Metadata } from "next";
import { STEPS } from "@/content/site";
import { FilmPlayer } from "@/components/FilmPlayer";

export const metadata: Metadata = {
  title: "How it works",
  description: "From brief to approved files: the five steps every Nka request follows, and the workspace you use for them.",
};

const WORKSPACE = [
  {
    title: "Brief assistant",
    body: "Write what you need the way you'd say it. The assistant turns it into a full brief using your brand book, and lists the questions it can't answer for you. You edit it before anything is sent.",
  },
  {
    title: "Brand book",
    body: "Colours, typefaces, audiences, tone of voice and your do's and don'ts, plus logo files and past work. Fill it in once; every brief and every designer uses it.",
  },
  {
    title: "Projects",
    body: "Every request with its stage, its delivery date and who's working on it. On a plan, extra requests wait in a queue and start automatically as others finish.",
  },
  {
    title: "Team hours",
    body: "Each brief shows the team hours it uses and its delivery date before work starts. The hours are fixed, and a late first draft gives them back. Bespoke work is quoted, and an owner or admin approves it.",
  },
  {
    title: "Review",
    body: "Images open full size: click to pin a comment where the change goes. PDFs open in the page. Approve a version or ask for changes in one step. Every version is kept.",
  },
  {
    title: "Library",
    body: "Approved files from every project, in one place, ready to download and reuse.",
  },
  {
    title: "Team",
    body: "Invite colleagues as admins, members or viewers. Viewers see everything and change nothing, which suits finance and leadership.",
  },
  {
    title: "Billing",
    body: "Change, pause or cancel your plan, add hours, update your card and download invoices. Every hour used or added is listed.",
  },
];

const START = [
  { title: "Start a project", body: "Say what you need and add your website. Your workspace opens in your brand." },
  { title: "Check your brand book", body: "Ten minutes. Upload your logo and guidelines if you have them." },
  { title: "Invite your team", body: "Send invite links from the Team page." },
  { title: "Send a brief", body: "Tick kickoff call if you'd like to talk it through first." },
  { title: "Review the first draft", body: "Usually within 2 working days on a plan." },
];

export default function HowItWorks() {
  return (
    <div className="lp">
      <section className="lp-section hiw-top">
        <div className="lp-wrap">
          <div className="lp-head">
            <h1 className="hiw-h1">
              From one sentence <em>to finished files.</em>
            </h1>
            <p>The same five steps for every request, in one workspace your whole team can see.</p>
          </div>
          <figure className="lp-film hiw-film">
            <FilmPlayer
              src="/films/film-workflow.mp4"
              poster="/films/film-workflow.jpg"
              label="Film: a brief for social ads going from a sentence to six finished sizes in the Nka workspace"
            />
            <figcaption>Product demonstration: a brief for social ads, from one sentence to six finished sizes.</figcaption>
          </figure>
        </div>
      </section>

      <section className="lp-section lp-pt0">
        <div className="lp-wrap">
          <ol className="steps3 steps5">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <span className="steps3-n">{i + 1}</span>
                <b>{s.title}</b>
                <p>{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="lp-section lp-mist">
        <div className="lp-wrap">
          <div className="lp-head">
            <h2>
              The workspace, <em>on every plan.</em>
            </h2>
            <p>No seats to count. Invite your whole team, and give finance a view without edit rights.</p>
          </div>
          <ul className="ws-grid">
            {WORKSPACE.map((w) => (
              <li key={w.title}>
                <b>{w.title}</b>
                <p>{w.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="lp-section lp-night">
        <div className="lp-wrap">
          <div className="lp-head">
            <h2>
              Your first brief, <em>on day one.</em>
            </h2>
            <p>Most teams send their first brief on day one.</p>
          </div>
          <ol className="steps3 steps5">
            {START.map((x, i) => (
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
            <Link href="/pricing" className="lp-btn lp-btn-lg lp-btn-line">
              How pricing works
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
