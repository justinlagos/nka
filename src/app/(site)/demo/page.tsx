import type { Metadata } from "next";
import { DemoFlow } from "@/components/DemoFlow";
import { ContactLine } from "@/components/ContactLine";

export const metadata: Metadata = {
  title: "Book a demo",
  description: "Answer four questions. Your Nka workspace is ready before the call, with your first brief drafted.",
};

const NEXT = [
  { t: "Now", b: "Answer four questions and confirm your email with a code." },
  { t: "In a minute", b: "Your workspace opens with your brand basics saved and your first brief drafted. Edit it, send it, or wait for the call." },
  { t: "Within a working day", b: "Your designer calls at the time you picked. You get a monthly price in writing. No card until you say yes." },
];

export default function Demo() {
  return (
    <section className="section demo">
      <div className="wrap demo-grid">
        <div className="demo-intro">
          <p className="eyebrow">Book a demo</p>
          <h1 className="h1">See your own workspace, not a sales deck.</h1>
          <p className="lede">
            Most demos show you someone else&apos;s example. Ours sets up your account from your answers, so the call is about
            your actual work.
          </p>
          <ol className="demo-next">
            {NEXT.map((n) => (
              <li key={n.t}>
                <b>{n.t}</b>
                <span>{n.b}</span>
              </li>
            ))}
          </ol>
          <ContactLine lead="Rather talk now?" />
        </div>
        <DemoFlow />
      </div>
    </section>
  );
}
