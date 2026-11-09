import Link from "next/link";
import type { Metadata } from "next";
import { STEPS } from "@/content/site";

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
    title: "Estimates",
    body: "On Flex and one-off projects, you see the cost, hours and delivery date before work starts. An owner or admin approves it, and the cost comes off your budget.",
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
    body: "Change or cancel your plan, update your card and download invoices. Flex clients see budget, spend and anything due to expire.",
  },
];

export default function HowItWorks() {
  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <h1 className="h1">How it works</h1>
          <p className="lede">The same five steps for every request, and one workspace where you can see all of them.</p>
        </div>
      </section>
      <section className="section" style={{ paddingTop: 24 }}>
        <div className="wrap">
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
      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <h2 className="h1">The workspace</h2>
            <p className="muted">Included with every plan. No seats to count: invite your whole team.</p>
          </div>
          <div className="split">
            {WORKSPACE.map((w) => (
              <div className="block" key={w.title}>
                <h3 className="h3">{w.title}</h3>
                <p className="muted">{w.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <h2 className="h1">Getting started</h2>
            <p className="muted">Most teams send their first brief on day one.</p>
          </div>
          <ol className="steps">
            <li>
              <h3>Book a demo</h3>
              <p className="muted">Say what you need and add your website. Your workspace opens in your brand.</p>
            </li>
            <li>
              <h3>Fill in your brand book</h3>
              <p className="muted">Ten minutes. Upload your logo and guidelines if you have them.</p>
            </li>
            <li>
              <h3>Invite your team</h3>
              <p className="muted">Send invite links from the Team page.</p>
            </li>
            <li>
              <h3>Send a brief</h3>
              <p className="muted">Tick "kickoff call" if you'd like to talk it through first.</p>
            </li>
            <li>
              <h3>Review the first draft</h3>
              <p className="muted">Usually within 2 working days on a plan.</p>
            </li>
          </ol>
          <div className="hero-actions" style={{ marginTop: 48 }}>
            <Link href="/demo" className="btn">
              Book a demo
            </Link>
            <Link href="/pricing" className="btn btn-line">
              How pricing works
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
